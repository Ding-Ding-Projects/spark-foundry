@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js and run this file again.
  exit /b 1
)
call npm run build
exit /b %errorlevel%
