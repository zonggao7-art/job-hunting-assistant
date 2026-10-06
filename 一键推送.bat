@echo off
setlocal
echo ==================================================
echo   Push this project to GitHub
echo ==================================================
echo.
echo Make sure you have created an EMPTY repository on GitHub first.
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed. Get it from https://git-scm.com/download/win
  echo         Or upload the folder manually via the GitHub web UI.
  pause
  exit /b 1
)
set /p REPOURL=Enter repo URL (https://github.com/USER/REPO.git): 
if "%REPOURL%"=="" (
  echo [ERROR] No URL entered.
  pause
  exit /b 1
)
if not exist .git (
  git init
  git branch -M main
)
git add -A
git commit -m "Initial commit: job hunting assistant toolkit"
git remote remove origin >nul 2>nul
git remote add origin %REPOURL%
git push -u origin main
echo.
echo --------------------------------------------------
echo Done. If push failed, check your GitHub login/token.
echo --------------------------------------------------
pause
