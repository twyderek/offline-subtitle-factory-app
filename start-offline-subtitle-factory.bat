@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
set "PORT=8790"
set "URL=http://127.0.0.1:%PORT%"
set "NODE_EXE=%APP_DIR%tools\node\node.exe"
set "PYTHON_EXE=%APP_DIR%tools\python-venv\Scripts\python.exe"
set "FFMPEG_EXE=%APP_DIR%tools\ffmpeg\bin\ffmpeg.exe"
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
if not exist "%PYTHON_EXE%" (
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

set "PATH=%APP_DIR%tools\ffmpeg\bin;%APP_DIR%tools\python-venv\Scripts;%PATH%"
set "XDG_CACHE_HOME=%APP_DIR%tools"
set "WHISPER_CACHE=%APP_DIR%tools\whisper-models"

start "" "%URL%"
"%NODE_EXE%" "%SERVER_FILE%"

echo.
echo Server stopped.
pause
