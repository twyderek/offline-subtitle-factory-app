@echo off
setlocal EnableExtensions
set "APP_DIR=%~dp0"
set "PS1=%APP_DIR%scripts\setup-local-tools.ps1"

if not exist "%PS1%" (
  echo [ERROR] Missing setup script: %PS1%
  pause
  exit /b 1
)

echo ========================================
echo Offline Subtitle Factory — Tool Installer
echo ========================================
echo.
echo This script will install:
echo   • Node.js (portable)
echo   • FFmpeg (portable)
echo   • Python venv + openai-whisper
echo.
echo If Python is not installed on your system, you need to install it first:
echo   winget install Python.Python.3.12
echo.
echo The script can be interrupted and re-run safely.
echo Already-installed tools will be skipped.
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
if errorlevel 1 (
  echo.
  echo [WARNING] Setup completed with errors. Some tools may be missing.
  echo Check the messages above for details.
  echo.
  echo You can re-run setup-local-tools.bat to install missing tools.
  pause
  exit /b 0
)

echo.
echo Local tool setup completed.
pause
