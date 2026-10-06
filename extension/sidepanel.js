// ===== 简历画像与分析提示词（与本仓库 skill/jd-analysis 同源）=====
// 示例画像（虚构数据，仅用于演示）。请到「设置 → 简历」上传你自己的简历替换掉，
// 替换后所有分析都会以你的真实经历为准。
const RESUME_PROFILE = `
【求职者画像·示例（虚构）】
- 2024届示例大学计算机科学与技术本科；某科技有限公司 AI应用开发工程师 2024.7-至今
- 定位：大模型应用开发（Agent / RAG 方向），1年经验
- 技能：LangChain/LangGraph 编排、多步工具调用、条件路由、结构化输出校验；RAG 全链路（向量库、混合检索、重排、引用溯源）；Python/FastAPI/asyncio/SSE；MySQL；评测体系（固定题集/对照实验）
- 量化项目：①企业知识库问答（LangGraph 编排 + 混合检索，500 题评测召回率 70%→92%）②多轮客服助手（意图路由 + 工具调用，人工转接率下降 35%）
- 市场短板：经验年限短；个人项目需用评测数字证明不是玩具项目
- 求职偏好：大模型应用开发为主；一二线城市
- 注意：以上为示例数据。请替换为你自己的真实经历，本工具严禁编造经历和数字
`;

const ANALYZE_PROMPT_TPL = `你是求职辅助分析Agent。基于下方简历画像，对用户提供的岗位JD做分析，严格按以下五件套输出（用中文，直说、有证据链、不回避负面判断）：

一、JD拆解卡：硬门槛(逐条✓/✗/远超)、岗位真面目(实际做什么、什么类型岗)、隐性信号(团队状况/薪资宽幅/公司阶段)、红旗(没有就写没有)
二、匹配结论：冲/稳/弃三档 + 匹配点 + 真实缺口(面试或试用期会暴露的) + 反向评估"这岗位配不配得上求职者"
三、简历修改点：2-4条可执行动作(只关键词对齐/经历重排/亮点前置，绝不编造) + "不用改的"
四、Boss直聘打招呼开场白：一段可直接复制的短消息(第一句锚定开发身份，量化数字前置2-3个，末句用JD原文词汇收口)
五、面试题预测：4-5道按概率排序，附答法要点。必含"离职原因与空窗期口径"(说法必须与画像一致)，"怎么评估效果"类问题要点出评测体系是差异化优势

__RESUME__`;

const REPLY_PROMPT_TPL = `你是求职者的回复起草助手。场景：用户本人（求职者/候选人）在Boss直聘上与HR对话，你起草**用户本人发给HR**的回复。用户提供的【对话记录】来自页面抓取或聊天页截图："HR:"开头是对方（招聘方）说的话，"我:"开头是用户已说过的话，单独成行的 [xxx] 是时间戳或界面元素。

绝对规则（违反任何一条即为失败）：
1. 视角：草稿永远以求职者第一人称写给HR。绝不允许出现招聘方口吻（如"我们在寻找候选人""欢迎了解我们"）。输出前自查：这句话由求职者发给HR是否通顺合理
2. 姓名：称呼只允许使用"对方称呼"字段或对话记录中真实出现的名字/称呼；没有就完全不称呼，禁止编造或猜测姓名
3. 防编造：若对话记录为空、过短、或明显不是真实对话（例如只有岗位信息、按钮文字、推荐卡片、乱码），只输出一行：【抓取失败】请滚动加载完整对话后重试。此情况下禁止生成任何回复内容
4. 杂讯：记录可能夹杂界面文字（发简历/换电话/推荐语等），一律忽略，只围绕 HR: 开头的真实消息作答；若记录中找不到HR提出的真实问题或话题，按第3条处理
5. 内容：回复必须直接回应HR最新一条真实消息的内容，禁止输出与对话无关的泛泛之谈
6. 不编造画像之外的经历/技能/数字；技术类问题不给成品答案冒充用户水平，只给"答题要点框架+画像中真实项目锚点"

正常情况下输出格式（中文，每版草稿≤90字，口语化短句，禁止AI腔：不用排比、不用"首先其次"、不过度谦辞）：
【抓取确认】对方称呼 + HR最新消息的一句话转述
【HR意图】一句话判断对方想要什么
【版本一·推进型】
...
【版本二·稳缓型】
...
【若被追问技术】答题要点框架（仅当HR消息涉及技术问题才有此节，否则省略）
【建议你反问】一条能推进对话/展示思考的问题
【发送提醒】一句风险提示，没有就写"无"

__RESUME__`;

