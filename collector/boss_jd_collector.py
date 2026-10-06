# -*- coding: utf-8 -*-
"""
Boss直聘岗位采集器（只读旁观模式）
================================
原理：接管你手动打开的 Chrome（带调试端口），轮询检测你浏览过的岗位详情页，
自动截取 JD 区域 + 抓取标题/薪资等文字 + 本地 OCR，按岗位存档到桌面文件夹。
你正常刷岗位即可，脚本只"看"你打开的页面，不自动浏览、不自动沟通。

默认存档位置：用户桌面下的 `boss_jobs\\<时间>_<岗位ID>\\`。
可用 `BOSS_JOBS_DIR` 和 `BOSS_CHROME_PROFILE_DIR` 环境变量覆盖存档目录和 Chrome 配置目录。
    jd.png     JD 区域截图（OCR 失败时把这张图直接丢给 Claude 也能分析）
    jd.md      OCR 出的 JD 文本 + 元数据
    info.json  原始元数据
"""

import json
import os
import re
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

DEBUG_PORT = 9222


def _default_desktop():
    """Return the desktop directory on common Windows installations."""
    for name in ("Desktop", "桌面"):
        path = Path.home() / name
        if path.exists():
            return path
    return Path.home() / "Desktop"


DESKTOP_DIR = Path(os.environ.get("BOSS_DESKTOP_DIR", str(_default_desktop())))
SAVE_DIR = Path(os.environ.get("BOSS_JOBS_DIR", str(DESKTOP_DIR / "boss_jobs")))
STATE_FILE = SAVE_DIR / "_state.json"
PROFILE_DIR = Path(os.environ.get(
    "BOSS_CHROME_PROFILE_DIR",
    str(DESKTOP_DIR / "boss_jd_tool" / "chrome_profile"),
))
POLL_SECONDS = 3          # 轮询间隔（只看已打开的标签页，很低频）
JOB_URL_RE = re.compile(r"zhipin\.com/job_detail/([0-9a-zA-Z]+)")

# Boss 页面结构会改版，这里放多组候选选择器，挨个试
SEL_TITLE = [".job-banner .name", ".job-primary .name", ".job-name", ".name"]
SEL_SALARY = [".job-banner .salary", ".job-primary .salary", ".salary"]
SEL_JD = [
    ".job-sec",              # 职位描述区块（常见）
    ".job-detail-section",
    ".detail-content",
    ".job-sec-text",
]
SEL_COMPANY = [".company-info .name", ".job-sider .name", ".company-name"]


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"done": {}}


def save_state(state):
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def first_text(tab, selectors):
    for sel in selectors:
        try:
            ele = tab.ele(sel, timeout=1)
            if ele:
                t = ele.text.strip()
                if t:
                    return t
        except Exception:
            continue
    return ""


def first_element(tab, selectors):
    for sel in selectors:
        try:
            ele = tab.ele(sel, timeout=1)
            if ele:
                return ele
        except Exception:
            continue
    return None


def ocr_image(img_path: Path) -> str:
    """本地 OCR，失败返回空串（截图仍在，不影响使用）"""
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        log("未安装 rapidocr_onnxruntime，跳过 OCR（截图已保存，可直接丢给 Claude 读图）")
        return ""
    try:
        ocr = RapidOCR()
        result, _ = ocr(str(img_path))
        if not result:
            return ""
        return "\n".join(line[1] for line in result)
    except Exception:
        log("OCR 出错（不影响采集）：" + traceback.format_exc(limit=1))
        return ""


def capture_job(tab, url):
    m = JOB_URL_RE.search(url)
    job_id = m.group(1) if m else datetime.now().strftime("%H%M%S")

    # 等页面主要内容渲染
    time.sleep(2)

    title = first_text(tab, SEL_TITLE)
    salary = first_text(tab, SEL_SALARY)
    company = first_text(tab, SEL_COMPANY)
    page_title = ""
    try:
        page_title = tab.title
    except Exception:
        pass

    # 截 JD 区域；找不到就退化为整页截图
    jd_ele = first_element(tab, SEL_JD)
    ts = datetime.now().strftime("%m%d_%H%M%S")
    folder = SAVE_DIR / f"{ts}_{job_id}"
    folder.mkdir(parents=True, exist_ok=True)
    img_path = folder / "jd.png"

    shot_ok = False
    try:
        if jd_ele:
            img_bytes = jd_ele.get_screenshot(as_bytes="png")
        else:
            img_bytes = tab.get_screenshot(as_bytes="png", full_page=True)
        if img_bytes:
            img_path.write_bytes(img_bytes)
            shot_ok = True
    except Exception:
        log("截图失败：" + traceback.format_exc(limit=1))

    ocr_text = ocr_image(img_path) if shot_ok else ""

    info = {
        "job_id": job_id,
        "url": url,
        "title": title,
        "salary": salary,
        "company": company,
        "page_title": page_title,
        "captured_at": datetime.now().isoformat(timespec="seconds"),
        "screenshot_ok": shot_ok,
    }
    (folder / "info.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    md = [
        f"# {title or page_title or '未知岗位'}",
        "",
        f"- 薪资：{salary or '见截图'}",
        f"- 公司：{company or '见截图'}",
        f"- 链接：{url}",
        f"- 采集时间：{info['captured_at']}",
        "",
        "## JD 文本（OCR）",
        "",
        ocr_text or "（OCR 失败，直接把同目录 jd.png 丢给 Claude 读图即可）",
    ]
    (folder / "jd.md").write_text("\n".join(md), encoding="utf-8")
    log(f"已存档：{folder.name}｜{title or page_title[:30]}｜{salary}")
    return True


def main():
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

    from DrissionPage import ChromiumPage, ChromiumOptions

    co = ChromiumOptions()
    co.set_local_port(DEBUG_PORT)
    if PROFILE_DIR.exists():
        co.set_user_data_path(str(PROFILE_DIR))
    else:
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        co.set_user_data_path(str(PROFILE_DIR))
    try:
        page = ChromiumPage(co)
    except Exception:
        print("无法启动 Chrome。请确认本机已安装 Chrome 浏览器，再重新运行 1_开始采集.bat。")
        input("按回车退出...")
        sys.exit(1)

    log(f"已接管浏览器（端口 {DEBUG_PORT}），开始旁观模式。正常刷岗位即可，按 Ctrl+C 退出。")
    try:
        while True:
            try:
                for tid in page.tab_ids:
                    tab = page.get_tab(tid)
                    try:
                        url = tab.url or ""
                    except Exception:
                        continue
                    m = JOB_URL_RE.search(url)
                    if not m:
                        continue
                    job_id = m.group(1)
                    if job_id in state["done"]:
                        continue
                    log(f"发现新岗位页：{job_id}")
                    try:
                        capture_job(tab, url)
                        state["done"][job_id] = datetime.now().isoformat(timespec="seconds")
                        save_state(state)
                    except Exception:
                        log("采集该岗位失败，下轮重试：" + traceback.format_exc(limit=1))
            except KeyboardInterrupt:
                raise
            except Exception:
                log("轮询出错（浏览器可能被关闭）：" + traceback.format_exc(limit=1))
                time.sleep(5)
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        log("已退出。")


if __name__ == "__main__":
    main()
