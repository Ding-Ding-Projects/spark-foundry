@echo off
setlocal
cd /d "%~dp0"
set "SILENT=1"
set "RUN_AFTER_BUILD=0"
call "%~dp0build.bat" /s
if errorlevel 1 exit /b %errorlevel%
if exist "%~dp0.tools\node\node.exe" set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
echo Building unsigned Squirrel.Windows installer. Windows may show an unknown-publisher or SmartScreen warning.
call npm run package:windows
exit /b %errorlevel%