// ===== 简历来源：优先用用户上传/编辑的简历，缺省回落内置画像（v1.6）=====
async function getResume() {
  const { resumeText } = await chrome.storage.local.get("resumeText");
  return (resumeText && resumeText.trim()) || RESUME_PROFILE.trim();
}
function withResume(tpl, resume) {
  return tpl.replace("__RESUME__", resume);
}

// 把简历原文提炼成结构化画像（供「AI 提炼成画像」按钮用）
const EXTRACT_PROMPT = `把下面的简历原文提炼成求职辅助用的【求职者画像】。保留全部关键事实与量化数字，禁止编造、禁止改动数字，输出纯文本：
【求职者画像】
- 学历（毕业年份/学校/专业）；最近一段工作：公司+职位+起止时间+在职状态
- 定位：方向、经验年限、最硬的能力标签
- 技能：分号分隔，只保留简历中真实出现的
- 量化项目：1)2)3) 项目名(关键技术, 量化成果)
- 市场短板：仅从简历事实可推导的客观短板（如 title 与目标岗位不符、非科班、年限短），不确定就不写
- 求职偏好：原文有城市/薪资/方向就保留，没有写"未提及"
只输出画像本身，不要任何解释。`;

// ===== 简历文件解析（v1.6）：PDF 用内置 pdf.js；Word 用浏览器自带解压能力读 document.xml；txt/md 直读 =====
async function parseResumeFile(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return parsePdf(file);
  if (n.endsWith(".docx")) return parseDocx(file);
  return await file.text();
}

async function parsePdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF 解析库未安装（扩展文件夹缺 pdf.min.js / pdf.worker.min.js）");
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      const s = it.str || "";
      if (!s.trim()) continue;
      items.push({ s, x: it.transform[4], y: it.transform[5], w: it.width || 0 });
    }
    // 关键：PDF 的文字流顺序 ≠ 阅读顺序（简历常用文本框排版，直接读会从项目描述开始）。
    // 按视觉坐标重排：先纵坐标从上到下，行内横坐标从左到右；
    // 只有当相邻文字块之间真有横向空隙时才补空格，否则直接拼接（防止"高 宗""A gent"这种断裂）
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    let line = "", lastY = null, prev = null;
    for (const o of items) {
      if (lastY !== null && Math.abs(o.y - lastY) > 2.5) { out += line + "\n"; line = ""; prev = null; }
      if (prev && o.x - (prev.x + prev.w) > 1.5) line += " ";
      line += o.s;
      prev = o; lastY = o.y;
    }
    out += line + "\n";
  }
  return out.replace(/�/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function parseDocx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xml = await readZipEntry(bytes, "word/document.xml");
  if (!xml) throw new Error("Word 文件里没找到正文（document.xml）");
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 从 zip 里取一个文件的文本：读中央目录定位，用 DecompressionStream 解 deflate
async function readZipEntry(bytes, wantName) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 66000);
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 Word（zip）文件");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wantName) {
      if (dv.getUint32(localOff, true) !== 0x04034b50) throw new Error("zip 结构异常");
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const data = bytes.subarray(start, start + compSize);
      if (method === 0) return new TextDecoder().decode(data);
      if (method !== 8) throw new Error("不支持的压缩方式，请另存为 PDF 或 txt 再传");
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// 截图识别专用提示词（v1.4 起为兜底路线；截图已预裁剪提高分辨率）
const VISION_CHAT_PROMPT = `这是Boss直聘聊天页截图（已裁掉左侧会话列表与底部输入框）。对话面板顶部标题栏有对方称呼（如"冯女士"）；面板内左侧气泡是HR发出的消息，右侧气泡是求职者本人已发送的消息。
称呼只允许使用标题栏里真实出现的名字，禁止编造或引用其他来源的名字。
只有当图中连一条气泡文字都辨认不出时，才输出一行【抓取失败】；否则必须按系统提示词给出草稿。`;

// ===== 模型供应商预设（v1.5）：全部走 OpenAI 兼容格式，换供应商不用改代码 =====
const PROVIDERS = {
  zhipu: { label: "智谱 GLM", base: "https://open.bigmodel.cn/api/paas/v4", text: "glm-4-flash", vision: "glm-4v-flash", hint: "open.bigmodel.cn 注册创建 Key；glm-4-flash / glm-4v-flash 免费" },
  deepseek: { label: "DeepSeek", base: "https://api.deepseek.com/v1", text: "deepseek-chat", vision: "", hint: "platform.deepseek.com，按量计费、价格很低；暂无视觉模型" },
  qwen: { label: "通义千问", base: "https://dashscope.aliyuncs.com/compatible-mode/v1", text: "qwen-plus", vision: "qwen-vl-plus", hint: "阿里云百炼（bailian.console.aliyun.com）开通 DashScope 后创建 Key" },
  kimi: { label: "Kimi 月之暗面", base: "https://api.moonshot.cn/v1", text: "moonshot-v1-8k", vision: "", hint: "platform.moonshot.cn；暂无视觉模型" },
  siliconflow: { label: "硅基流动", base: "https://api.siliconflow.cn/v1", text: "deepseek-ai/DeepSeek-V3", vision: "Qwen/Qwen2.5-VL-7B-Instruct", hint: "cloud.siliconflow.cn，部分小模型免费" },
  custom: { label: "自定义（OpenAI 兼容）", base: "", text: "", vision: "", hint: "填任意 OpenAI 兼容地址（如各类中转站），保存时会自动申请该域名的访问权限" },
};

