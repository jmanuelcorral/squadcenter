param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Sha256 = ''
)

$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'jmanuelcorral.SquadCenter.yaml'

Write-Host "Updating winget manifest to version $Version ..."

$content = Get-Content $manifestPath -Raw
$installerUrl = "https://github.com/jmanuelcorral/squadcenter/releases/download/v${Version}/Squad-Center-Setup-${Version}.exe"

# Update PackageVersion
$content = $content -replace '(?m)^PackageVersion:\s.*$', "PackageVersion: $Version"

# Update InstallerUrl
$content = $content -replace '(?m)^    InstallerUrl:\s.*$', "    InstallerUrl: $installerUrl"

# Update InstallerSha256
if ($Sha256) {
  $normalizedSha = $Sha256.Trim().ToUpperInvariant()
  if ($normalizedSha -notmatch '^[A-F0-9]{64}$') {
    throw "Invalid SHA256 value: $Sha256"
  }

  $content = $content -replace '(?m)^    InstallerSha256:\s.*$', "    InstallerSha256: $normalizedSha"
}

Set-Content -Path $manifestPath -Value $content -NoNewline -Encoding UTF8
Write-Host "  Updated manifest."

Write-Host "Done. winget manifest updated to $Version."
