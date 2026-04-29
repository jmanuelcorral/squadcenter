param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Sha256 = ''
)

$ErrorActionPreference = 'Stop'

$manifestDir = Join-Path $PSScriptRoot 'jmanuelcorral.SquadCenter'
$versionManifestPath = Join-Path $manifestDir 'jmanuelcorral.SquadCenter.yaml'
$installerManifestPath = Join-Path $manifestDir 'jmanuelcorral.SquadCenter.installer.yaml'
$localeManifestPath = Join-Path $manifestDir 'jmanuelcorral.SquadCenter.locale.en-US.yaml'
$manifestPaths = @($versionManifestPath, $installerManifestPath, $localeManifestPath)

Write-Host "Updating winget manifest to version $Version ..."

$installerUrl = "https://github.com/jmanuelcorral/squadcenter/releases/download/v${Version}/Squad-Center-Setup-${Version}.exe"

foreach ($manifestPath in $manifestPaths) {
  if (-not (Test-Path $manifestPath)) {
    throw "Expected winget manifest file was not found: $manifestPath"
  }

  $content = Get-Content $manifestPath -Raw
  $content = $content -replace '(?m)^PackageVersion:\s.*$', "PackageVersion: $Version"

  if ($manifestPath -eq $installerManifestPath) {
    $content = $content -replace '(?m)^(\s*InstallerUrl:\s).+$', "`${1}$installerUrl"

    if ($Sha256) {
      $normalizedSha = $Sha256.Trim().ToUpperInvariant()
      if ($normalizedSha -notmatch '^[A-F0-9]{64}$') {
        throw "Invalid SHA256 value: $Sha256"
      }

      $content = $content -replace '(?m)^(\s*InstallerSha256:\s).+$', "`${1}$normalizedSha"
    }
  }

  Set-Content -Path $manifestPath -Value $content -NoNewline -Encoding UTF8
}

Write-Host "  Updated manifest."

Write-Host "Done. winget manifest updated to $Version."