// ===== 页面抓取函数（注入到岗位页执行）=====
function extractJob() {
  const pick = (sels) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.innerText && el.innerText.trim()) return el.innerText.trim();
    }
    return "";
  };
  const title = pick([".job-banner .name", ".job-primary .name", ".job-name", "h1"]);
  const salary = pick([".job-banner .salary", ".job-primary .salary", ".salary"]);
  const meta = pick([".job-banner .job-info", ".job-primary .info", ".filter-labels"]).slice(0, 200);
  const company = pick([".company-info .name", ".job-sider .name", ".company-name"]);
  const jd = pick([
    ".job-sec", ".job-detail-section", ".detail-content",
    ".job-sec-text", ".job-detail", "[class*='job-detail']",
  ]).slice(0, 8000);
  return { title, salary, meta, company, jd, page: document.title.slice(0, 100) };
}

// ===== 聊天抓取 v1.4（结构级排除会话列表 + 几何定位 + 头部锚定称呼）=====
// 诊断实锤（v1.3.1 诊断按钮导出的真实数据）：
//  1) 页面上所有"X女士/X先生"称呼全部来自左侧会话列表，结构链 .chat-user.v2 →
//     抓错人（祝先生）的一切根源就是它。按类名整棵子树剔除，比任何可见性启发式可靠
//  2) 聊天面板顶部的称呼标题不是叶子元素（含公司名等子元素），纯叶子扫描会漏掉
//     ——称呼扫描必须允许非叶子，取以称呼开头的最内层元素
//  3) 消息区定位：气泡左右分布（HR 左/我 右），祖先爬升计分；需穿透 Shadow DOM 和 iframe
function extractChat() {
  // 0) 深度收集所有元素（穿透 Shadow DOM）
  const allEls = [];
  const shadowSet = new Set();
  (function walk(root, inShadow) {
    let l;
    try { l = root.querySelectorAll("*"); } catch (e) { return; }
    for (const e of l) {
      allEls.push(e);
      if (inShadow) shadowSet.add(e);
      if (e.shadowRoot) walk(e.shadowRoot, true);
    }
  })(document);

  // 真实渲染检查
  const isRendered = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity || "1") === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
    return true;
  };

  // v1.4 核心：左侧会话列表整棵子树剔除（祝先生问题的唯一来源）
  const inSidebar = (el) => {
    try { return !!el.closest(".chat-user, .user-list-content, .friend-content-warp"); }
    catch (e) { return false; }
  };

  // 命中测试：中心点最顶层元素必须与目标相关；返回 null（坐标异常等）视为通过，不误杀
  const hitTest = (el) => {
    if (shadowSet.has(el)) return true;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return true;
    const cx = Math.max(1, Math.min(r.left + r.width / 2, innerWidth - 1));
    const cy = Math.max(1, Math.min(r.top + r.height / 2, innerHeight - 1));
    let top;
    try { top = document.elementFromPoint(cx, cy); } catch (e) { return true; }
    if (!top) return true;
    return top === el || el.contains(top) || top.contains(el);
  };

  // 1) 可视区内的叶子文本块（先剔除会话列表子树）
  const leaves = [];
  for (const e of allEls) {
    if (e.children.length > 0) continue;
    if (inSidebar(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 30 || r.height < 10) continue;
    if (r.top < 40 || r.bottom > innerHeight - 60 || r.left < 0 || r.right > innerWidth) continue;
    const t = (e.innerText || "").trim();
    if (!t || t.length > 400) continue;
    if (!isRendered(e) || !hitTest(e)) continue;
    leaves.push(e);
  }

  // 2) 祖先爬升计分选消息容器：左右两侧都有气泡 +25，全挤一侧 -10
  const score = new Map();
  for (const el of leaves) {
    let p = el.parentElement;
    for (let d = 0; p && d < 14; d++, p = p.parentElement) {
      const pr = p.getBoundingClientRect();
      if (pr.width < 320 || pr.height < 100) continue;
      if (!score.has(p)) score.set(p, { n: 0, left: 0, right: 0 });
      const s = score.get(p);
      const lr = el.getBoundingClientRect();
      const cx = lr.left + lr.width / 2;
      const mid = pr.left + pr.width / 2;
      if (cx < mid - 20) s.left++;
      else if (cx > mid + 20) s.right++;
      s.n++;
    }
  }
  const scoreOf = (s) =>
    Math.min(s.n, 80) + (s.left >= 2 && s.right >= 2 ? 25 : 0) - (s.left === 0 || s.right === 0 ? 10 : 0);
  let list = null, best = 0;
  for (const [p, s] of score) {
    const v = scoreOf(s);
    if (v > best) { best = v; list = p; }
  }
  if (list) {
    // 同分段内取面积更小的容器：防止外层面板把头部/输入框文字一起吞进消息行
    let area = list.getBoundingClientRect().width * list.getBoundingClientRect().height;
    for (const [p, s] of score) {
      if (scoreOf(s) >= best - 4) {
        const a = p.getBoundingClientRect().width * p.getBoundingClientRect().height;
        if (a < area) { area = a; list = p; }
      }
    }
  }

  const msgs = [];
  let friend = "", job = "";

  if (list) {
    const cr = list.getBoundingClientRect();
    const mid = cr.left + cr.width / 2;

    // 3a) 称呼与岗位：消息区正上方 200px 内、水平重叠的头部文本。
    // 允许非叶子（诊断证明面板顶部称呼块含公司名等子元素，纯叶子扫描会漏），
    // 必须以称呼/薪资开头，排除会话列表，同分取最内层（面积最小）元素
    const heads = [];
    for (const e of allEls) {
      if (inSidebar(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.top > cr.top + 6 || r.top < cr.top - 200) continue;
      if (r.width < 20 || r.height < 8) continue;
      if (r.right < cr.left - 40 || r.left > cr.right + 40) continue;
      const t = (e.innerText || "").trim();
      if (!t || t.length > 60) continue;
      const isName = /^\s*[一-龥A-Za-z0-9]{1,8}(女士|先生|老师)/.test(t);
      const isJob = /\d{1,2}-\d{1,3}K/.test(t) && t.length <= 40;
      if (!isName && !isJob) continue;
      if (!isRendered(e) || !hitTest(e)) continue;
      heads.push({ t: t.replace(/\s+/g, " "), area: r.width * r.height });
    }
    heads.sort((a, b) => a.area - b.area);
    for (const h of heads) {
      const m = h.t.match(/[一-龥]{1,3}(?:女士|先生|老师)/);
      if (m && !friend) friend = m[0];
      const j = h.t.match(/[一-龥A-Za-z0-9+/· ]*\d{1,2}-\d{1,3}K/);
      if (j && !job) job = h.t.slice(0, 80);
    }

    // 3b) 消息行：几何包含 + 真实渲染，按纵向排序、横向位置定说话人
    const rows = [];
    for (const e of allEls) {
      if (e.children.length > 0) continue;
      const r = e.getBoundingClientRect();
      if (r.height < 8 || r.width < 20) continue;
      if (r.top < cr.top - 2 || r.bottom > cr.bottom + 2 || r.left < cr.left - 2 || r.right > cr.right + 2) continue;
      const t = (e.innerText || "").trim();
      if (!t || t.length > 500) continue;
      if (!isRendered(e) || !hitTest(e)) continue;
      rows.push({ t: t.replace(/\s+/g, " "), cx: r.left + r.width / 2, top: r.top });
    }
    rows.sort((a, b) => a.top - b.top);
    for (const x of rows.slice(-60)) {
      const isCenter = Math.abs(x.cx - mid) < 30 && x.t.length <= 20;
      if (isCenter) msgs.push(/\d{1,2}:\d{2}/.test(x.t) ? `[${x.t}]` : `[界面:${x.t}]`);
      else msgs.push(`${x.cx < mid ? "HR" : "我"}: ${x.t}`);
    }
  }

  return { friend: friend || "", jobInChat: job || "", history: msgs.join("\n").slice(-4000), msgCount: msgs.length, page: document.title.slice(0, 100) };
}

// ===== 诊断模式（v1.3.1）：导出页面所有"X女士/X先生"元素的可见性状态 + 12级祖先类名链，
// 便于按真实结构写精确选择器（F12 打不开时用这个内置采集）=====
function debugChat() {
  const allEls = [];
  (function walk(root) {
    let l;
    try { l = root.querySelectorAll("*"); } catch (e) { return; }
    for (const e of l) { allEls.push(e); if (e.shadowRoot) walk(e.shadowRoot); }
  })(document);

  const chainOf = (el, n) => {
    const parts = [];
    let p = el;
    for (let i = 0; p && i < n; i++, p = p.parentElement) {
      const c = (typeof p.className === "string" && p.className.trim())
        ? "." + p.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
      parts.push(p.tagName.toLowerCase() + c);
    }
    return parts.join(" < ");
  };

  const names = [];
  const seen = new Set();
  for (const e of allEls) {
    if (e.children.length > 0) continue;
    const t = (e.innerText || "").trim();
    if (t.length > 60) continue;
    const m = t.match(/[一-龥]{1,3}(?:女士|先生|老师)/);
    if (!m) continue;
    const r = e.getBoundingClientRect();
    const key = m[0] + "|" + Math.round(r.top) + "|" + Math.round(r.left);
    if (seen.has(key)) continue;
    seen.add(key);
    const cs = getComputedStyle(e);
    const cx = Math.max(1, Math.min(r.left + r.width / 2, innerWidth - 1));
    const cy = Math.max(1, Math.min(r.top + r.height / 2, innerHeight - 1));
    let top = null;
    try { top = document.elementFromPoint(cx, cy); } catch (err) {}
    names.push(
      `${m[0]} rect=[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] ` +
      `disp=${cs.display} vis=${cs.visibility} op=${cs.opacity} hit=${top ? (top === e || e.contains(top) || top.contains(e)) : "null"}\n` +
      `    ${chainOf(e, 12)}`
    );
  }

  return { url: location.href.slice(0, 90), nameCount: names.length, names: names.join("\n") };
}

// ===== UI 逻辑 =====
const $ = (id) => document.getElementById(id);
const statusEl = $("status"), resultEl = $("result");
const statusEl2 = $("status2"), resultEl2 = $("result2");
const statusEl3 = $("status3");
const statusEl4 = $("status4");

// 标签切换（三个标签）
const TABS = [["tabAnalyze", "modeAnalyze"], ["tabReply", "modeReply"], ["tabSettings", "modeSettings"]];
for (const [tid, mid] of TABS) {
  $(tid).onclick = () => {
    for (const [t2, m2] of TABS) {
      $(t2).classList.toggle("active", t2 === tid);
      $(m2).classList.toggle("hidden", m2 !== mid);
    }
  };
}

// ===== 模型配置（设置页，v1.5） =====
const provSel = $("provSel");
for (const [id, p] of Object.entries(PROVIDERS)) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = p.label;
  provSel.appendChild(opt);
}

