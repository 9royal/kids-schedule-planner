@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js or open this project in Codex.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run pnpm install first.
  pause
  exit /b 1
)
echo Starting Kids Schedule Planner at the Local URL shown below...
node "node_modules\vite\bin\vite.js" --host 127.0.0.1
