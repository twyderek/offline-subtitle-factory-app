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
    throw "$Label missing: $Path"
  }
  return $resolved.Path
}

function Invoke-RendererSmoke([string]$Executable, [int]$Port, [string]$Label) {
  Write-Host "==> Running $Label packaged renderer smoke: $Executable" -ForegroundColor Cyan
  & node scripts/verify-electron-renderer.mjs $Executable $Port 30000
  if ($LASTEXITCODE -ne 0) {
    throw "$Label packaged renderer smoke failed (exit $LASTEXITCODE)"
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

Write-Host '==> Installing Setup silently into isolated temp directory' -ForegroundColor Cyan
$installer = Start-Process -FilePath $setup -ArgumentList @('/S', "/D=$smokeRoot") -Wait -PassThru
if ($installer.ExitCode -ne 0) { throw "Setup installer exit code $($installer.ExitCode)" }
$installedExe = Get-ChildItem -LiteralPath $smokeRoot -Filter '*.exe' -File |
  Where-Object { $_.Name -notlike 'Uninstall*.exe' } |
  Select-Object -First 1 -ExpandProperty FullName
if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
  throw "Installed executable missing: $smokeRoot"
}
Invoke-RendererSmoke $installedExe $DebugPort 'Setup installed'

$uninstaller = Get-ChildItem -LiteralPath $smokeRoot -Filter 'Uninstall*.exe' -File | Select-Object -First 1
if (-not $uninstaller) { throw 'Uninstaller not found' }
Write-Host '==> Uninstalling silently and checking executable removal' -ForegroundColor Cyan
$uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exit code $($uninstall.ExitCode)" }
if (Test-Path -LiteralPath $installedExe) { throw 'Executable still exists after uninstall' }

Invoke-RendererSmoke $portable ($DebugPort + 1) 'Portable'
Write-Host 'Windows Setup, Portable, and uninstall smoke passed.' -ForegroundColor Green
