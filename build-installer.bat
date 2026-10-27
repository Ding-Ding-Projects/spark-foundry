@echo off
setlocal
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"
set "SILENT=1"
set "RUN_AFTER_BUILD=0"
call "%PROJECT_ROOT%build.bat" /s
if errorlevel 1 exit /b %errorlevel%
if exist "%PROJECT_ROOT%.tools\node\node.exe" set "PATH=%PROJECT_ROOT%.tools\node;%PROJECT_ROOT%.tools\git\cmd;%PATH%"
echo Building unsigned Squirrel.Windows installer. Windows may show an unknown-publisher or SmartScreen warning.
call npm run package:windows
exit /b %errorlevel%
