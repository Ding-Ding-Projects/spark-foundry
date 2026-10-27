@echo off
setlocal
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"
:args
if "%~1"=="" goto parsed
if /i "%~1"=="/s" set "SILENT=1"
if /i "%~1"=="--silent" set "SILENT=1"
if /i "%~1"=="/run" set "RUN_AFTER_BUILD=1"
if /i "%~1"=="--run" set "RUN_AFTER_BUILD=1"
shift /1
goto args
:parsed
call "%PROJECT_ROOT%download-dependencies.bat" /s
if errorlevel 1 exit /b %errorlevel%
if exist "%PROJECT_ROOT%.tools\node\node.exe" set "PATH=%PROJECT_ROOT%.tools\node;%PROJECT_ROOT%.tools\git\cmd;%PATH%"
call npm run build
if errorlevel 1 exit /b %errorlevel%
node scripts\package-runnable.mjs
if errorlevel 1 exit /b %errorlevel%
if "%RUN_AFTER_BUILD%"=="1" goto launch
if "%SILENT%"=="1" exit /b 0
choice /m "Build complete. Run Spark Foundry"
if errorlevel 2 exit /b 0
:launch
node scripts\run-built.mjs
exit /b %errorlevel%
