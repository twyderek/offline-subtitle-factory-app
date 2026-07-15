$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = if ($env:PORT) { $env:PORT } else { "8790" }
$Url = "http://127.0.0.1:$Port"
$ToolsDir = if ($env:OFFLINE_SUBTITLE_TOOLS_DIR) { [System.IO.Path]::GetFullPath($env:OFFLINE_SUBTITLE_TOOLS_DIR) } else { Join-Path $AppDir "tools" }
$SetupScript = Join-Path $AppDir "setup-local-tools.bat"

Set-Location $AppDir

function First-Existing($Candidates, $Fallback = $null) {
  foreach ($Candidate in $Candidates) {
    if ($Candidate -and (Test-Path $Candidate)) {
      return $Candidate
    }
  }
  return $Fallback
}

$NodeExe = First-Existing @(
  (Join-Path $ToolsDir "node\node.exe")
) "node"
$PythonExe = First-Existing @(
  (Join-Path $ToolsDir "python\python.exe"),
  (Join-Path $ToolsDir "python-embed\python.exe"),
  (Join-Path $ToolsDir "python-venv\Scripts\python.exe")
)
$FfmpegExe = First-Existing @(
  (Join-Path $ToolsDir "ffmpeg\bin\ffmpeg.exe")
) "ffmpeg"
$FfmpegDir = Split-Path -Parent $FfmpegExe
$PythonDir = if ($PythonExe) { Split-Path -Parent $PythonExe } else { "" }

# ── Pre-flight: check all critical tools before starting ──────────────────────
$MissingTools = @()

if (-not $NodeExe -or ($NodeExe -ne "node" -and -not (Test-Path $NodeExe))) {
  $MissingTools += "Node.js"
}
if (-not $FfmpegExe -or ($FfmpegExe -ne "ffmpeg" -and -not (Test-Path $FfmpegExe))) {
  $MissingTools += "FFmpeg"
}
if (-not $PythonExe -or -not (Test-Path $PythonExe)) {
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

$env:PATH = "$FfmpegDir;$PythonDir;$env:PATH"
$env:OFFLINE_SUBTITLE_TOOLS_DIR = $ToolsDir
$env:XDG_CACHE_HOME = $ToolsDir
$env:WHISPER_CACHE = Join-Path $ToolsDir "whisper-models"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

Start-Process $Url
& $NodeExe server.mjs
