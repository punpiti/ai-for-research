$ErrorActionPreference = 'Stop'
$installer = Join-Path (Split-Path -Parent $PSScriptRoot) 'downloads\setup-windows.ps1'
$scratch = Join-Path $env:TEMP ('ai-research-uninstall-test-' + [guid]::NewGuid())
$workspace = Join-Path $scratch 'workspace'
New-Item -ItemType Directory -Force -Path $workspace | Out-Null
$created = Join-Path $workspace 'created.txt'
$modified = Join-Path $workspace 'modified.txt'
Set-Content -LiteralPath $created -Encoding utf8 -NoNewline -Value 'created by installer'
Set-Content -LiteralPath $modified -Encoding utf8 -NoNewline -Value 'changed by learner'
$createdHash = (Get-FileHash -LiteralPath $created -Algorithm SHA256).Hash.ToLowerInvariant()
$oldModifiedHash = ('0' * 64)
$trace = Join-Path $scratch 'install.jsonl'
$incompleteTrace = Join-Path $scratch 'incomplete.jsonl'
$invalidTrace = Join-Path $scratch 'failed.jsonl'

function Add-Event([string]$Path, [hashtable]$Event) {
  Add-Content -LiteralPath $Path -Encoding utf8 -Value ($Event | ConvertTo-Json -Compress)
}
try {
  Add-Event $trace @{ action='phase'; kind='installer'; target='Install'; status='started'; details='agent=codex' }
  Add-Event $trace @{ action='snapshot'; kind='workspace'; target=$workspace; status='before'; details='preserve-personal-files' }
  Add-Event $trace @{ action='snapshot'; kind='vscode-profile'; target='AI for Research - codex'; status='before'; details='ownership-unknown-preserve' }
  Add-Event $trace @{ action='snapshot'; kind='vscode-extension'; target='openai.chatgpt'; status='before'; details='missing; profile=AI for Research - codex' }
  Add-Event $trace @{ action='snapshot'; kind='vscode-extension'; target='openai.chatgpt'; status='after'; details='present; profile=AI for Research - codex' }
  Add-Event $trace @{ action='snapshot'; kind='vscode-extension'; target='mathematic.vscode-pdf'; status='before'; details='present; profile=AI for Research - codex' }
  Add-Event $trace @{ action='snapshot'; kind='vscode-extension'; target='mathematic.vscode-pdf'; status='after'; details='present; profile=AI for Research - codex; reused' }
  Add-Event $trace @{ action='snapshot'; kind='path'; target=$created; status='before'; details='missing' }
  Add-Event $trace @{ action='snapshot'; kind='path'; target=$created; status='after'; details="file:$createdHash" }
  Add-Event $trace @{ action='snapshot'; kind='path'; target=$modified; status='before'; details='missing' }
  Add-Event $trace @{ action='snapshot'; kind='path'; target=$modified; status='after'; details="file:$oldModifiedHash" }
  Add-Event $trace @{ action='install'; kind='user-tool'; target='uv'; status='completed'; details='new-install' }
  Add-Event $trace @{ action='install'; kind='user-tool'; target='codex'; status='completed'; details='new-install' }
  Add-Event $trace @{ action='snapshot'; kind='system-package'; target='Microsoft.VisualStudioCode'; status='before'; details='missing' }
  Add-Event $trace @{ action='install'; kind='system-package'; target='Microsoft.VisualStudioCode'; status='completed'; details='winget' }
  Add-Event $trace @{ action='snapshot'; kind='system-package'; target='Git.Git'; status='before'; details='present' }
  Add-Event $trace @{ action='phase'; kind='installer'; target='Install'; status='completed'; details='' }

  $env:AI_RESEARCH_DRY_RUN = '1'
  $env:AI_RESEARCH_TEST_COMMANDS = 'code,uv,npm,winget'
  $output = (& $installer -Mode Uninstall -InstallTraceFile $trace -CourseDir $workspace 2>&1 6>&1 | Out-String)
  if ($output -notmatch 'UNINSTALL VS_CODE_EXTENSION openai.chatgpt') { throw "New extension was not selected.`n$output" }
  if ($output -match 'UNINSTALL VS_CODE_EXTENSION mathematic.vscode-pdf') { throw "Reused extension must be preserved.`n$output" }
  if ($output -notmatch 'UNINSTALL_REMOVE_FILE' -or $output -notmatch 'created.txt') { throw "Unchanged created file was not selected.`n$output" }
  if ($output -notmatch 'UNINSTALL_PRESERVE_MODIFIED' -or $output -notmatch 'modified.txt') { throw "Modified learner file was not preserved.`n$output" }
  if ($output -notmatch 'UNINSTALL user-tool uv') { throw "Receipt-owned uv was not selected.`n$output" }
  if ($output -notmatch 'UNINSTALL user-tool codex package=@openai/codex' -or $output -notmatch 'DRY_RUN npm uninstall -g @openai/codex') {
    throw "Receipt-owned Codex CLI was not selected independently of its npm directory.`n$output"
  }
  if ($output -notmatch 'DRY_RUN UNINSTALL SYSTEM_PACKAGE Microsoft.VisualStudioCode') { throw "Receipt-owned system package was not selected.`n$output" }
  if ($output -match 'Git.Git') { throw "Pre-existing system package must be preserved.`n$output" }
  if ($output -notmatch 'FINAL_RESULT PASS - Receipt-based uninstall complete') { throw "Uninstall did not finish.`n$output" }

  Add-Event $incompleteTrace @{ action='phase'; kind='installer'; target='Install'; status='started'; details='agent=codex' }
  Add-Event $incompleteTrace @{ action='snapshot'; kind='system-package'; target='Git.Git'; status='before'; details='missing' }
  Add-Event $incompleteTrace @{ action='install'; kind='system-package'; target='Git.Git'; status='completed'; details='winget' }
  Add-Event $incompleteTrace @{ action='phase'; kind='installer'; target='Install'; status='failed'; details='later step failed' }
  $incompleteOutput = (& $installer -Mode Uninstall -InstallTraceFile $incompleteTrace -CourseDir $workspace 2>&1 6>&1 | Out-String)
  if ($incompleteOutput -notmatch 'UNINSTALL_INCOMPLETE_RECEIPT' -or $incompleteOutput -notmatch 'DRY_RUN UNINSTALL SYSTEM_PACKAGE Git.Git') {
    throw "A partial install receipt must roll back its individually completed additions.`n$incompleteOutput"
  }

  Add-Event $invalidTrace @{ action='phase'; kind='installer'; target='Check'; status='completed'; details='' }
  $failed = $false
  try { & $installer -Mode Uninstall -InstallTraceFile $invalidTrace -CourseDir $workspace *> $null }
  catch { $failed = $_.Exception.Message -match 'UNINSTALL_RECEIPT_INVALID' }
  if (-not $failed) { throw 'A trace without an Install phase must not be accepted as an uninstall receipt.' }
} finally {
  Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item Env:AI_RESEARCH_DRY_RUN -ErrorAction SilentlyContinue
  Remove-Item Env:AI_RESEARCH_TEST_COMMANDS -ErrorAction SilentlyContinue
}
Write-Host 'PASS receipt uninstall preserves reused and modified items'
