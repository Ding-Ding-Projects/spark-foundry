@echo off
setlocal
cd /d "%~dp0"
rem All dependency acquisition is user-scoped and non-interactive, including /s and --silent.
echo Preparing pinned project-local dependencies. No elevation or global PATH change is needed.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" -InstallPackages
exit /b %errorlevel%
