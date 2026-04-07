param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Sha256 = ''
)

$ErrorActionPreference = 'Stop'

$manifestPath = Join-Path $PSScriptRoot 'jmanuelcorral.SquadCenter.yaml'

Write-Host "Updating winget manifest to version $Version ..."

$content = Get-Content $manifestPath -Raw

# Update PackageVersion
$content = $content -replace '(?<=PackageVersion:\s)[\d]+\.[\d]+\.[\d]+', $Version

# Update InstallerUrl
$content = $content -replace 'v[\d]+\.[\d]+\.[\d]+/Squad-Center-Setup-[\d]+\.[\d]+\.[\d]+\.exe', "v${Version}/Squad-Center-Setup-${Version}.exe"

# Update InstallerSha256
if ($Sha256) {
  $content = $content -replace '(?<=InstallerSha256:\s).*', $Sha256
}

Set-Content -Path $manifestPath -Value $content -NoNewline -Encoding UTF8
Write-Host "  Updated manifest."

Write-Host "Done. winget manifest updated to $Version."
