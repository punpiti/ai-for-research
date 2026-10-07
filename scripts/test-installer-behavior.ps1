param(
  [Parameter(Mandatory)][ValidateSet('codex','claude','openrouter','antigravity')][string]$Agent,
  [Parameter(Mandatory)][ValidateSet('present','missing','no-npm','no-code')][string]$State
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$installer = Join-Path $root 'downloads/setup-windows.ps1'
$selectedCommand = if ($Agent -eq 'antigravity') { 'agy-ide' } else { $Agent }
$commands = switch ($State) {
  'present' { @('npm','code','uv',$selectedCommand) }
  'missing' { @('npm','code','uv') }
  'no-npm' { @('code','uv',$selectedCommand) }
  'no-code' { @('npm','uv',$selectedCommand) }
}
$env:AI_RESEARCH_DRY_RUN = '1'
$env:AI_RESEARCH_TEST_COMMANDS = $commands -join ','

$failed = $false
try {
  $output = (& $installer -Mode SetupUser -Agent $Agent 2>&1 6>&1 | Out-String)
} catch {
  $failed = $true
  $output = ($_ | Out-String)
}

function Require([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "$Message`n$output" }
}
$workspaceIndex = $output.IndexOf('DRY_RUN workspace=')
$agentIndexes = @('REUSE codex','INSTALL codex','REUSE claude','INSTALL claude','Antigravity will be opened','INSTALL ANTIGRAVITY_EXTENSION','OPENROUTER_READY') | ForEach-Object { $output.IndexOf($_) } | Where-Object { $_ -ge 0 }
if ($State -in @('present','missing')) {
  Require ($workspaceIndex -ge 0 -and $agentIndexes.Count -gt 0 -and $workspaceIndex -lt ($agentIndexes | Measure-Object -Minimum).Minimum) 'Workspace fonts must be prepared before the AI frontend.'
}
if ($Agent -ne 'antigravity' -and $State -in @('present','missing')) {
  Require ($output.Contains('janisdd.vscode-edit-csv') -and $output.Contains('ccimage.jsonviewer')) 'CSV and JSON viewers must be installed with every AI profile.'
  $profileIndex = $output.IndexOf('CREATE VS_CODE_PROFILE')
  $extensionIndex = $output.IndexOf('INSTALL VS_CODE_EXTENSION')
  Require ($profileIndex -ge 0 -and $extensionIndex -ge 0 -and $profileIndex -lt $extensionIndex) 'VS Code profile must be created before extensions are installed.'
}
switch ("${Agent}:${State}") {
  { $_ -in @('openrouter:present','openrouter:missing') } {
    Require (!$failed -and $output.Contains('OPENROUTER_READY') -and $output.Contains('saoudrizwan.claude-dev')) 'Cline/OpenRouter setup failed.'
    Require (!$output.Contains('npm install') -and !$output.Contains('openai.chatgpt') -and !$output.Contains('anthropic.claude-code')) 'OpenRouter should use the Cline extension without another AI CLI.'
  }
  'openrouter:no-npm' { Require ($failed -and $output.Contains('PREREQUISITE_MISSING npm is not on PATH')) 'Missing npm behavior failed.' }
  'openrouter:no-code' { Require ($failed -and $output.Contains('PREREQUISITE_MISSING VS Code CLI')) 'Missing code behavior failed.' }
  'codex:missing' {
    Require (!$failed -and $output.Contains('DRY_RUN npm install -g @openai/codex') -and $output.Contains('openai.chatgpt')) 'Codex missing behavior failed.'
    Require (!$output.Contains('@anthropic-ai/claude-code')) 'Codex selected but Claude was touched.'
  }
  'codex:present' { Require (!$failed -and $output.Contains('REUSE codex') -and !$output.Contains('DRY_RUN npm install')) 'Codex reuse behavior failed.' }
  'claude:missing' {
    Require (!$failed -and $output.Contains('DRY_RUN npm install -g @anthropic-ai/claude-code') -and $output.Contains('anthropic.claude-code')) 'Claude missing behavior failed.'
    Require (!$output.Contains('@openai/codex')) 'Claude selected but Codex was touched.'
  }
  'claude:present' { Require (!$failed -and $output.Contains('REUSE claude') -and !$output.Contains('DRY_RUN npm install')) 'Claude reuse behavior failed.' }
  'antigravity:missing' { Require (!$failed -and $output.Contains('ANTIGRAVITY_GUI_SETUP') -and !$output.Contains('VS_CODE_EXTENSION')) 'Antigravity missing behavior failed.' }
  'antigravity:present' { Require (!$failed -and $output.Contains('ANTIGRAVITY_EXTENSION mathematic.vscode-pdf') -and !$output.Contains('npm install') -and !$output.Contains('openai.chatgpt') -and !$output.Contains('anthropic.claude-code')) 'Antigravity present behavior failed.' }
  'codex:no-npm' { Require ($failed -and $output.Contains('PREREQUISITE_MISSING npm is not on PATH') -and !$output.Contains('INSTALL VS_CODE_EXTENSION')) 'Codex missing npm behavior failed.' }
  'claude:no-npm' { Require ($failed -and $output.Contains('PREREQUISITE_MISSING npm is not on PATH') -and !$output.Contains('INSTALL VS_CODE_EXTENSION')) 'Claude missing npm behavior failed.' }
  'codex:no-code' { Require ($failed -and $output.Contains('PREREQUISITE_MISSING VS Code CLI') -and !$output.Contains('INSTALL VS_CODE_EXTENSION')) 'Codex missing code behavior failed.' }
  'claude:no-code' { Require ($failed -and $output.Contains('PREREQUISITE_MISSING VS Code CLI') -and !$output.Contains('INSTALL VS_CODE_EXTENSION')) 'Claude missing code behavior failed.' }
}
if (!$failed -and $State -eq 'present') { Require ($output.Contains('mathematic.vscode-pdf')) 'PDF viewer was not installed.' }
Write-Host "PASS installer=windows agent=$Agent state=$State"
