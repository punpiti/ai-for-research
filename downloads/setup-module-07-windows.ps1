param(
  [string]$Workspace = (Join-Path $HOME 'ai-for-research-workspace')
)
$ErrorActionPreference = 'Stop'
Set-Location $HOME

function Find-Uv {
  $command = Get-Command uv -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Join-Path $HOME '.local\bin\uv.exe'
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  return $null
}

try {
  $uv = Find-Uv
  if (-not $uv) {
    Write-Host '[AI for Research · Module 7] Installing uv under the current user account.'
    $uvInstaller = Join-Path $env:TEMP 'ai-module07-install-uv.ps1'
    Invoke-WebRequest -UseBasicParsing -ErrorAction Stop 'https://astral.sh/uv/install.ps1' -OutFile $uvInstaller
    powershell -NoProfile -ExecutionPolicy Bypass -File $uvInstaller
    $uv = Find-Uv
  }
  if (-not $uv) { throw 'uv installation finished but uv.exe was not found.' }

  $setup = Join-Path $env:TEMP 'ai-module07-setup.py'
  Invoke-WebRequest -UseBasicParsing -ErrorAction Stop 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-module-07.py' -OutFile $setup
  $env:AI_MODULE07_UV = $uv
  & $uv run --no-project --python 3.12 python $setup --workspace $Workspace
  if ($LASTEXITCODE -ne 0) { throw "Module 7 setup failed with exit code $LASTEXITCODE." }
} catch {
  Write-Host "[AI for Research · Module 7] FINAL_RESULT FAIL — $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
