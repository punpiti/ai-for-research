[CmdletBinding()]
param(
  [ValidateSet('Check','Install','InstallSystem','SetupUser','Repair','Uninstall','UninstallSystem')][string]$Mode = 'Check',
  [ValidateSet('codex','claude','openrouter','antigravity')][string]$Agent,
  [string]$CourseDir = (Join-Path $HOME 'ai-for-research-workspace'),
  [string]$SystemLog,
  [string]$TraceFile,
  [string]$InstallTraceFile
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$DryRun = $env:AI_RESEARCH_DRY_RUN -eq '1'
$SetupVersion = '2026.10.08.20'
$TestCommands = @($env:AI_RESEARCH_TEST_COMMANDS -split ',' | Where-Object { $_ })
$DefaultProjectName = 'ai-for-research-workspace'
$CourseDirWasProvided = $PSBoundParameters.ContainsKey('CourseDir')
if (-not $CourseDirWasProvided -and $Mode -in @('Install','SetupUser','Repair')) {
  $projectName = $env:AI_RESEARCH_PROJECT_NAME
  if (-not $projectName -and -not $DryRun) { $projectName = Read-Host "Project folder name [$DefaultProjectName]" }
  if ([string]::IsNullOrWhiteSpace($projectName)) { $projectName = $DefaultProjectName }
  if ($projectName -in @('.','..') -or $projectName.IndexOfAny([char[]]'\/:*?"<>|') -ge 0 -or $projectName.EndsWith('.') -or $projectName.EndsWith(' ')) {
    throw 'PROJECT_NAME_INVALID Use one folder name without path separators, reserved characters, or a trailing dot/space.'
  }
  $CourseDir = Join-Path $HOME $projectName
}
function Trace([string]$Action, [string]$Kind, [string]$Target, [string]$Status, [string]$Details = '') {
  if ($DryRun -or -not $TraceFile) { return }
  $record = @{ schema = 1; at = [DateTime]::UtcNow.ToString('o'); phase = 'windows'; action = $Action; kind = $Kind; target = $Target; status = $Status; details = $Details }
  $line = ($record | ConvertTo-Json -Compress) + "`n"
  [IO.File]::AppendAllText($TraceFile, $line, [Text.UTF8Encoding]::new($false))
}
function Trace-Path([string]$Path, [string]$Stage) {
  if ($DryRun -or -not $TraceFile) { return }
  $state = 'missing'
  if (Test-Path -LiteralPath $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $state = 'symlink:preserve' }
    elseif ($item.PSIsContainer) { $state = 'directory' }
    else { $state = 'file:' + (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
  Trace 'snapshot' 'path' $Path $Stage $state
}
function Log([string]$Message) {
  Trace 'message' 'installer' $Mode 'observed' $Message
  if (-not $DryRun -and $Message -like 'AI workspace=*') {
    Write-Host '[AI for Research] FINAL_RESULT PASS - Setup complete. Open the AI panel in your workspace and sign in or configure your provider.'
    return
  }
  if ($DryRun -or $Mode -eq 'Check' -or $Message -match '^(SETUP_VERSION|DEVICE_CHECK|ADMIN_PHASE_REQUIRED|RUNTIME_READY|INSTALL_FAILED|FINAL_RESULT|UNINSTALL|workspace=|AI workspace=|STEP)') {
    Write-Host "[AI for Research] $Message"
  }
}
function Run-Quiet([string]$Step, [scriptblock]$Action, [int[]]$AcceptCodes = @(0)) {
  if (-not $TraceFile) { & $Action; return }
  Trace 'command' 'process' $Step 'started'
  $capture = $TraceFile + '.step-' + [guid]::NewGuid() + '.log'
  $savedPreference = $ErrorActionPreference
  try {
    $global:LASTEXITCODE = 0
    # Windows PowerShell 5 turns native stderr warnings into ErrorRecords.
    # Capture those warnings and decide success from the native exit code.
    $ErrorActionPreference = 'Continue'
    & $Action *>> $capture
    $code = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($AcceptCodes -notcontains $code) { throw "$Step failed (exit $code)." }
    Trace 'command' 'process' $Step 'completed' ([string]$code)
  } catch {
    Trace 'command' 'process' $Step 'failed' $_.Exception.Message
    throw
  } finally {
    $ErrorActionPreference = $savedPreference
    if (Test-Path $capture) {
      [IO.File]::AppendAllText([IO.Path]::ChangeExtension($TraceFile, '.log'), [IO.File]::ReadAllText($capture), [Text.UTF8Encoding]::new($false))
      Remove-Item $capture
    }
  }
  $global:LASTEXITCODE = $code
}
if (-not $DryRun -and $Mode -in @('Uninstall','UninstallSystem')) {
  if (-not $InstallTraceFile) {
    $traceDir = Join-Path $env:LOCALAPPDATA 'ai-for-research\install-traces'
    $InstallTraceFile = Get-ChildItem -LiteralPath $traceDir -Filter '*.jsonl' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTimeUtc -Descending |
      Where-Object {
        $candidate = $_
        try {
          @(Get-Content -LiteralPath $candidate.FullName | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json }) |
            Where-Object { $_.action -eq 'phase' -and $_.kind -eq 'installer' -and $_.target -eq 'Install' -and $_.status -eq 'started' } |
            Select-Object -First 1
        } catch { $false }
      } |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $InstallTraceFile -or -not (Test-Path -LiteralPath $InstallTraceFile -PathType Leaf)) {
    throw 'UNINSTALL_RECEIPT_MISSING No installation trace was found. Pass -InstallTraceFile with the exact trace printed by Install.'
  }
  $TraceFile = $InstallTraceFile
}
if (-not $DryRun -and $Mode -ne 'Check') {
  if (-not $TraceFile) {
    $traceDir = Join-Path $env:LOCALAPPDATA 'ai-for-research\install-traces'
    New-Item -ItemType Directory -Force -Path $traceDir | Out-Null
    $TraceFile = Join-Path $traceDir ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ-') + [guid]::NewGuid() + '.jsonl')
  }
  $env:AI_RESEARCH_TRACE_FILE = $TraceFile
  $phaseDetails = if ($Mode -in @('Uninstall','UninstallSystem')) { "receipt=$InstallTraceFile; version=$SetupVersion" } else { "agent=$Agent; version=$SetupVersion" }
  Trace 'phase' 'installer' $Mode 'started' $phaseDetails
  Log "INSTALL_TRACE $TraceFile"
}
$watchedPaths = @()
$toolRoot = Join-Path $env:LOCALAPPDATA 'ai-for-research'
if ($Mode -notin @('Uninstall','UninstallSystem')) {
  $watchedPaths = @('content.md','README.md','AGENTS.md','CLAUDE.md','.ai\PROJECT_STATE.md','.ai\TOKEN_BUDGET.md','.ai\agent-project-kit\STARTUP.md','.ai\agent-project-kit\TOKEN_DISCIPLINE.md','templates\modern-thai.yaml','templates\modern-thai.lua','templates\modern-thai.tex','templates\fonts\Sarabun-Regular.ttf','templates\fonts\Sarabun-Bold.ttf','templates\fonts\OFL.txt','tools\import-documents.sh','tools\import-documents.ps1','tools\import-office.py','tools\install-summary.py','.vscode\extensions.json') | ForEach-Object { Join-Path $CourseDir $_ }
  $watchedPaths += @('python','envs\research','envs\research\pyvenv.cfg','TinyTeX','TinyTeX\tlpkg\texlive.tlpdb','node','npm','uv-tools','bin','cache','texmf','texmf-var','texmf-config','tessdata') | ForEach-Object { Join-Path $toolRoot $_ }
  foreach ($path in $watchedPaths) { Trace-Path $path 'before' }
  Trace 'snapshot' 'workspace' $CourseDir 'before' 'preserve-personal-files'
}
Log "SETUP_VERSION $SetupVersion"
function Has([string]$Command) {
  if ($TestCommands.Count -gt 0) { return $TestCommands -contains $Command }
  return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}
function Refresh-ToolPath {
  if ($DryRun) { return }
  # Keep this shell's PATH entries and discover installed tools whose installers
  # did not register PATH (notably Tesseract and portable Poppler).
  $directories = @(
    (Join-Path $env:ProgramFiles 'Git\cmd'),
    (Join-Path $env:ProgramFiles 'Pandoc'),
    (Join-Path $env:LOCALAPPDATA 'Pandoc'),
    (Join-Path $env:ProgramFiles 'Tesseract-OCR'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin'),
    (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links'),
    (Join-Path $env:ProgramFiles 'WinGet\Links')
  )
  foreach ($packageRoot in @((Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'), (Join-Path $env:ProgramFiles 'WinGet\Packages'))) {
    $popplerPackages = Get-ChildItem -Path $packageRoot -Directory -Filter 'oschwartz10612.Poppler_*' -ErrorAction SilentlyContinue
    foreach ($package in $popplerPackages) {
      $directories += @(Get-ChildItem -Path $package.FullName -File -Filter 'pdftotext.exe' -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $_.DirectoryName })
    }
  }
  $script:DiscoveredToolDirectories = @($directories | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -Unique)
  $allPaths = @($env:PATH -split ';') + @([Environment]::GetEnvironmentVariable('Path','Machine') -split ';') + @([Environment]::GetEnvironmentVariable('Path','User') -split ';') + $script:DiscoveredToolDirectories
  $env:PATH = ($allPaths | Where-Object { $_ } | Select-Object -Unique) -join ';'
}
function Confirm-WinGetResult([string]$Command, [string]$Package, [int]$ExitCode) {
  Refresh-ToolPath
  # WinGet uses this HRESULT when an installed package has no applicable update.
  if ($ExitCode -ne 0 -and $ExitCode -ne -1978335189) { throw "WinGet failed: $Package ($ExitCode)" }
  if (-not (Has $Command)) { throw "TOOL_NOT_FOUND $Package is installed but $Command could not be located. Add its executable directory to PATH and rerun Install." }
  if ($ExitCode -eq -1978335189) { Log "REUSE $Command (WinGet: no applicable update)" }
}
function Test-WinGetPackageInstalled([string]$Package) {
  if ($DryRun) { return $TestCommands -contains "package:$Package" }
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $inventory = (& winget list --id $Package --exact --accept-source-agreements 2>$null | Out-String)
    return $inventory -match [regex]::Escape($Package)
  } finally { $ErrorActionPreference = $savedPreference }
}
Refresh-ToolPath
function Is-Admin {
  if ($DryRun) { return $false }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Read-InstallReceipt {
  if (-not $InstallTraceFile -or -not (Test-Path -LiteralPath $InstallTraceFile -PathType Leaf)) {
    throw 'UNINSTALL_RECEIPT_MISSING Pass -InstallTraceFile with the exact trace printed by Install.'
  }
  $events = @(Get-Content -LiteralPath $InstallTraceFile | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json })
  $started = $events | Where-Object { $_.action -eq 'phase' -and $_.kind -eq 'installer' -and $_.target -eq 'Install' -and $_.status -eq 'started' } | Select-Object -First 1
  if (-not $started) { throw 'UNINSTALL_RECEIPT_INVALID The trace does not contain an Install phase.' }
  $completed = $events | Where-Object { $_.action -eq 'phase' -and $_.kind -eq 'installer' -and $_.target -eq 'Install' -and $_.status -eq 'completed' } | Select-Object -First 1
  if (-not $completed) { Log 'UNINSTALL_INCOMPLETE_RECEIPT Installation did not finish; only individually completed additions will be considered.' }
  return $events
}
function Get-ReceiptBefore([object[]]$Events, [string]$Kind, [string]$Target) {
  return $Events | Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq $Kind -and $_.target -ieq $Target -and $_.status -eq 'before' } | Select-Object -First 1
}
function Get-ReceiptAfter([object[]]$Events, [string]$Kind, [string]$Target) {
  return $Events | Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq $Kind -and $_.target -ieq $Target -and $_.status -eq 'after' } | Select-Object -Last 1
}
function Test-PathInside([string]$Path, [string]$Root) {
  if (-not $Path -or -not $Root) { return $false }
  $fullPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $fullRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  return $fullPath.StartsWith($fullRoot + '\', [StringComparison]::OrdinalIgnoreCase)
}
function Remove-ReceiptFile([string]$Path, [string]$AfterState) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Log "UNINSTALL_REUSE_ALREADY_ABSENT $Path"; return }
  if ($AfterState -notmatch '^file:([0-9a-f]{64})$') { Log "UNINSTALL_PRESERVE_UNVERIFIED $Path"; return }
  $expected = $Matches[1]
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { Log "UNINSTALL_PRESERVE_MODIFIED $Path"; return }
  Log "UNINSTALL_REMOVE_FILE $Path"
  if (-not $DryRun) { Remove-Item -LiteralPath $Path -Force }
  Trace 'uninstall' 'path' $Path 'completed' 'created-by-install; hash-matched'
}
function Remove-UserItemsFromReceipt([object[]]$Events) {
  $workspaceEvent = $Events | Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq 'workspace' -and $_.status -eq 'before' } | Select-Object -First 1
  $receiptCourseDir = if ($workspaceEvent) { [string]$workspaceEvent.target } else { $CourseDir }
  $receiptToolRoot = Join-Path $env:LOCALAPPDATA 'ai-for-research'

  $removedUserTools = @($Events | Where-Object { $_.action -eq 'uninstall' -and $_.kind -eq 'user-tool' -and $_.status -eq 'completed' } | Select-Object -ExpandProperty target -Unique)
  $addedCliTools = @($Events | Where-Object { $_.action -eq 'install' -and $_.kind -eq 'user-tool' -and $_.target -in @('codex','claude') -and $_.status -eq 'completed' } | Select-Object -ExpandProperty target -Unique) |
    Where-Object { $tool = $_; -not ($removedUserTools | Where-Object { $_ -ieq $tool }) }
  if ($addedCliTools.Count -gt 0) {
    $savedNpmPrefix = $env:npm_config_prefix
    $env:npm_config_prefix = Join-Path $receiptToolRoot 'npm'
    try {
      $npmExecutable = if (-not $DryRun) {
        $command = Get-Command npm -ErrorAction SilentlyContinue
        if ($command) { $command.Source }
        else { Get-ChildItem -LiteralPath (Join-Path $receiptToolRoot 'node') -Filter 'npm.cmd' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }
      }
      foreach ($tool in $addedCliTools) {
        $package = if ($tool -eq 'codex') { '@openai/codex' } else { '@anthropic-ai/claude-code' }
        Log "UNINSTALL user-tool $tool package=$package (installed by receipt)"
        if ($DryRun) { Log "DRY_RUN npm uninstall -g $package" }
        elseif ($npmExecutable) {
          Run-Quiet "Uninstall $tool CLI" { & $npmExecutable uninstall -g $package } @(0)
          Trace 'uninstall' 'user-tool' $tool 'completed' "package=$package; installed-by-receipt"
        } else { Log "UNINSTALL_PRESERVE_TOOL_MISSING npm; package=$package" }
      }
    } finally {
      if ($null -eq $savedNpmPrefix) { Remove-Item Env:npm_config_prefix -ErrorAction SilentlyContinue }
      else { $env:npm_config_prefix = $savedNpmPrefix }
    }
  }

  $profiles = $Events | Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq 'vscode-profile' -and $_.status -eq 'before' } | Select-Object -ExpandProperty target -Unique
  foreach ($profile in $profiles) {
    $extensions = $Events | Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq 'vscode-extension' -and $_.status -eq 'before' -and $_.details -like 'missing*' } | Select-Object -ExpandProperty target -Unique
    foreach ($extension in $extensions) {
      Log "UNINSTALL VS_CODE_EXTENSION $extension profile=$profile"
      if (-not $DryRun -and (Has 'code')) { Run-Quiet "Uninstall extension $extension" { code --profile $profile --uninstall-extension $extension } @(0,1) }
      elseif (-not $DryRun) { Log "UNINSTALL_PRESERVE_TOOL_MISSING code; extension=$extension" }
      Trace 'uninstall' 'vscode-extension' $extension 'completed' "profile=$profile; installed-by-receipt"
    }
  }

  $antigravityExtensions = $Events |
    Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq 'antigravity-extension' -and $_.status -eq 'before' -and $_.details -like 'missing*' } |
    Select-Object -ExpandProperty target -Unique
  foreach ($extension in $antigravityExtensions) {
    Log "UNINSTALL ANTIGRAVITY_EXTENSION $extension"
    if (-not $DryRun -and (Has 'agy-ide')) { Run-Quiet "Uninstall Antigravity extension $extension" { agy-ide --uninstall-extension $extension } @(0,1) }
    elseif (-not $DryRun) { Log "UNINSTALL_PRESERVE_TOOL_MISSING agy-ide; extension=$extension" }
    Trace 'uninstall' 'antigravity-extension' $extension 'completed' 'installed-by-receipt'
  }

  $pathTargets = $Events | Where-Object { $_.action -eq 'snapshot' -and $_.kind -eq 'path' -and $_.status -eq 'before' -and $_.details -eq 'missing' } | Select-Object -ExpandProperty target -Unique
  $directoryTargets = @()
  foreach ($target in $pathTargets) {
    $after = Get-ReceiptAfter $Events 'path' $target
    if (-not $after) { continue }
    $insideWorkspace = Test-PathInside $target $receiptCourseDir
    $insideToolRoot = Test-PathInside $target $receiptToolRoot
    $isThaiData = $target -like '*\Tesseract-OCR\tessdata\tha.traineddata'
    if (-not ($insideWorkspace -or $insideToolRoot -or $isThaiData)) { Log "UNINSTALL_PRESERVE_OUTSIDE_BOUNDARY $target"; continue }
    if ([string]$after.details -like 'file:*') { Remove-ReceiptFile $target ([string]$after.details) }
    elseif ([string]$after.details -eq 'directory' -and $insideToolRoot) { $directoryTargets += $target }
  }

  foreach ($target in ($directoryTargets | Sort-Object Length -Descending -Unique)) {
    if (Test-Path -LiteralPath $target -PathType Container) {
      Log "UNINSTALL_REMOVE_COURSE_RUNTIME $target"
      if (-not $DryRun) { Remove-Item -LiteralPath $target -Recurse -Force }
      Trace 'uninstall' 'path' $target 'completed' 'course-runtime-created-by-install'
    }
  }

  $pathChanges = $Events | Where-Object { $_.action -eq 'modify' -and $_.kind -eq 'user-path' -and $_.status -eq 'completed' }
  foreach ($change in $pathChanges) {
    $addedPaths = @($change.details | ConvertFrom-Json)
    $currentPaths = @([Environment]::GetEnvironmentVariable('Path','User') -split ';' | Where-Object { $_ })
    $remaining = @($currentPaths | Where-Object { $candidate = $_; -not ($addedPaths | Where-Object { $_ -ieq $candidate }) })
    if ($remaining.Count -ne $currentPaths.Count) {
      Log "UNINSTALL_REMOVE_USER_PATH $($addedPaths -join ',')"
      if (-not $DryRun) { [Environment]::SetEnvironmentVariable('Path', ($remaining -join ';'), 'User') }
      Trace 'uninstall' 'user-path' 'Path' 'completed' ($addedPaths | ConvertTo-Json -Compress)
    }
  }

  $uvAdded = $Events | Where-Object { $_.action -eq 'install' -and $_.kind -eq 'user-tool' -and $_.target -eq 'uv' -and $_.status -eq 'completed' } | Select-Object -First 1
  if ($uvAdded -and (Has 'uv')) {
    Log 'UNINSTALL user-tool uv (installed by receipt)'
    if (-not $DryRun) { Run-Quiet 'Uninstall uv' { uv self uninstall } @(0) }
    Trace 'uninstall' 'user-tool' 'uv' 'completed' 'installed-by-receipt'
  }
}
function Get-ReceiptSystemPackages([object[]]$Events) {
  $installed = @($Events | Where-Object { $_.action -eq 'install' -and $_.kind -eq 'system-package' -and $_.status -eq 'completed' } | Select-Object -ExpandProperty target -Unique)
  $removed = @($Events | Where-Object { $_.action -eq 'uninstall' -and $_.kind -eq 'system-package' -and $_.status -eq 'completed' } | Select-Object -ExpandProperty target -Unique)
  return @($installed | Where-Object {
    $package = $_
    $before = Get-ReceiptBefore $Events 'system-package' $package
    $before -and $before.details -eq 'missing' -and -not ($removed | Where-Object { $_ -ieq $package })
  })
}
function Uninstall-SystemItemsFromReceipt([object[]]$Events) {
  if (-not (Is-Admin)) { throw 'UninstallSystem requires PowerShell opened with Run as administrator.' }
  if (-not (Has 'winget')) { throw 'WinGet is required to remove system packages recorded by the installation receipt.' }
  foreach ($package in (Get-ReceiptSystemPackages $Events)) {
    Log "UNINSTALL SYSTEM_PACKAGE $package"
    if (-not $DryRun) { Run-Quiet "Uninstall $package" { winget uninstall --id $package --exact --silent --accept-source-agreements } @(0,-1978335189) }
    Trace 'uninstall' 'system-package' $package 'completed' 'installed-by-receipt'
  }
}
function Uninstall-FromReceipt {
  if (Is-Admin) { throw 'Uninstall must start in a normal PowerShell; it requests UAC only for system packages.' }
  $events = @(Read-InstallReceipt)
  Log "UNINSTALL_RECEIPT $InstallTraceFile"
  $answer = if ($DryRun) { 'y' } else { Read-Host 'Remove only items this receipt proves were added? Existing and modified items will be preserved. [y/N]' }
  if ($answer -notmatch '^[Yy]$') { Log 'UNINSTALL_CANCELLED'; return }
  Remove-UserItemsFromReceipt $events
  $systemPackages = @(Get-ReceiptSystemPackages $events)
  if ($systemPackages.Count -gt 0) {
    Log 'UNINSTALL_ADMIN_PHASE_REQUIRED One UAC window removes only system packages added by this receipt.'
    if ($DryRun) { foreach ($package in $systemPackages) { Log "DRY_RUN UNINSTALL SYSTEM_PACKAGE $package" } }
    else {
      $childArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Mode UninstallSystem -InstallTraceFile "' + $InstallTraceFile + '"'
      try { $child = Start-Process powershell.exe -Verb RunAs -ArgumentList $childArgs -Wait -PassThru }
      catch { throw "Could not start administrator uninstall phase (UAC may have been cancelled): $($_.Exception.Message)" }
      if ($child.ExitCode -ne 0) { throw "System uninstall failed (exit $($child.ExitCode)). Receipt: $InstallTraceFile" }
    }
  }
  Log 'FINAL_RESULT PASS - Receipt-based uninstall complete; reused items and modified workspace files were preserved.'
}
function Check-Tools {
  $os = Get-CimInstance Win32_OperatingSystem
  $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($CourseDir).TrimEnd(':\'))
  $ramGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  $diskGb = [math]::Round($drive.Free / 1GB, 1)
  $network = Test-NetConnection -ComputerName github.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
  $aiTargets = if ($Agent) { @($Agent) } else { @('codex','claude','openrouter','antigravity') }
  $aiCommands = @{ codex = 'codex'; claude = 'claude'; antigravity = 'agy-ide'; openrouter = 'code' }
  $aiTargets = $aiTargets | ForEach-Object { $aiCommands[$_] }
  $availableAi = $aiTargets | Where-Object { Has $_ }
  $missingAi = $aiTargets | Where-Object { -not (Has $_) }
  $availableAiText = if ($availableAi) { $availableAi -join ',' } else { 'none' }
  $missingAiText = if ($missingAi) { $missingAi -join ',' } else { 'none' }
  Log "AI_FRONTENDS available=$availableAiText missing=$missingAiText"
  $osReady = $os.Version -like '10.*' -and [int]$os.BuildNumber -ge 22000
  $archReady = $env:PROCESSOR_ARCHITECTURE -match '64|ARM'
  $issues = @()
  if (-not $osReady) { $issues += 'Windows 11' }
  if (-not $archReady) { $issues += '64-bit architecture' }
  if ($ramGb -lt 8) { $issues += "RAM 8 GB (found $ramGb GB)" }
  if ($diskGb -lt 20) { $issues += "free disk 20 GB (found $diskGb GB)" }
  if (-not $network) { $issues += 'HTTPS network access to github.com' }
  if ($issues.Count -eq 0) {
    if ($Mode -eq 'Check') { Log 'FINAL_RESULT PASS - Device is ready.' }
    else { Log 'DEVICE_CHECK_PASS Hardware and network checks passed; tool setup continues.' }
    return $true
  }
  Log "FINAL_RESULT FAIL - Missing: $($issues -join '; ')"
  return $false
}
function New-CourseWorkspace {
  if ($DryRun) { Log "DRY_RUN workspace=$CourseDir"; return }
  New-Item -ItemType Directory -Force -Path $CourseDir,(Join-Path $CourseDir 'input\original'),(Join-Path $CourseDir 'input\markdown'),(Join-Path $CourseDir 'output'),(Join-Path $CourseDir 'tools'),(Join-Path $CourseDir '.ai\agent-project-kit') | Out-Null
  $templateDir = Join-Path $CourseDir 'templates'
  $fontDir = Join-Path $templateDir 'fonts'
  New-Item -ItemType Directory -Force -Path $fontDir | Out-Null
  $fontFiles = @(
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/Sarabun-Regular.ttf'; Path = (Join-Path $fontDir 'Sarabun-Regular.ttf') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/Sarabun-Bold.ttf'; Path = (Join-Path $fontDir 'Sarabun-Bold.ttf') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/OFL.txt'; Path = (Join-Path $fontDir 'OFL.txt') }
  )
  foreach ($file in $fontFiles) { Invoke-WebRequest -UseBasicParsing -Uri $file.Url -OutFile $file.Path }
  foreach ($file in $fontFiles) {
    if (-not (Test-Path $file.Path) -or (Get-Item $file.Path).Length -eq 0) { throw "FONT_SETUP_FAILED Missing or empty file: $($file.Path)" }
  }
  Log 'FONT_READY Sarabun Regular/Bold bundled in workspace.'
  $content = Join-Path $CourseDir 'content.md'
  $readme = Join-Path $CourseDir 'README.md'
  if (-not (Test-Path $content)) { Set-Content -Encoding utf8 $content "# My AI Research Workspace`n`nDescribe the research task here.`n" }
  if (-not (Test-Path $readme)) {
    $projectName = Split-Path -Leaf $CourseDir.TrimEnd('\','/')
    Set-Content -Encoding utf8 $readme "# $projectName`n`nThis folder is one AI-assisted research project. Keep permitted source files in input/original/, derived Markdown in input/markdown/, and generated work in output/.`n"
  }
  $starterFiles = @(
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-summary.py'; Path = (Join-Path $CourseDir 'tools\install-summary.py') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.yaml'; Path = (Join-Path $templateDir 'modern-thai.yaml') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.lua'; Path = (Join-Path $templateDir 'modern-thai.lua') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.tex'; Path = (Join-Path $templateDir 'modern-thai.tex') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-AGENTS.md'; Path = (Join-Path $CourseDir 'AGENTS.md') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-STARTUP.md'; Path = (Join-Path $CourseDir '.ai\agent-project-kit\STARTUP.md') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-TOKEN-DISCIPLINE.md'; Path = (Join-Path $CourseDir '.ai\agent-project-kit\TOKEN_DISCIPLINE.md') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-documents.sh'; Path = (Join-Path $CourseDir 'tools\import-documents.sh') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-documents.ps1'; Path = (Join-Path $CourseDir 'tools\import-documents.ps1') },
    @{ Url = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-office.py'; Path = (Join-Path $CourseDir 'tools\import-office.py') }
  )
  foreach ($file in $starterFiles) { Invoke-WebRequest -UseBasicParsing -Uri $file.Url -OutFile $file.Path }
  $projectState = Join-Path $CourseDir '.ai\PROJECT_STATE.md'
  if (-not (Test-Path -LiteralPath $projectState)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-PROJECT-STATE.md' -OutFile $projectState
  }
  $tokenBudget = Join-Path $CourseDir '.ai\TOKEN_BUDGET.md'
  if (-not (Test-Path -LiteralPath $tokenBudget)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-TOKEN-BUDGET.md' -OutFile $tokenBudget
  }
  Log "workspace=$CourseDir"
}
function Configure-VSCode {
  if (-not (Has 'code')) { throw 'PREREQUISITE_MISSING VS Code CLI is not on PATH. Close PowerShell, open a new normal PowerShell, then rerun SetupUser.' }
  $profile = "AI for Research - $Agent"
  $aiExtension = switch ($Agent) {
    'codex' { 'openai.chatgpt' }
    'claude' { 'anthropic.claude-code' }
    'openrouter' { 'saoudrizwan.claude-dev' }
    'antigravity' { $null }
  }
  $usageExtension = switch ($Agent) {
    'codex' { 'ganymede404.vscode-codex-usage' }
    'claude' { 'growthjack.claude-code-usage' }
    'openrouter' { 'ThiagoSantosDevBR.openrouter-ai-monitor' }
    'antigravity' { $null }
  }
  $extensions = @('mathematic.vscode-pdf', 'mechatroner.rainbow-csv', 'AykutSarac.jsoncrack-vscode')
  if ($usageExtension) { $extensions = @($usageExtension) + $extensions }
  if ($aiExtension) { $extensions = @($aiExtension) + $extensions }
  $existingExtensions = @()
  $extensionsKnown = $false
  if (-not $DryRun) {
    Trace 'snapshot' 'vscode-profile' $profile 'before' 'ownership-unknown-preserve'
    $queryPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $existingExtensions = @(code --profile $profile --list-extensions 2>$null)
      $extensionsKnown = $LASTEXITCODE -eq 0
    } finally { $ErrorActionPreference = $queryPreference }
  }
  Log "CREATE VS_CODE_PROFILE profile=$profile workspace=$CourseDir"
  Log 'STEP Preparing your AI workspace and extensions.'
  if ($DryRun) { Log "DRY_RUN code --profile $profile $CourseDir" } else { Run-Quiet 'Open VS Code workspace' { code --profile $profile $CourseDir } }
  foreach ($extension in $extensions) {
    $before = if (-not $extensionsKnown) { 'unknown-preserve' } elseif ($existingExtensions -contains $extension) { 'present' } else { 'missing' }
    Trace 'snapshot' 'vscode-extension' $extension 'before' "$before; profile=$profile"
    if (-not $DryRun -and $extensionsKnown -and $existingExtensions -contains $extension) {
      Trace 'snapshot' 'vscode-extension' $extension 'after' "present; profile=$profile; reused"
      continue
    }
    Log "INSTALL VS_CODE_EXTENSION $extension profile=$profile"
    if ($DryRun) { Log "DRY_RUN code --profile $profile --install-extension $extension" } else { Run-Quiet "Install extension $extension" { code --profile $profile --install-extension $extension } }
    Trace 'snapshot' 'vscode-extension' $extension 'after' "present; profile=$profile"
  }
  if ($DryRun) { return }
  $vscodeDir = Join-Path $CourseDir '.vscode'
  New-Item -ItemType Directory -Force -Path $vscodeDir | Out-Null
  @{ recommendations = $extensions } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $vscodeDir 'extensions.json')
}
function Configure-Antigravity {
  $extensions = @('mathematic.vscode-pdf', 'sourabhr10122002.antigravity-quota-checker')
  if (Has 'agy-ide') {
    $existingExtensions = @()
    $extensionsKnown = $false
    if (-not $DryRun) {
      $queryPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $existingExtensions = @(agy-ide --list-extensions 2>$null)
        $extensionsKnown = $LASTEXITCODE -eq 0
      } finally { $ErrorActionPreference = $queryPreference }
    }
    foreach ($extension in $extensions) {
      $before = if (-not $extensionsKnown) { 'unknown-preserve' } elseif ($existingExtensions -contains $extension) { 'present' } else { 'missing' }
      Trace 'snapshot' 'antigravity-extension' $extension 'before' $before
      if (-not $DryRun -and $extensionsKnown -and $existingExtensions -contains $extension) {
        Trace 'snapshot' 'antigravity-extension' $extension 'after' 'present; reused'
        continue
      }
      Log "INSTALL ANTIGRAVITY_EXTENSION $extension"
      if ($DryRun) { Log "DRY_RUN agy-ide --install-extension $extension" } else { agy-ide --install-extension $extension }
      Trace 'snapshot' 'antigravity-extension' $extension 'after' 'present'
    }
  }
  else {
    Log "ANTIGRAVITY_GUI_SETUP Open Antigravity IDE, open folder $CourseDir, then install extensions $($extensions -join ', ') from Extensions. The agy-ide command is optional."
  }
  $vscodeDir = Join-Path $CourseDir '.vscode'
  if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $vscodeDir | Out-Null
    @{ recommendations = $extensions } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $vscodeDir 'extensions.json')
  }
}
function Get-SystemPackages {
  $packages = @(
    @{ Command = 'git'; Package = 'Git.Git' },
    @{ Command = 'pandoc'; Package = 'JohnMacFarlane.Pandoc' },
    @{ Command = 'tesseract'; Package = 'tesseract-ocr.tesseract' },
    @{ Command = 'pdftotext'; Package = 'oschwartz10612.Poppler' },
    @{ Command = 'pdftoppm'; Package = 'oschwartz10612.Poppler' },
    @{ Command = 'pdfinfo'; Package = 'oschwartz10612.Poppler' }
  )
  if ($Agent -ne 'antigravity') { $packages = @(@{ Command = 'code'; Package = 'Microsoft.VisualStudioCode' }) + $packages }
  return $packages
}
function Needs-SystemSetup {
  foreach ($item in (Get-SystemPackages)) { if (-not (Has $item.Command)) { return $true } }
  if ($DryRun) { return -not (Has 'tha-traineddata') }
  $tesseractRoot = Split-Path (Get-Command tesseract).Source
  return -not (Test-Path (Join-Path $tesseractRoot 'tessdata\tha.traineddata'))
}
function Install-SystemTools {
  if (-not (Is-Admin)) { throw 'InstallSystem requires PowerShell opened with Run as administrator.' }
  if (-not $Agent) { throw 'InstallSystem requires -Agent codex, claude, openrouter, or antigravity.' }
  if (-not (Check-Tools)) { throw 'INSTALL_STOPPED System requirements did not pass. Nothing was installed.' }
  if (-not (Has 'winget')) { throw 'WinGet is required. Update App Installer from Microsoft Store and rerun.' }
  Log "ADMIN PHASE: checks the selected workspace, document, PDF and Thai-English OCR tools; installs only missing items. agent=$Agent"
  if ($Mode -ne 'InstallSystem') { $answer = Read-Host 'Continue? [y/N]'; if ($answer -notmatch '^[Yy]$') { return } }
  $packages = Get-SystemPackages
  foreach ($item in $packages) {
    if (Has $item.Command) { Trace 'snapshot' 'system-package' $item.Package 'before' 'present'; Log "REUSE $($item.Command)"; continue }
    if (Test-WinGetPackageInstalled $item.Package) {
      Trace 'snapshot' 'system-package' $item.Package 'before' 'present'
      throw "TOOL_NOT_FOUND $($item.Package) was installed before this run but $($item.Command) is unavailable. Repair its PATH or application installation; it will not be claimed or replaced by this installer."
    }
    Trace 'snapshot' 'system-package' $item.Package 'before' 'missing'
    Trace 'install' 'system-package' $item.Package 'started' 'winget'
    Log "INSTALL $($item.Package)"
    Run-Quiet "Install $($item.Package)" { winget install --id $item.Package --exact --source winget --accept-package-agreements --accept-source-agreements --silent } @(0,-1978335189)
    Confirm-WinGetResult $item.Command $item.Package $LASTEXITCODE
    Trace 'install' 'system-package' $item.Package 'completed' 'winget; shared-system-software-preserve'
  }
  $tesseractCommand = Get-Command tesseract -ErrorAction SilentlyContinue
  $tesseractRoot = if ($tesseractCommand) { Split-Path $tesseractCommand.Source } else { Join-Path $env:ProgramFiles 'Tesseract-OCR' }
  $tessdataDir = Join-Path $tesseractRoot 'tessdata'
  $thaiData = Join-Path $tessdataDir 'tha.traineddata'
  Trace-Path $thaiData 'before'
  if (-not (Test-Path $thaiData)) {
    New-Item -ItemType Directory -Force -Path $tessdataDir | Out-Null
    Log 'INSTALL Tesseract Thai language data'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/tha.traineddata' -OutFile $thaiData
  } else { Log 'REUSE Tesseract Thai language data' }
  Trace-Path $thaiData 'after'
  if ($Agent -eq 'antigravity' -and -not (Has 'agy-ide')) {
    Log 'INSTALL Antigravity IDE from the official Google download page; complete its installer before SetupUser.'
    Start-Process 'https://antigravity.google/download#antigravity-ide'
  }
  Log 'System installation finished. Returning to the normal-user installer.'
  Log 'ADMIN_PHASE_COMPLETE The original normal-user window continues automatically in Install mode.'
  return
}
function Install-UserTools {
  if (Is-Admin) { throw 'SetupUser must run in a normal, non-Administrator PowerShell. Close this window and open PowerShell normally.' }
  if (-not $Agent) { $Agent = Read-Host 'Choose AI frontend [claude/codex/openrouter]' }
  Log 'STEP Preparing your workspace files.'
  Refresh-ToolPath
  if (-not $DryRun) {
    $userPaths = @([Environment]::GetEnvironmentVariable('Path','User') -split ';' | Where-Object { $_ })
    $missingPaths = @($script:DiscoveredToolDirectories | Where-Object { $userPaths -notcontains $_ })
    if ($missingPaths.Count -gt 0) {
      Trace 'modify' 'user-path' 'Path' 'started' ($missingPaths | ConvertTo-Json -Compress)
      [Environment]::SetEnvironmentVariable('Path', (($userPaths + $missingPaths) -join ';'), 'User')
      Trace 'modify' 'user-path' 'Path' 'completed' ($missingPaths | ConvertTo-Json -Compress)
      Log 'TOOL_PATH_READY Installed document tools added to your user PATH.'
    }
  }
  New-CourseWorkspace
  if ($DryRun) { Log 'DRY_RUN runtime Python 3.12 + user-owned TinyTeX + scoped Codex permissions' }
  else {
    $env:PATH = "$HOME\.local\bin;" + $env:PATH
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $env:LOCALAPPDATA 'ai-for-research\python'
    $env:UV_CACHE_DIR = Join-Path $env:LOCALAPPDATA 'ai-for-research\cache\uv'
    if (Has 'uv') { Trace 'snapshot' 'system-tool' 'uv' 'before' 'present' }
    if (-not (Has 'uv')) {
      $uvScript = Join-Path $env:TEMP ('ai-research-uv-' + [guid]::NewGuid() + '.ps1')
      try {
        Invoke-WebRequest -UseBasicParsing https://astral.sh/uv/install.ps1 -OutFile $uvScript
        Trace 'install' 'user-tool' 'uv' 'started' 'new-install; shared-user-tool-preserve'
        Run-Quiet 'Install uv' { & $uvScript }
        Trace 'install' 'user-tool' 'uv' 'completed' 'shared-user-tool-preserve'
      } finally { Remove-Item $uvScript -ErrorAction SilentlyContinue }
    }
    $runtimeScript = Join-Path $env:TEMP ('ai-research-runtime-' + [guid]::NewGuid() + '.py')
    try {
      Invoke-WebRequest -UseBasicParsing https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-runtime.py -OutFile $runtimeScript
      Log 'STEP Preparing Python and PDF tools. The first run may take several minutes.'
      Run-Quiet 'Prepare Python 3.12' { uv python install 3.12 }
      if ($LASTEXITCODE -ne 0) { throw 'Python installation failed.' }
      Run-Quiet 'Prepare research runtime' { uv run --no-project --python 3.12 python $runtimeScript --workspace $CourseDir --agent $Agent }
      if ($LASTEXITCODE -ne 0) { throw 'Research runtime setup failed.' }
    } finally { Remove-Item $runtimeScript -ErrorAction SilentlyContinue }
    . (Join-Path $CourseDir 'tools\runtime-env.ps1')
    Log 'RUNTIME_READY Python environment and Thai PDF test passed.'
  }
  if ($Agent -ne 'antigravity' -and -not (Has 'npm')) { throw 'PREREQUISITE_MISSING npm is not on PATH. Close PowerShell, open a new normal PowerShell, then rerun SetupUser.' }
  if (Has 'npm') {
    switch ($Agent) {
      'openrouter' { Log 'OPENROUTER_READY Cline extension; configure provider OpenRouter and your own key in the IDE.' }
      'codex' { if (Has 'codex') { Log 'REUSE codex' } else { Log 'INSTALL codex'; if ($DryRun) { Log 'DRY_RUN npm install -g @openai/codex' } else { Run-Quiet 'Install Codex' { npm install -g '@openai/codex' }; Trace 'install' 'user-tool' 'codex' 'completed' } } }
      'claude' { if (Has 'claude') { Log 'REUSE claude' } else { Log 'INSTALL claude'; if ($DryRun) { Log 'DRY_RUN npm install -g @anthropic-ai/claude-code' } else { Run-Quiet 'Install Claude Code' { npm install -g '@anthropic-ai/claude-code' }; Trace 'install' 'user-tool' 'claude' 'completed' } } }
      'antigravity' { if (-not (Has 'agy-ide')) { Log 'Antigravity will be opened through its desktop IDE; agy-ide is not required for workspace setup.' } }
    }
  }
  else { Log 'Node/npm was installed but this shell has not refreshed PATH. Reopen PowerShell and rerun with -Mode Repair.' }
  if ($Agent -eq 'antigravity') { Configure-Antigravity } else { Configure-VSCode }
  if (-not $DryRun) {
    foreach ($path in $watchedPaths) { Trace-Path $path 'after' }
    $python = Join-Path $env:VIRTUAL_ENV 'Scripts\python.exe'
    & $python (Join-Path $CourseDir 'tools\install-summary.py') --trace $TraceFile
    if ($LASTEXITCODE -ne 0) { throw 'Installation summary could not be generated. See the installation trace.' }
  }
  Log "AI workspace=$Agent installed. Next: open the workspace, open its AI panel, and sign in with your own account. The terminal command is only a fallback."
}
$installSucceeded = $false
try {
switch ($Mode) {
  'Install' {
    if ($DryRun) {
      if (Needs-SystemSetup) { Log 'DRY_RUN request UAC once for system tools, return to normal user' } else { Log 'REUSE_SYSTEM_TOOLS No Administrator phase needed.' }
      Install-UserTools; break
    }
    if (Is-Admin) { throw 'Install must start in a normal PowerShell; it requests UAC only for system tools.' }
    if (-not $Agent) { throw 'Install requires -Agent codex, claude, openrouter, or antigravity.' }
    if (-not (Check-Tools)) { throw 'INSTALL_STOPPED System requirements did not pass. Nothing was installed.' }
    foreach ($item in (Get-SystemPackages)) {
      $command = Get-Command $item.Command -ErrorAction SilentlyContinue
      $details = if ($command) { 'present; shared-system-software-preserve; source=' + $command.Source } else { 'missing' }
      Trace 'snapshot' 'system-tool' $item.Command 'before' $details
    }
    if (Needs-SystemSetup) {
      Log 'ADMIN_PHASE_REQUIRED One UAC window installs missing system tools; keep this normal window open.'
      $logPath = Join-Path $env:TEMP ('ai-research-system-' + [guid]::NewGuid() + '.log')
      Log "ADMIN_PHASE_LOG $logPath"
      $childArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Mode InstallSystem -Agent ' + $Agent + ' -CourseDir "' + $CourseDir + '" -SystemLog "' + $logPath + '" -TraceFile "' + $TraceFile + '"'
      try { $child = Start-Process powershell.exe -Verb RunAs -ArgumentList $childArgs -Wait -PassThru }
      catch { throw "Could not start administrator phase (UAC may have been cancelled): $($_.Exception.Message)" }
      if ($child.ExitCode -ne 0) { throw "System installation failed (exit $($child.ExitCode)). Details: $logPath" }
      Refresh-ToolPath
    } else { Log 'REUSE_SYSTEM_TOOLS No Administrator phase needed.' }
    Install-UserTools
  }
  'InstallSystem' {
    if ($SystemLog) { Start-Transcript -Path $SystemLog -Force | Out-Null }
    try { Install-SystemTools }
    catch { Write-Host "[AI for Research] SYSTEM_INSTALL_FAILED $($_.Exception.Message)"; exit 1 }
    finally { if ($SystemLog) { Stop-Transcript | Out-Null } }
  }
  'SetupUser' { Install-UserTools }
  'Repair' { if (Is-Admin) { Install-SystemTools } else { Install-UserTools } }
  'Uninstall' { Uninstall-FromReceipt }
  'UninstallSystem' { Uninstall-SystemItemsFromReceipt @(Read-InstallReceipt) }
}
if (($Mode -eq 'Check' -or $Mode -eq 'SetupUser') -and -not $DryRun) { if (-not (Check-Tools)) { throw 'Device readiness check failed.' } }
$installSucceeded = $true
} catch {
  if ($DryRun) { throw }
  Write-Host "[AI for Research] INSTALL_FAILED $($_.Exception.Message)"
  if ($TraceFile) { Write-Host ('[AI for Research] Details: ' + [IO.Path]::ChangeExtension($TraceFile, '.log')) }
  exit 1
} finally {
  foreach ($path in $watchedPaths) { Trace-Path $path 'after' }
  $status = if ($installSucceeded) { 'completed' } else { 'failed' }
  Trace 'phase' 'installer' $Mode $status
}
