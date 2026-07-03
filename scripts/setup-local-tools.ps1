$ErrorActionPreference = "Continue"

$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ToolsDir = Join-Path $AppDir "tools"
$DownloadsDir = Join-Path $ToolsDir "_downloads"
$NodeDir = Join-Path $ToolsDir "node"
$FfmpegDir = Join-Path $ToolsDir "ffmpeg"
$VenvDir = Join-Path $ToolsDir "python-venv"
$WhisperModelsDir = Join-Path $ToolsDir "whisper-models"

$NodeVersion = "v24.13.0"
$NodeZipUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
$FfmpegZipUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

# ── Pre-flight: check if we can write to the tools directory ──────────────────
Write-Step "Checking prerequisites"
if (-not (Test-Path $ToolsDir)) {
  New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
}
try {
  $null | Test-Path (Join-Path $ToolsDir ".write_test_$([guid]::NewGuid())")
  Remove-Item (Join-Path $ToolsDir ".write_test_*") -ErrorAction SilentlyContinue
} catch {
  throw "Cannot write to $ToolsDir. Please run this script as Administrator or check folder permissions."
}
New-Item -ItemType Directory -Force -Path $DownloadsDir, $WhisperModelsDir | Out-Null

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Download-File($Url, $OutFile) {
  if (Test-Path $OutFile) {
    Write-Host "Using cached download: $(Split-Path $OutFile -Leaf)"
    return
  }
  Write-Host "Downloading: $(Split-Path $Url -Leaf)"
  Invoke-WebRequest -Uri $Url -OutFile $OutFile
}