function fillCfgForm(cfg) {
  provSel.value = cfg.provider || "zhipu";
  $("cfgBase").value = cfg.base || "";
  $("cfgKey").value = cfg.key || "";
  $("cfgText").value = cfg.textModel || "";
  $("cfgVision").value = cfg.visionModel || "";
  $("provHint").textContent = (PROVIDERS[provSel.value] || {}).hint || "";
}

provSel.onchange = () => {
  const p = PROVIDERS[provSel.value] || {};
  $("cfgBase").value = p.base || "";
  $("cfgText").value = p.text || "";
  $("cfgVision").value = p.vision || "";
  $("cfgKey").value = ""; // 换供应商必须换 Key，防止拿 A 家的 Key 调 B 家
  $("provHint").textContent = p.hint || "";
};

async function getCfg() {
  const { providerConfig } = await chrome.storage.local.get("providerConfig");
  const cfg = providerConfig || {};
  if (!cfg.base || !cfg.key || !cfg.textModel) {
    statusEl.textContent = "请先到「设置」标签配置模型供应商并保存。";
    return null;
  }
  return cfg;
}

$("saveCfg").onclick = async () => {
  const base = $("cfgBase").value.trim().replace(/\/+$/, "");
  const key = $("cfgKey").value.trim();
  const textModel = $("cfgText").value.trim();
  const visionModel = $("cfgVision").value.trim();
  if (!base || !key || !textModel) {
    statusEl3.textContent = "API 地址、Key、文本模型三项必填。";
    return;
  }
  let u;
  try { u = new URL(base); } catch (e) { statusEl3.textContent = "API 地址格式不对，要带 https:// 前缀。"; return; }
  // 预设之外的域名：动态申请跨域访问权限（自定义中转站用）
  try {
    const origin = u.origin + "/*";
    const have = await chrome.permissions.contains({ origins: [origin] });
    if (!have) await chrome.permissions.request({ origins: [origin] });
  } catch (e) { /* 预设域名已在 manifest 里，忽略 */ }
  await chrome.storage.local.set({ providerConfig: { provider: provSel.value, base, key, textModel, visionModel } });
  statusEl3.textContent = `已保存：${(PROVIDERS[provSel.value] || {}).label || "自定义"} · ${textModel}`;
};

