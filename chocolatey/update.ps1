param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Checksum = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path -Parent $PSScriptRoot
$chocoDir   = $PSScriptRoot
$nuspecPath  = Join-Path $chocoDir 'squad-center.nuspec'
$installPath = Join-Path $chocoDir 'tools\chocolateyInstall.ps1'
$verifyPath  = Join-Path $chocoDir 'tools\VERIFICATION.txt'

Write-Host "Updating Chocolatey package to version $Version ..."

# --- Update nuspec version ---
$nuspec = Get-Content $nuspecPath -Raw
$nuspec = $nuspec -replace '(?<=<version>)[^<]+', $Version
Set-Content -Path $nuspecPath -Value $nuspec -NoNewline -Encoding UTF8
Write-Host "  Updated nuspec version."

# --- Update install script version and URL ---
$install = Get-Content $installPath -Raw
$install = $install -replace "(?<=\`\$version\s+=\s+')[^']+", $Version
if ($Checksum) {
  $install = $install -replace "(?<=\`\$checksum\s+=\s+')[^']*", $Checksum
}
Set-Content -Path $installPath -Value $install -NoNewline -Encoding UTF8
Write-Host "  Updated chocolateyInstall.ps1."

# --- Update VERIFICATION.txt download URL ---
$verify = Get-Content $verifyPath -Raw
$verify = $verify -replace 'v[\d]+\.[\d]+\.[\d]+/Squad-Center-Setup-[\d]+\.[\d]+\.[\d]+\.exe', "v${Version}/Squad-Center-Setup-${Version}.exe"
Set-Content -Path $verifyPath -Value $verify -NoNewline -Encoding UTF8
Write-Host "  Updated VERIFICATION.txt."

Write-Host "Done. Chocolatey package updated to $Version."
