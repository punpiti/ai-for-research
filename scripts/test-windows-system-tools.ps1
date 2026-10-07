$ErrorActionPreference = 'Stop'
$installer = Join-Path (Split-Path -Parent $PSScriptRoot) 'downloads\setup-windows.ps1'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
# Load only the functions under test; never run installation, elevation or PATH persistence.
foreach ($name in @('Has','Log','Refresh-ToolPath','Confirm-WinGetResult','Get-SystemPackages','Needs-SystemSetup')) {
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
  $TestCommands = @('code','git','pandoc','tesseract','pdftotext','tha-traineddata')
  if (Needs-SystemSetup) { throw 'Complete tools must skip UAC.' }
  $TestCommands = @('code','git','pandoc','tesseract','pdftotext')
  if (-not (Needs-SystemSetup)) { throw 'Missing Thai data must request system setup.' }
} finally { $env:PATH = $originalPath }
Write-Host 'PASS Windows off-PATH discovery, WinGet results and Thai-data elevation checks'
