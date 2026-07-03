$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = if ($env:PORT) { $env:PORT } else { "8790" }
$Url = "http://127.0.0.1:$Port"
$NodeExe = Join-Path $AppDir "tools\node\node.exe"
$PythonExe = Join-Path $AppDir "tools\python-venv\Scripts\python.exe"
$FfmpegExe = Join-Path $AppDir "tools\ffmpeg\bin\ffmpeg.exe"
$SetupScript = Join-Path $AppDir "setup-local-tools.bat"

Set-Location $AppDir

# ── Pre-flight: check all critical tools before starting ──────────────────────
$MissingTools = @()

if (-not (Test-Path $NodeExe)) {
  $MissingTools += "Node.js"
}
if (-not (Test-Path $FfmpegExe)) {
  $MissingTools += "FFmpeg"
}
if (-not (Test-Path $PythonExe)) {
  $MissingTools += "Python"
}

if ($MissingTools.Count -gt 0) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  環境工具尚未安裝完成" -ForegroundColor Red
  Write-Host "  Missing tools: $($MissingTools -join ', ')" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "請先執行安裝腳本來安裝所需工具：" -ForegroundColor White
  Write-Host ""
  Write-Host "  $SetupScript" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "或直接在檔案總管中雙擊 setup-local-tools.bat" -ForegroundColor White
  Write-Host ""
  Write-Host "安裝完成後，再次執行 start-offline-subtitle-factory.ps1 即可。" -ForegroundColor White
  Write-Host ""
  Read-Host "按 Enter 離開"
  exit 1
}

# Verify tools are actually runnable
try {
  $nodeVer = & $NodeExe --version 2>&1
  $ffmpegVer = & $FfmpegExe -version 2>&1 | Select-Object -First 1
  $pythonVer = & $PythonExe --version 2>&1
} catch {
  Write-Host ""
  Write-Host "[WARNING] Tool verification failed. Some tools may be corrupted." -ForegroundColor Yellow
  Write-Host "Try running setup-local-tools.bat again." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "按 Enter 離開"
  exit 1
}

Write-Host ""
Write-Host "Starting Offline Subtitle Factory..." -ForegroundColor Cyan
Write-Host "App folder: $AppDir"
Write-Host "Node: $nodeVer"
Write-Host "FFmpeg: $ffmpegVer"
Write-Host "Python: $pythonVer"
Write-Host "URL: $Url"
Write-Host ""

$existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort ([int]$Port) -State Listen -ErrorAction SilentlyContinue
foreach ($connection in $existing) {
  Write-Host "Stopping existing server PID $($connection.OwningProcess) ..." -ForegroundColor Yellow
  Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
}

$env:PATH = "$AppDir\tools\ffmpeg\bin;$AppDir\tools\python-venv\Scripts;$env:PATH"
$env:XDG_CACHE_HOME = Join-Path $AppDir "tools"
$env:WHISPER_CACHE = Join-Path $AppDir "tools\whisper-models"

Start-Process $Url
& $NodeExe server.mjs
