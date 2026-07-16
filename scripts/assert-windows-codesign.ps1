[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($env:OS -notlike '*Windows*' -and -not $IsWindows) {
  throw 'Windows code signing must run on Windows.'
}

$pfxLink = $env:WIN_CSC_LINK
if (-not $pfxLink) { $pfxLink = $env:CSC_LINK }

$pfxPassword = $env:WIN_CSC_KEY_PASSWORD
if (-not $pfxPassword) { $pfxPassword = $env:CSC_KEY_PASSWORD }

$certName = $env:CSC_NAME

$storeCerts = @(
  Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
    Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) }
  Get-ChildItem Cert:\LocalMachine\My -CodeSigningCert -ErrorAction SilentlyContinue |
    Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) }
)

if ($pfxLink) {
  if (-not $pfxPassword) {
    throw 'Code signing certificate is configured through CSC_LINK/WIN_CSC_LINK, but CSC_KEY_PASSWORD/WIN_CSC_KEY_PASSWORD is missing.'
  }
  Write-Host 'Windows code signing preflight: PFX/CSC environment variables found.'
  exit 0
}

if ($certName) {
  Write-Host "Windows code signing preflight: CSC_NAME is configured: $certName"
  exit 0
}

if ($storeCerts.Count -gt 0) {
  Write-Host 'Windows code signing preflight: code signing certificate with private key found in Windows certificate store.'
  $storeCerts |
    Select-Object Subject, Thumbprint, NotAfter |
    Format-Table -AutoSize
  exit 0
}

throw @'
No Windows code signing certificate was found.

For a trusted public release, configure one of these before running npm run electron:build:

1. PFX file or base64 PFX for electron-builder:
   $env:CSC_LINK="D:\secure\offline-subtitle-factory-codesign.pfx"
   $env:CSC_KEY_PASSWORD="..."

2. Windows certificate store certificate:
   Import a valid Code Signing certificate with private key into CurrentUser\My or LocalMachine\My.

Use npm run electron:build:unsigned only for internal preview builds.
'@
