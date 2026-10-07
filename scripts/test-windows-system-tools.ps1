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
foreach ($name in @('Has','Trace','Trace-Path','Run-Quiet','Log','Refresh-ToolPath','Confirm-WinGetResult','Test-WinGetPackageInstalled','Get-SystemPackages','Needs-SystemSetup')) {
  $node = $ast.Find({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
  if (-not $node) { throw "Missing function: $name" }
  Invoke-Expression $node.Extent.Text
}
$DryRun = $false
$TestCommands = @()
$Agent = 'openrouter'
$originalPath = $env:PATH
try {
  # Simulate a stale shell even on a machine with previously installed packages.
  $env:PATH = "$env:SystemRoot\System32"
  Refresh-ToolPath
  foreach ($pair in @(
    @('git', (Join-Path $env:ProgramFiles 'Git\cmd\git.exe')),
    @('tesseract', (Join-Path $env:ProgramFiles 'Tesseract-OCR\tesseract.exe')),
    @('pandoc', (Join-Path $env:LOCALAPPDATA 'Pandoc\pandoc.exe'))
  )) {
    if ((Test-Path $pair[1]) -and -not (Has $pair[0])) { throw "Installed off-PATH tool not discovered: $($pair[0])" }
  }
  foreach ($directory in $script:DiscoveredToolDirectories) {
    if ((Test-Path (Join-Path $directory 'pdftotext.exe')) -and -not (Has 'pdftotext')) { throw 'Portable Poppler was not discovered.' }
    if ((Test-Path (Join-Path $directory 'pdftoppm.exe')) -and -not (Has 'pdftoppm')) { throw 'Poppler PDF renderer was not discovered.' }
    if ((Test-Path (Join-Path $directory 'pdfinfo.exe')) -and -not (Has 'pdfinfo')) { throw 'Poppler PDF metadata tool was not discovered.' }
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
} finally { $env:PATH = $originalPath }
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
