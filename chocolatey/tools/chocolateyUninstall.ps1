$ErrorActionPreference = 'Stop'

$packageName  = 'squad-center'
$softwareName = 'Squad Center*'

# Look up the uninstaller from the registry (handles both per-user and per-machine installs)
[array]$keys = Get-UninstallRegistryKey -SoftwareName $softwareName

if ($keys.Count -eq 0) {
  Write-Warning "$packageName has already been uninstalled by other means."
} elseif ($keys.Count -gt 1) {
  Write-Warning "$($keys.Count) matches found! Uninstalling the first one."
}

foreach ($key in $keys) {
  $uninstallString = $key.UninstallString

  if ($uninstallString) {
    # NSIS uninstallers accept /S for silent mode
    Uninstall-ChocolateyPackage -PackageName $packageName `
                                -FileType 'exe' `
                                -SilentArgs '/S' `
                                -File $uninstallString `
                                -ValidExitCodes @(0)
  }
}
