@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
set "PORT=8790"
set "URL=http://127.0.0.1:%PORT%"
if not defined OFFLINE_SUBTITLE_TOOLS_DIR set "OFFLINE_SUBTITLE_TOOLS_DIR=%APP_DIR%tools"
set "TOOLS_DIR=%OFFLINE_SUBTITLE_TOOLS_DIR%"
set "NODE_EXE=%TOOLS_DIR%\node\node.exe"
set "PYTHON_EXE="
if exist "%TOOLS_DIR%\python\python.exe" set "PYTHON_EXE=%TOOLS_DIR%\python\python.exe"
if not defined PYTHON_EXE if exist "%TOOLS_DIR%\python-embed\python.exe" set "PYTHON_EXE=%TOOLS_DIR%\python-embed\python.exe"
if not defined PYTHON_EXE if exist "%TOOLS_DIR%\python-venv\Scripts\python.exe" set "PYTHON_EXE=%TOOLS_DIR%\python-venv\Scripts\python.exe"
set "FFMPEG_EXE=%TOOLS_DIR%\ffmpeg\bin\ffmpeg.exe"
set "SETUP_BAT=%APP_DIR%setup-local-tools.bat"
set "SERVER_FILE=%APP_DIR%server.mjs"

cd /d "%APP_DIR%"

:: ── Pre-flight: check all critical tools ─────────────────────────────────────
set "MISSING_TOOLS="

if not exist "%NODE_EXE%" (
  set "MISSING_TOOLS=!MISSING_TOOLS!Node.js "
)
if not exist "%FFMPEG_EXE%" (
  set "MISSING_TOOLS=!MISSING_TOOLS!FFmpeg "
)
if not defined PYTHON_EXE (
  set "MISSING_TOOLS=!MISSING_TOOLS!Python "
)
if defined PYTHON_EXE if not exist "%PYTHON_EXE%" (
  set "MISSING_TOOLS=!MISSING_TOOLS!Python "
)

if defined MISSING_TOOLS (
  echo.
  echo ============================================================
  echo   環境工具尚未安裝完成
  echo   Missing tools: !MISSING_TOOLS!
  echo ============================================================
  echo.
  echo 請先執行安裝腳本來安裝所需工具：
  echo.
  echo   %SETUP_BAT%
  echo.
  echo 或直接在檔案總管中雙擊 setup-local-tools.bat
  echo.
  echo 安裝完成後，再次執行 start-offline-subtitle-factory.bat 即可。
  echo.
  pause
  exit /b 1
)

if not exist "%SERVER_FILE%" (
  echo.
  echo [ERROR] Missing server file:
  echo %SERVER_FILE%
  echo Please restore server.mjs or download the complete app package again.
  echo.
  pause
  exit /b 1
)

echo.
echo Starting Offline Subtitle Factory...
echo App folder: %APP_DIR%
echo URL: %URL%
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr "127.0.0.1:%PORT%" ^| findstr "LISTENING"') do (
  echo Stopping existing server on port %PORT% ...
  taskkill /PID %%P /F >nul 2>nul
)

for %%I in ("%FFMPEG_EXE%") do set "FFMPEG_DIR=%%~dpI"
for %%I in ("%PYTHON_EXE%") do set "PYTHON_DIR=%%~dpI"
set "PATH=%FFMPEG_DIR%;%PYTHON_DIR%;%PATH%"
set "XDG_CACHE_HOME=%TOOLS_DIR%"
set "WHISPER_CACHE=%TOOLS_DIR%\whisper-models"
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

start "" "%URL%"
"%NODE_EXE%" "%SERVER_FILE%"

echo.
echo Server stopped.
pause
