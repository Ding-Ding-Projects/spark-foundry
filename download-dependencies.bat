@echo off
setlocal
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"
rem All dependency acquisition is user-scoped and non-interactive, including /s and --silent.
echo Preparing pinned project-local dependencies. No elevation or global PATH change is needed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%scripts\bootstrap.ps1" -InstallPackages
exit /b %errorlevel%
