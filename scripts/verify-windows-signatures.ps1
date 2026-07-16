[CmdletBinding()]
param(
  [string]$DistDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $DistDir) {
  $DistDir = Resolve-Path (Join-Path $ProjectRoot '..\dist')
}

$setup = Get-ChildItem -LiteralPath $DistDir -Filter '*Setup *.exe' -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$portable = Get-ChildItem -LiteralPath $DistDir -Filter '*.exe' -File |
  Where-Object { $_.Name -notlike '*Setup*' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $setup -or -not $portable) {
  throw "Missing Windows artifacts for signature verification in $DistDir."
}

$targets = @($setup.FullName, $portable.FullName)

$failed = @()
foreach ($target in $targets) {
  $signature = Get-AuthenticodeSignature -LiteralPath $target
  $status = [string]$signature.Status
  $subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { '(no signer)' }
  Write-Host "$([IO.Path]::GetFileName($target)): $status - $subject"
  if ($signature.Status -ne 'Valid') {
    $failed += "$target => $status"
  }
}

if ($failed.Count -gt 0) {
  throw "Windows signature verification failed: $($failed -join '; ')"
}

Write-Host 'Windows signature verification passed.'
