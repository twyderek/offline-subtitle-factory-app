[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsDir = Join-Path $ProjectRoot 'tools'
$DownloadsDir = Join-Path $ToolsDir '_downloads'
$TempDir = Join-Path $env:TEMP 'offline-subtitle-factory-v030-runtime'

$FfmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-8.1.2-essentials_build.zip'
$FfmpegSha256 = 'db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec'
$WhisperUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip'
$WhisperSha256 = '7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539'
$WhisperLicenseUrl = 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.1/LICENSE'
$WhisperLicenseSha256 = '94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d'
$ModelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.bin?download=true'
$ModelSha256 = 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-VerifiedFile {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Destination,
    [string]$ExpectedSha256
  )

  if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
    if ((Get-Sha256 $Destination) -eq $ExpectedSha256) {
      Write-Host "$Name cache: OK"
      return
    }
    Write-Warning "$Name cache hash mismatch; downloading again."
  }

  $partial = "$Destination.partial"
  Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
  Write-Host "Downloading $Name..."
  Invoke-WebRequest -Uri $Url -OutFile $partial -UseBasicParsing
  $actual = Get-Sha256 $partial
  if ($actual -ne $ExpectedSha256) {
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    throw "$Name SHA-256 mismatch. Expected $ExpectedSha256, got $actual"
  }
  Move-Item -LiteralPath $partial -Destination $Destination -Force
}

New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

$ffmpegZip = Join-Path $DownloadsDir 'ffmpeg-8.1.2-essentials_build.zip'
$whisperZip = Join-Path $DownloadsDir 'whisper-bin-x64-v1.9.1.zip'
$whisperLicense = Join-Path $DownloadsDir 'whisper-cpp-v1.9.1-LICENSE'
$modelCache = Join-Path $DownloadsDir 'ggml-tiny.bin'

Write-Step 'Download and verify pinned Windows runtime archives'
Get-VerifiedFile 'FFmpeg 8.1.2 essentials' $FfmpegUrl $ffmpegZip $FfmpegSha256
Get-VerifiedFile 'Whisper.cpp 1.9.1 x64' $WhisperUrl $whisperZip $WhisperSha256
Get-VerifiedFile 'Whisper.cpp license' $WhisperLicenseUrl $whisperLicense $WhisperLicenseSha256
Get-VerifiedFile 'ggml-tiny multilingual model' $ModelUrl $modelCache $ModelSha256

Write-Step 'Install FFmpeg and FFprobe'
$ffmpegExtract = Join-Path $TempDir 'ffmpeg'
Expand-Archive -LiteralPath $ffmpegZip -DestinationPath $ffmpegExtract -Force
$ffmpegExe = Get-ChildItem -LiteralPath $ffmpegExtract -Filter 'ffmpeg.exe' -File -Recurse | Select-Object -First 1
if (-not $ffmpegExe) { throw 'FFmpeg archive does not contain ffmpeg.exe.' }
$ffmpegRoot = Split-Path -Parent (Split-Path -Parent $ffmpegExe.FullName)
$ffmpegTarget = Join-Path $ToolsDir 'ffmpeg'
$ffmpegBinTarget = Join-Path $ffmpegTarget 'bin'
New-Item -ItemType Directory -Force -Path $ffmpegBinTarget | Out-Null
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'bin\ffmpeg.exe') -Destination $ffmpegBinTarget -Force
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'bin\ffprobe.exe') -Destination $ffmpegBinTarget -Force
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'LICENSE') -Destination (Join-Path $ffmpegTarget 'LICENSE') -Force
Copy-Item -LiteralPath (Join-Path $ffmpegRoot 'README.txt') -Destination (Join-Path $ffmpegTarget 'README.txt') -Force

Write-Step 'Install Whisper.cpp CPU x64 runtime'
$whisperExtract = Join-Path $TempDir 'whisper'
Expand-Archive -LiteralPath $whisperZip -DestinationPath $whisperExtract -Force
$whisperRelease = Join-Path $whisperExtract 'Release'
if (-not (Test-Path -LiteralPath (Join-Path $whisperRelease 'whisper-cli.exe'))) {
  throw 'Whisper.cpp archive does not contain Release\whisper-cli.exe.'
}
$whisperTarget = Join-Path $ToolsDir 'whisper-cpp'
New-Item -ItemType Directory -Force -Path $whisperTarget | Out-Null
Copy-Item -LiteralPath (Join-Path $whisperRelease 'whisper-cli.exe') -Destination $whisperTarget -Force
Get-ChildItem -LiteralPath $whisperRelease -Filter '*.dll' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $whisperTarget -Force
}
Copy-Item -LiteralPath $whisperLicense -Destination (Join-Path $whisperTarget 'LICENSE') -Force

Write-Step 'Install the multilingual tiny model'
$modelTargetDir = Join-Path $ToolsDir 'whisper-models'
New-Item -ItemType Directory -Force -Path $modelTargetDir | Out-Null
Copy-Item -LiteralPath $modelCache -Destination (Join-Path $modelTargetDir 'ggml-tiny.bin') -Force

Write-Step 'Generate manifest and execute Windows runtime smoke tests'
Push-Location $ProjectRoot
try {
  & npm run runtime:manifest
  if ($LASTEXITCODE -ne 0) { throw 'Runtime manifest generation failed.' }
  & npm run runtime:verify
  if ($LASTEXITCODE -ne 0) { throw 'Windows runtime verification failed.' }
} finally {
  Pop-Location
  Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`nWindows x64 runtime is ready." -ForegroundColor Green
Write-Host 'Next: npm run check'
Write-Host 'Build unpacked app: npm run electron:build:dir'
Write-Host 'Build Setup and Portable: npm run electron:build'
