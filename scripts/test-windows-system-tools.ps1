$ErrorActionPreference = 'Stop'
trap {
  # Keep the actual PowerShell failure visible in GitHub's public annotations;
  # the runner otherwise reports only the process exit code.
  Write-Host "::error title=Windows system-tools test failed::$($_.Exception.Message)"
  throw
}
$installer = Join-Path (Split-Path -Parent $PSScriptRoot) 'downloads\setup-windows.ps1'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
# Load only the functions under test; never run installation, elevation or PATH persistence.
foreach ($name in @('Has','Trace','Trace-Path','Run-Quiet','Log','Refresh-ToolPath','Confirm-WinGetResult','Test-WinGetPackageInstalled','Get-SystemPackages','Needs-SystemSetup','Show-AdminProgress','Wait-AdminProcess','Run-AdminPackage')) {
  $node = $ast.Find({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
  if (-not $node) { throw "Missing function: $name" }
  Invoke-Expression $node.Extent.Text
}
$DryRun = $false
$TestCommands = @()
$Agent = 'openrouter'
$originalPath = $env:PATH
$originalProgramFiles = $env:ProgramFiles
$originalLocalAppData = $env:LOCALAPPDATA
$discoveryScratch = Join-Path $env:TEMP ('.ai-research-discovery-' + [guid]::NewGuid())
try {
  # Use a deterministic fake installation tree. This verifies discovery without
  # depending on tools preinstalled on a developer machine or GitHub runner.
  $env:ProgramFiles = Join-Path $discoveryScratch 'ProgramFiles'
  $env:LOCALAPPDATA = Join-Path $discoveryScratch 'LocalAppData'
  $fixtureFiles = @(
    (Join-Path $env:ProgramFiles 'Git\cmd\git.exe'),
    (Join-Path $env:ProgramFiles 'Tesseract-OCR\tesseract.exe'),
    (Join-Path $env:LOCALAPPDATA 'Pandoc\pandoc.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\oschwartz10612.Poppler_fixture\Library\bin\pdftotext.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\oschwartz10612.Poppler_fixture\Library\bin\pdftoppm.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\oschwartz10612.Poppler_fixture\Library\bin\pdfinfo.exe')
  )
  foreach ($file in $fixtureFiles) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $file) | Out-Null
    New-Item -ItemType File -Force -Path $file | Out-Null
  }
  $env:PATH = "$env:SystemRoot\System32"
  Refresh-ToolPath
  $refreshedPaths = @($env:PATH -split ';')
  foreach ($file in $fixtureFiles) {
    # DirectoryName can expand an 8.3 TEMP component (RUNNER~1) on hosted
    # Windows, so compare by the fixture executable found inside it.
    $leaf = Split-Path -Leaf $file
    $directory = $script:DiscoveredToolDirectories |
      Where-Object { Test-Path -LiteralPath (Join-Path $_ $leaf) -PathType Leaf } |
      Select-Object -First 1
    if (-not $directory -or $refreshedPaths -notcontains $directory) {
      throw "Installed off-PATH tool directory not discovered: $leaf"
    }
  }
  # Stub discovery to exercise WinGet results without accessing any package manager.
  $DryRun = $true
  $TestCommands = @('tesseract')
  Confirm-WinGetResult 'tesseract' 'tesseract-ocr.tesseract' 0
  Confirm-WinGetResult 'tesseract' 'tesseract-ocr.tesseract' -1978335189
  $failed = $false
  try { Confirm-WinGetResult 'tesseract' 'tesseract-ocr.tesseract' 123 } catch { $failed = $_.Exception.Message -match 'WinGet failed.*123' }
  if (-not $failed) { throw 'A real WinGet error must fail.' }
  $TestCommands = @('code')
  foreach ($exitCode in @(0, -1978335189)) {
    $failed = $false
    try { Confirm-WinGetResult 'tesseract' 'tesseract-ocr.tesseract' $exitCode } catch { $failed = $_.Exception.Message -match 'TOOL_NOT_FOUND' }
    if (-not $failed) { throw 'A package result must not pass without its command.' }
  }
  $TestCommands = @('package:Git.Git')
  if (-not (Test-WinGetPackageInstalled 'Git.Git')) { throw 'Dry-run WinGet inventory must identify a pre-existing package.' }
  $TestCommands = @()
  if (Test-WinGetPackageInstalled 'Git.Git') { throw 'Dry-run WinGet inventory must identify a missing package.' }
  $TestCommands = @('code','git','pandoc','tesseract','pdftotext','pdftoppm','pdfinfo','tha-traineddata')
  if (Needs-SystemSetup) { throw 'Complete tools must skip UAC.' }
  $TestCommands = @('code','git','pandoc','tesseract','pdftotext','pdftoppm','pdfinfo')
  if (-not (Needs-SystemSetup)) { throw 'Missing Thai data must request system setup.' }
} finally {
  $env:PATH = $originalPath
  $env:ProgramFiles = $originalProgramFiles
  $env:LOCALAPPDATA = $originalLocalAppData
  Remove-Item $discoveryScratch -Recurse -Force -ErrorAction SilentlyContinue
}
$scratch = Join-Path $PSScriptRoot ('.trace-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $scratch | Out-Null
try {
  $DryRun = $false
  $TraceFile = Join-Path $scratch 'trace.jsonl'
  Trace-Path (Join-Path $scratch 'missing-file') 'before'
  $output = (& { Run-Quiet 'test success' { cmd.exe /d /c 'echo tool detail & echo a warning 1>&2 & exit 0' } } 6>&1 | Out-String)
  if ($output.Trim()) { throw "Successful tool output must be hidden: $output" }
  $failed = $false
  try { Run-Quiet 'test failure' { cmd.exe /d /c 'echo missing package 1>&2 & exit 7' } } catch { $failed = $_.Exception.Message -match 'exit 7' }
  if (-not $failed) { throw 'Quiet capture must preserve native command failure.' }
  $records = @(Get-Content $TraceFile | ForEach-Object { $_ | ConvertFrom-Json })
  if ($records[0].details -ne 'missing' -or $records[-1].status -ne 'failed') { throw 'Journal snapshots/failures were lost.' }
  $diagnostic = Get-Content ([IO.Path]::ChangeExtension($TraceFile, '.log')) -Raw
  if ($diagnostic -notmatch 'tool detail' -or $diagnostic -notmatch 'missing package') { throw 'Hidden tool output must remain in the diagnostic log.' }
} finally { Remove-Item $scratch -Recurse -Force }
Write-Host 'PASS Windows off-PATH discovery, WinGet results and Thai-data elevation checks'
# The test intentionally exercises a failing native command above. GitHub's
# powershell shell propagates a stale LASTEXITCODE even after we catch it.
$global:LASTEXITCODE = 0

# Exercise a real long-running child without installing packages or requesting UAC.
$process = Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c "ping -n 3 127.0.0.1 >nul & exit 7"' -NoNewWindow -PassThru
$previousProgress = $ProgressPreference
$ProgressPreference = 'SilentlyContinue'
$waitOutput = (& { Wait-AdminProcess $process 'Test download' 0 2 1 } 6>&1 | Out-String)
if ($process.ExitCode -ne 7) { throw 'Progress wait lost the native failure exit code.' }
if ([regex]::Matches($waitOutput, 'ADMIN_WAIT.*Test download.*elapsed').Count -lt 2) { throw 'The wait must keep emitting heartbeats while the child is silent.' }
if ($ProgressPreference -ne 'SilentlyContinue') { throw 'Progress preference was not restored.' }
$ProgressPreference = $previousProgress

# Stub only package launch; preserve real logging, polling and result handling.
$TraceFile = $null
$script:packageTestExit = 0
function Start-Process {
  param($FilePath,$ArgumentList,[switch]$NoNewWindow,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
  if ($ArgumentList -notcontains '--accept-package-agreements' -or $ArgumentList -notcontains '--silent') { throw 'WinGet arguments changed.' }
  $fake = [pscustomobject]@{ ExitCode = $script:packageTestExit }
  $fake | Add-Member ScriptMethod WaitForExit { param($Milliseconds) return $true }
  $fake | Add-Member ScriptMethod Refresh {}
  return $fake
}
function Get-Command { param($Name,$ErrorAction) return [pscustomobject]@{ Source = 'winget.exe' } }
try {
  foreach ($value in @(0,-1978335189)) {
    $script:packageTestExit = $value
    Run-AdminPackage 'Test.Package' 0 2
    if ($LASTEXITCODE -ne $value) { throw 'WinGet success/no-update result was not preserved.' }
  }
  $script:packageTestExit = 7
  $failed = $false
  try { Run-AdminPackage 'Test.Package' 0 2 } catch { $failed = $_.Exception.Message -match 'exit 7' }
  if (-not $failed) { throw 'WinGet failure must stop installation.' }
} finally {
  Remove-Item Function:Start-Process,Function:Get-Command
  Write-Progress -Id 1 -Activity 'AI for Research: system installation' -Completed
}
Write-Host 'PASS Windows live progress, elapsed heartbeat, preference restoration and package failure propagation'
$global:LASTEXITCODE = 0
