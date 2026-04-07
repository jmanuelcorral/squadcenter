$ErrorActionPreference = 'Stop'

$packageName = 'squad-center'
$version     = '0.2.0'
$url         = "https://github.com/jmanuelcorral/squadcenter/releases/download/v${version}/Squad-Center-Setup-${version}.exe"

# Fill checksum during CI/release (e.g., Get-FileHash -Algorithm SHA256)
$checksum     = ''
$checksumType = 'sha256'

$packageArgs = @{
  packageName    = $packageName
  fileType       = 'exe'
  url            = $url
  silentArgs     = '/S'
  validExitCodes = @(0)
  softwareName   = 'Squad Center*'
  checksum       = $checksum
  checksumType   = $checksumType
}

Install-ChocolateyPackage @packageArgs
