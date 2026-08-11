[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SetupPath,
  [Parameter(Mandatory = $true)]
  [string]$PortablePath,
  [int]$DebugPort = 9253
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-RequiredFile([string]$Path, [string]$Label) {
  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
  if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
    throw "$Label 不存在：$Path"
  }
  return $resolved.Path
}

function Invoke-RendererSmoke([string]$Executable, [int]$Port, [string]$Label) {
  Write-Host "==> 執行 $Label packaged renderer smoke：$Executable" -ForegroundColor Cyan
  & node scripts/verify-electron-renderer.mjs $Executable $Port 30000
  if ($LASTEXITCODE -ne 0) {
    throw "$Label packaged renderer smoke 失敗（exit $LASTEXITCODE）"
  }
}

$setup = Resolve-RequiredFile $SetupPath 'Setup installer'
$portable = Resolve-RequiredFile $PortablePath 'Portable executable'
$tempBase = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } elseif ($env:TEMP) { $env:TEMP } else { [IO.Path]::GetTempPath() }
$smokeRoot = Join-Path $tempBase 'offline-subtitle-factory-install-smoke'
if (Test-Path -LiteralPath $smokeRoot) {
  Remove-Item -LiteralPath $smokeRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $smokeRoot | Out-Null

Write-Host '==> 靜默安裝 Setup 到隔離暫存目錄' -ForegroundColor Cyan
$installer = Start-Process -FilePath $setup -ArgumentList @('/S', "/D=$smokeRoot") -Wait -PassThru
if ($installer.ExitCode -ne 0) { throw "Setup installer exit code $($installer.ExitCode)" }
$installedExe = Join-Path $smokeRoot '離線字幕工廠.exe'
if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
  throw "安裝後 executable 不存在：$installedExe"
}
Invoke-RendererSmoke $installedExe $DebugPort 'Setup 安裝後'

$uninstaller = Get-ChildItem -LiteralPath $smokeRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
if (-not $uninstaller) { throw '安裝目錄找不到 Uninstall*.exe' }
Write-Host '==> 靜默解除安裝並確認程式檔移除' -ForegroundColor Cyan
$uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exit code $($uninstall.ExitCode)" }
if (Test-Path -LiteralPath $installedExe) { throw '解除安裝後 executable 仍存在' }

Invoke-RendererSmoke $portable ($DebugPort + 1) 'Portable'
Write-Host 'Windows Setup／Portable／解除安裝 smoke 通過。' -ForegroundColor Green
