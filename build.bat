@echo off
setlocal
cd /d "%~dp0"
:args
if "%~1"=="" goto parsed
if /i "%~1"=="/s" set "SILENT=1"
if /i "%~1"=="--silent" set "SILENT=1"
if /i "%~1"=="/run" set "RUN_AFTER_BUILD=1"
if /i "%~1"=="--run" set "RUN_AFTER_BUILD=1"
shift
goto args
:parsed
call "%~dp0download-dependencies.bat" /s
if errorlevel 1 exit /b %errorlevel%
if exist "%~dp0.tools\node\node.exe" set "PATH=%~dp0.tools\node;%~dp0.tools\git\cmd;%PATH%"
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
