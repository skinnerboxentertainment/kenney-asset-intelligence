# Creates the desktop shortcut for the Kenney Asset Index.
#
# The shortcut targets wscript.exe with the .vbs as an argument rather than the
# .vbs directly, so it does not depend on the machine's .vbs file association
# and cannot inherit a "wrong app" default. wscript with window style hidden
# means no console flashes on launch.

$ErrorActionPreference = 'Stop'

$here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs      = Join-Path $here 'Kenney Asset Index.vbs'
$icon     = Join-Path $here 'kenney-assets.ico'
$desktop  = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop 'Kenney Asset Index.lnk'

foreach ($f in @($vbs, $icon)) {
  if (-not (Test-Path $f)) { throw "Missing: $f" }
}

$shell = New-Object -ComObject WScript.Shell
$link  = $shell.CreateShortcut($linkPath)
$link.TargetPath       = Join-Path $env:SystemRoot 'System32\wscript.exe'
$link.Arguments        = '"' + $vbs + '"'
$link.WorkingDirectory = Split-Path -Parent $here
$link.IconLocation     = "$icon,0"
$link.Description      = 'Browse and search 61,000 CC0 Kenney game assets'
$link.WindowStyle      = 7   # minimised; wscript shows nothing regardless
$link.Save()

Write-Output "Created: $linkPath"
Write-Output "  target: wscript.exe"
Write-Output "  script: $vbs"
Write-Output "  icon:   $icon"
