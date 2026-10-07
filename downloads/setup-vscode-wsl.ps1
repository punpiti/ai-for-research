[CmdletBinding()]
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
# Called by the WSL installer under the logged-in Windows user, never sudo.
if ($DryRun) {
  Write-Output 'DRY_RUN Windows VS Code user install + ms-vscode-remote.remote-wsl'
  Write-Output 'VSCODE_CLI_PATH=C:\Example VS Code\bin\code.cmd'
  exit 0
}
function Find-Code {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  $found = Get-Command code.cmd -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'),
    (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin\code.cmd')
  )
  foreach ($path in $candidates) { if (Test-Path $path) { return $path } }
  return $null
}
$codeCli = Find-Code
if (-not $codeCli) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'Install/Update App Installer in Microsoft Store to enable WinGet, then rerun the WSL setup.'
  }
  winget install --id Microsoft.VisualStudioCode --exact --scope user --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { throw "Windows VS Code installation failed ($LASTEXITCODE)." }
  $codeCli = Find-Code
  if (-not $codeCli) { throw 'VS Code installed but its Windows CLI could not be found.' }
}
& $codeCli --install-extension ms-vscode-remote.remote-wsl
if ($LASTEXITCODE -ne 0) { throw 'VS Code WSL extension installation failed.' }
Write-Output "VSCODE_CLI_PATH=$codeCli"
