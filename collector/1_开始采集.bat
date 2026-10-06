@echo off
echo Starting collector (a Chrome window will pop up)...
echo First time: log in to Bosszhipin in that window, then browse jobs as usual.
echo Results are saved to: your Desktop\boss_jobs
echo Override with BOSS_JOBS_DIR if you want another location.
echo Press Ctrl+C to stop.
echo.
python "%~dp0boss_jd_collector.py"
pause