function Remove-AndCreate($Path) {
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

Write-Step "Install portable Node.js into tools/node"
$NodeExe = Join-Path $NodeDir "node.exe"
if (Test-Path $NodeExe) {
  Write-Host "Node.js already exists: $NodeExe"
} else {
  $NodeZip = Join-Path $DownloadsDir "node-$NodeVersion-win-x64.zip"
  try {
    Download-File $NodeZipUrl $NodeZip
    $NodeExtract = Join-Path $DownloadsDir "node-extract"
    Remove-AndCreate $NodeExtract
    Expand-Archive -LiteralPath $NodeZip -DestinationPath $NodeExtract -Force
    $ExtractedNode = Get-ChildItem -LiteralPath $NodeExtract -Directory | Select-Object -First 1
    if (-not $ExtractedNode) { throw "Node archive did not contain a folder." }
    Remove-AndCreate $NodeDir
    Copy-Item -Path (Join-Path $ExtractedNode.FullName "*") -Destination $NodeDir -Recurse -Force
    Write-Host "Node.js installed successfully: $($NodeExe)"
  } catch {
    Write-Host "Direct download failed, trying to copy installed Node.js..." -ForegroundColor Yellow
    $ExistingNode = Get-Command node -ErrorAction SilentlyContinue
    if (-not $ExistingNode) {
      Write-Host ""
      Write-Host "ERROR: Cannot install Node.js." -ForegroundColor Red
      Write-Host "  1. Make sure you have internet connection."
      Write-Host "  2. Or install Node.js from https://nodejs.org/ first, then run this script again."
      Write-Host ""
      Write-Host "The script will continue with other tools, but Node.js is still required."
      Write-Host ""
      # Don't throw — allow other tools to install so user can resume later
      $NodeExe = $null
    } else {
      $ExistingNodeDir = Split-Path -Parent $ExistingNode.Source
      Remove-AndCreate $NodeDir
      Copy-Item -Path (Join-Path $ExistingNodeDir "*") -Destination $NodeDir -Recurse -Force
      Write-Host "Copied existing Node.js: $($ExistingNode.Source)"
    }
  }
}

Write-Step "Install portable FFmpeg into tools/ffmpeg"
$FfmpegExe = Join-Path $FfmpegDir "bin\ffmpeg.exe"
if (Test-Path $FfmpegExe) {
  Write-Host "FFmpeg already exists: $FfmpegExe"
} else {
  $FfmpegZip = Join-Path $DownloadsDir "ffmpeg-release-essentials.zip"
  try {
    Download-File $FfmpegZipUrl $FfmpegZip
    $FfmpegExtract = Join-Path $DownloadsDir "ffmpeg-extract"
    Remove-AndCreate $FfmpegExtract
    Expand-Archive -LiteralPath $FfmpegZip -DestinationPath $FfmpegExtract -Force
    $ExtractedFfmpeg = Get-ChildItem -LiteralPath $FfmpegExtract -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin\ffmpeg.exe") } | Select-Object -First 1
    if (-not $ExtractedFfmpeg) { throw "FFmpeg archive did not contain bin\ffmpeg.exe." }
    Remove-AndCreate $FfmpegDir
    Copy-Item -Path (Join-Path $ExtractedFfmpeg.FullName "*") -Destination $FfmpegDir -Recurse -Force
    Write-Host "FFmpeg installed successfully: $($FfmpegExe)"
  } catch {
    Write-Host ""
    Write-Host "ERROR: Cannot install FFmpeg." -ForegroundColor Red
    Write-Host "  1. Make sure you have internet connection."
    Write-Host "  2. Or install FFmpeg from https://ffmpeg.org/download.html first, then run this script again."
    Write-Host ""
    # Continue anyway — user might already have FFmpeg in PATH
  }
}

Write-Step "Create project-local Python venv and install Whisper"
$PythonExe = $null
if (Test-Path (Join-Path $VenvDir "Scripts\python.exe")) {
  $PythonExe = Join-Path $VenvDir "Scripts\python.exe"
  Write-Host "Existing Python venv found: $PythonExe"
} else {
  # Try to find Python on the system
  $SystemPython = Get-Command python -ErrorAction SilentlyContinue
  if (-not $SystemPython) {
    $PyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PyLauncher) {
      Write-Host "Found Python launcher, creating virtual environment..."
      & $PyLauncher.Source -3 -m venv $VenvDir
    } else {
      # Python not found at all — give clear instructions
      Write-Host ""
      Write-Host "============================================================" -ForegroundColor Yellow
      Write-Host "Python is not installed on this computer." -ForegroundColor Yellow
      Write-Host "============================================================" -ForegroundColor Yellow
      Write-Host ""
      Write-Host "You need Python to run Whisper for speech-to-text." -ForegroundColor White
      Write-Host ""
      Write-Host "Option 1 (recommended): Install via winget" -ForegroundColor Cyan
      Write-Host "  winget install Python.Python.3.12" -ForegroundColor Gray
      Write-Host ""
      Write-Host "Option 2: Download from https://www.python.org/downloads/" -ForegroundColor Cyan
      Write-Host "  Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Gray
      Write-Host ""
      Write-Host "After installing Python, run this script again:" -ForegroundColor White
      Write-Host "  setup-local-tools.bat" -ForegroundColor Gray
      Write-Host ""
      Write-Host "The script will skip Python and continue with other tools." -ForegroundColor Yellow
      Write-Host "You can re-run setup-local-tools.bat later to install Python/Whisper." -ForegroundColor Yellow
      Write-Host ""
      $PythonExe = $null
    }
  } else {
    Write-Host "Found Python: $($SystemPython.Source), creating virtual environment..."
    & $SystemPython.Source -m venv $VenvDir
  }

  if ($PythonExe -and (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
    $PythonExe = Join-Path $VenvDir "Scripts\python.exe"
  } elseif ($SystemPython) {
    $PythonExe = Join-Path $VenvDir "Scripts\python.exe"
  }
}

# Install Whisper if we have Python
if ($PythonExe -and (Test-Path $PythonExe)) {
  $PipExe = Join-Path $VenvDir "Scripts\pip.exe"
  Write-Host "Installing openai-whisper..."
  & $PythonExe -m pip install --upgrade pip --quiet
  & $PipExe install --upgrade openai-whisper --quiet
  Write-Host "Whisper installed successfully."
} else {
  Write-Host ""
  Write-Host "Skipping Whisper installation — no Python available." -ForegroundColor Yellow
  Write-Host "Run setup-local-tools.bat again after installing Python." -ForegroundColor Yellow
  Write-Host ""
}

Write-Step "Verify local tools"
$AllOk = $true
$Installed = @()
$Missing = @()

# Check Node.js
if (Test-Path $NodeExe) {
  $ver = & $NodeExe --version 2>$null
  Write-Host "Node.js: $ver" -ForegroundColor Green
  $Installed += "Node.js"
} else {
  Write-Host "Node.js: MISSING" -ForegroundColor Red
  $Missing += "Node.js"
  $AllOk = $false
}

# Check FFmpeg
if (Test-Path $FfmpegExe) {
  $ver = & $FfmpegExe -version 2>&1 | Select-Object -First 1
  Write-Host "FFmpeg: $ver" -ForegroundColor Green
  $Installed += "FFmpeg"
} else {
  Write-Host "FFmpeg: MISSING" -ForegroundColor Red
  $Missing += "FFmpeg"
  $AllOk = $false
}

# Check Python
if ($PythonExe -and (Test-Path $PythonExe)) {
  $ver = & $PythonExe --version 2>$null
  Write-Host "Python: $ver" -ForegroundColor Green
  $Installed += "Python"

  # Check Whisper
  $whisperExe = Join-Path $VenvDir "Scripts\whisper.exe"
  if (Test-Path $whisperExe) {
    Write-Host "Whisper CLI: OK ($whisperExe)" -ForegroundColor Green
    $Installed += "Whisper"
  } else {
    # Try importing via python
    $whisperCheck = & $PythonExe -c "import whisper; print('ok')" 2>$null
    if ($whisperCheck -eq 'ok') {
      Write-Host "Whisper module: OK (importable)" -ForegroundColor Green
      $Installed += "Whisper"
    } else {
      Write-Host "Whisper: NOT INSTALLED" -ForegroundColor Red
      $Missing += "Whisper"
      $AllOk = $false
    }
  }
} else {
  Write-Host "Python: MISSING" -ForegroundColor Red
  $Missing += "Python"
  $AllOk = $false
}

# Summary
Write-Host ""
if ($AllOk) {
  Write-Host "All local tools are ready under:" -ForegroundColor Green
  Write-Host $ToolsDir
} else {
  Write-Host "Some tools are missing:" -ForegroundColor Yellow
  foreach ($m in $Missing) {
    Write-Host "  - $m" -ForegroundColor Yellow
  }
  Write-Host ""
  Write-Host "Installed: $($Installed -join ', ')" -ForegroundColor Green
  Write-Host ""
  Write-Host "To install missing tools, run setup-local-tools.bat again." -ForegroundColor Cyan
  if ($Missing -contains "Python" -or $Missing -contains "Whisper") {
    Write-Host ""
    Write-Host "Python is required for Whisper (speech-to-text)." -ForegroundColor Yellow
    Write-Host "Install Python first: winget install Python.Python.3.12" -ForegroundColor Yellow
    Write-Host "Then re-run: setup-local-tools.bat" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Whisper models will be cached under:"
Write-Host $WhisperModelsDir