$("testCfg").onclick = async () => {
  statusEl3.textContent = "测试中…";
  const base = $("cfgBase").value.trim().replace(/\/+$/, "");
  const key = $("cfgKey").value.trim();
  const model = $("cfgText").value.trim();
  if (!base || !key || !model) { statusEl3.textContent = "先填好 API 地址、Key、文本模型再测试。"; return; }
  try {
    const resp = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "只回复两个字：通了" }], max_tokens: 8, temperature: 0 }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}：${(await resp.text()).slice(0, 160)}`);
    const j = await resp.json();
    const reply = (j.choices?.[0]?.message?.content || "").trim().slice(0, 30);
    statusEl3.textContent = `通了！模型 ${model} 应答：${reply || "(空)"}`;
  } catch (e) {
    statusEl3.textContent = "测试失败：" + (e.message || e);
  }
};

// ===== 简历上传与保存（v1.6）=====
const resumeFile = $("resumeFile");
$("resumeFileBtn").onclick = () => resumeFile.click();

resumeFile.onchange = async () => {
  const f = resumeFile.files && resumeFile.files[0];
  if (!f) return;
  statusEl4.textContent = `正在解析 ${f.name}…`;
  try {
    const text = (await parseResumeFile(f)).trim();
    if (text.length < 30) throw new Error("几乎没解析出文字，可能是扫描件/图片版简历");
    $("resumeText").value = text;
    statusEl4.textContent = `已解析 ${f.name}（${text.length} 字）。确认无误后点「保存简历」生效。`;
  } catch (e) {
    statusEl4.textContent = "解析失败：" + (e.message || e) + "——可把简历文字直接粘贴到上面的框里。";
  } finally {
    resumeFile.value = "";
  }
};

$("resumeAiBtn").onclick = async () => {
  const raw = $("resumeText").value.trim();
  if (raw.length < 30) { statusEl4.textContent = "先上传或粘贴简历内容，再点提炼。"; return; }
  const cfg = await getCfg();
  if (!cfg) { statusEl4.textContent = "请先在上面配置好模型并保存，再点提炼。"; return; }
  statusEl4.textContent = `AI 提炼中（${cfg.textModel}）…`;
  try {
    const out = await callGLM(cfg, cfg.textModel, [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: raw.slice(0, 12000) },
    ]);
    $("resumeText").value = out.trim();
    statusEl4.textContent = "已提炼成结构化画像。核对一下数字无误后点「保存简历」。";
  } catch (e) {
    statusEl4.textContent = "提炼失败：" + (e.message || e);
  }
};

$("resumeSave").onclick = async () => {
  const t = $("resumeText").value.trim();
  if (t.length < 30) { statusEl4.textContent = "内容太短，先上传或粘贴完整简历。"; return; }
  await chrome.storage.local.set({ resumeText: t });
  statusEl4.textContent = `已保存（${t.length} 字）。之后所有分析都以这份简历为准。`;
};

$("resumeReset").onclick = async () => {
  await chrome.storage.local.remove("resumeText");
  $("resumeText").value = RESUME_PROFILE.trim();
  statusEl4.textContent = "已恢复内置默认画像。";
};

async function callGLM(cfg, model, messages) {
  const resp = await fetch(cfg.base.replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`API ${resp.status}：${t.slice(0, 200)}`);
  }
  const j = await resp.json();
  return j.choices?.[0]?.message?.content || "(模型无返回)";
}

// 裁剪截图：去掉左侧会话列表/顶部导航/底部输入框，提高视觉模型的有效分辨率
async function cropRegion(dataUrl, f) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("截图解码失败"));
    i.src = dataUrl;
  });
  const w = img.naturalWidth, h = img.naturalHeight;
  const sx = Math.round(w * (f.left || 0)), sy = Math.round(h * (f.top || 0));
  const sw = Math.round(w * (1 - (f.left || 0) - (f.right || 0)));
  const sh = Math.round(h * (1 - (f.top || 0) - (f.bottom || 0)));
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL("image/jpeg", 0.92);
}

// ==================== 岗位分析 ====================
$("analyze").onclick = async () => {
  const cfg = await getCfg();
  if (!cfg) return;
  const resume = await getResume();
  $("analyze").disabled = true;
  resultEl.style.display = "none";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("zhipin.com")) {
      statusEl.textContent = "当前标签页不是 Boss直聘，识别效果会差。";
    } else {
      statusEl.textContent = "正在抓取页面内容…";
    }

    const [inj] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJob,
    });
    const data = inj.result || {};
    let messages, model;

    if ((data.jd || "").length >= 80) {
      model = cfg.textModel;
      messages = [
        { role: "system", content: withResume(ANALYZE_PROMPT_TPL, resume) },
        { role: "user", content:
          `岗位：${data.title || "未知"}｜${data.salary || "薪资未知"}｜${data.company || "公司未知"}｜${data.meta || ""}\n` +
          `页面标题：${data.page}\n\nJD 内容：\n${data.jd}` },
      ];
    } else if (cfg.visionModel) {
      statusEl.textContent = "页面文本抓取不足，改用截屏+视觉模型…";
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 88 });
      model = cfg.visionModel;
      messages = [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: "这是 Boss直聘岗位详情页截图，请先转述岗位名/薪资/公司，然后按五件套分析。" },
        ],
      }];
    } else {
      statusEl.textContent = "页面文本抓取不足，且「设置」里没配视觉模型——请补一个视觉模型或换供应商（智谱 glm-4v-flash 免费）。";
      return;
    }

    statusEl.textContent = `分析中（${(PROVIDERS[cfg.provider] || {}).label || "自定义"} · ${model}），约需 10-30 秒…`;
    const answer = await callGLM(cfg, model, messages);
    resultEl.textContent = answer;
    resultEl.style.display = "block";
    $("copyBtn").style.display = "inline-block";
    statusEl.textContent = "完成。";

    // 缓存分析结论，供回复助手关联岗位
    if (data.title) {
      const { jdCache = {} } = await chrome.storage.local.get("jdCache");
      const k = data.title.split("\n")[0].slice(0, 40);
      jdCache[k] = {
        title: k, salary: data.salary, company: data.company,
        jd: (data.jd || "").slice(0, 1500), ts: Date.now(),
      };
      const entries = Object.entries(jdCache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 50);
      await chrome.storage.local.set({ jdCache: Object.fromEntries(entries) });
    }
  } catch (e) {
    statusEl.textContent = "出错：" + (e.message || e) + "（若反复失败，可提 issue 反馈）";
  } finally {
    $("analyze").disabled = false;
  }
};

$("copyBtn").onclick = async () => {
  await navigator.clipboard.writeText(resultEl.textContent);
  statusEl.textContent = "结果已复制到剪贴板。";
};

// ==================== 回复助手 ====================
$("genReply").onclick = async () => {
  const cfg = await getCfg();
  if (!cfg) return;
  const resume = await getResume();
  $("genReply").disabled = true;
  resultEl2.style.display = "none";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("zhipin.com")) {
      statusEl2.textContent = "请在 Boss直聘的聊天页使用。";
      return;
    }
    // v1.4：DOM 回归主路线——诊断实锤抓错人的唯一来源是左侧会话列表（.chat-user），
    // 已在 extractChat 里整棵子树结构级剔除，无需再靠截图绕道
    statusEl2.textContent = "正在抓取对话（结构级排除会话列表）…";

    // 注入所有 frame（聊天区可能是 iframe），挑结果最好的一个
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: extractChat,
    });
    let data = null, bestQ = -1;
    for (const inj of results || []) {
      const d = inj.result;
      if (!d) continue;
      const hr = (d.history || "").split("\n").filter((l) => l.startsWith("HR:")).length;
      const q = hr * 10 + d.msgCount;
      if (q > bestQ) { bestQ = q; data = d; }
    }

    const hrLines = data ? (data.history || "").split("\n").filter((l) => l.startsWith("HR:")).length : 0;

    // 兜底路线：DOM 没拿到有效对话 → 整页截图（预裁剪）+ 视觉模型
    if (!data || data.msgCount < 4 || hrLines < 1) {
      if (!cfg.visionModel) {
        statusEl2.textContent =
          "文本抓取不足，且「设置」里没配视觉模型（截图兜底不可用）。请补一个视觉模型（智谱 glm-4v-flash 免费），或把聊天页截图发到 issue 反馈。";
        return;
      }
      statusEl2.textContent = "文本抓取不足，自动改用整页截图+视觉模型…";
      let shot = null;
      try {
        shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 92 });
        try { shot = await cropRegion(shot, { left: 0.3, top: 0.08, bottom: 0.24 }); } catch (cropErr) { /* 裁剪失败用原图 */ }
      } catch (capErr) {
        statusEl2.textContent =
          "文本和截屏都不可用（" + (capErr.message || capErr) + "）。请重试；仍失败可提 issue 反馈。";
        return;
      }
      const vAnswer = await callGLM(cfg, cfg.visionModel, [
        { role: "system", content: withResume(REPLY_PROMPT_TPL, resume) },
        { role: "user", content: [
          { type: "image_url", image_url: { url: shot } },
          { type: "text", text: VISION_CHAT_PROMPT },
        ] },
      ]);
      if (vAnswer.includes("【抓取失败】")) {
        statusEl2.textContent =
          "截图也辨认不出对话：请把想让我看到的对话滚动到屏幕内再点一次；仍失败可提 issue 反馈。";
        return;
      }
      resultEl2.textContent = vAnswer;
      resultEl2.style.display = "block";
      $("copyBtn2").style.display = "inline-block";
      statusEl2.textContent = `完成（${cfg.visionModel} · 截图模式）。草稿仅供参考，发送前请过目。`;
      return;
    }

    statusEl2.textContent =
      `已抓取 ${data.msgCount} 行（HR 消息 ${hrLines} 行）${data.friend ? "，对方：" + data.friend : ""}。生成回复中…`;

    // 自动关联已分析过的岗位 JD
    let jdCtx = "（未匹配到该岗位的 JD 分析，仅基于对话上下文）";
    const { jdCache = {} } = await chrome.storage.local.get("jdCache");
    const keyJob = data.jobInChat || "";
    const hit = Object.values(jdCache).find(
      (v) => keyJob && (keyJob.includes(v.title) || v.title.includes(keyJob.split(/[\s　]/)[0]))
    );
    if (hit) {
      jdCtx = `关联岗位：${hit.title}｜${hit.salary || ""}｜${hit.company || ""}\n该岗位 JD 摘要：${hit.jd}`;
    }

    const answer = await callGLM(cfg, cfg.textModel, [
      { role: "system", content: withResume(REPLY_PROMPT_TPL, resume) },
      { role: "user", content:
        `对方称呼：${data.friend || "（未知，禁止称呼）"}｜对方页头岗位：${keyJob || "未知"}\n${jdCtx}\n\n【对话记录】\n${data.history}` },
    ]);
    resultEl2.textContent = answer;
    resultEl2.style.display = "block";
    $("copyBtn2").style.display = "inline-block";
    statusEl2.textContent = `完成（${cfg.textModel}）。草稿仅供参考，发送前请过目——技术问题建议按框架自己作答。`;
  } catch (e) {
    statusEl2.textContent = "出错：" + (e.message || e) + "（若反复失败，可提 issue 反馈）";
  } finally {
    $("genReply").disabled = false;
  }
};

$("copyBtn2").onclick = async () => {
  await navigator.clipboard.writeText(resultEl2.textContent);
  statusEl2.textContent = "已复制。";
};

// 诊断按钮：导出称呼元素的结构信息（便于定位抓取问题）
$("dbg").onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("zhipin.com")) {
      statusEl2.textContent = "请先打开 Boss直聘聊天页再点「诊断」。";
      return;
    }
    statusEl2.textContent = "诊断中…";
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: debugChat,
    });
    let best = null;
    for (const inj of results || []) {
      const d = inj.result;
      if (!d) continue;
      if (!best || d.nameCount > best.nameCount) best = d;
    }
    if (!best || !best.nameCount) {
      resultEl2.textContent = "诊断：当前页面没找到任何「X女士/X先生」文本。若你确实在聊天页，请把这个情况提 issue 反馈。";
    } else {
      resultEl2.textContent =
        `frame: ${best.url}\n共发现称呼元素 ${best.nameCount} 处：\n\n${best.names}`;
    }
    resultEl2.style.display = "block";
    $("copyBtn2").style.display = "inline-block";
    statusEl2.textContent = "诊断完成：点「复制结果」，把内容粘贴到 issue 里。";
  } catch (e) {
    statusEl2.textContent = "诊断出错：" + (e.message || e);
  }
};

// 启动时：加载模型配置（老版本单 Key 自动迁移为智谱配置）+ 简历 + PDF 解析器
(async () => {
  // PDF 解析：worker 指向扩展内置文件（MV3 不允许远程加载脚本，必须打包）
  try {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
    }
  } catch (e) { /* 无 pdf.js 时 PDF 上传会给出提示 */ }

  const { providerConfig, apiKey, resumeText } = await chrome.storage.local.get(["providerConfig", "apiKey", "resumeText"]);
  $("resumeText").value = (resumeText && resumeText.trim()) || RESUME_PROFILE.trim();
  if (!window.pdfjsLib) {
    statusEl4.innerHTML = "提示：PDF 解析库文件缺失（pdf.min.js / pdf.worker.min.js 应随扩展一起放在文件夹里），PDF 上传暂不可用，txt / Word 正常。";
  } else if (resumeText && resumeText.trim()) {
    statusEl4.textContent = `当前使用你保存的简历（${resumeText.trim().length} 字）。`;
  }

  if (!providerConfig) {
    if (apiKey) {
      const cfg = { provider: "zhipu", base: PROVIDERS.zhipu.base, key: apiKey, textModel: PROVIDERS.zhipu.text, visionModel: PROVIDERS.zhipu.vision };
      await chrome.storage.local.set({ providerConfig: cfg });
      fillCfgForm(cfg);
      return;
    }
    fillCfgForm({ provider: "zhipu", base: PROVIDERS.zhipu.base, key: "", textModel: PROVIDERS.zhipu.text, visionModel: PROVIDERS.zhipu.vision });
    return;
  }
  fillCfgForm(providerConfig);
})();
