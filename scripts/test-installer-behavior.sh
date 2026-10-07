#!/usr/bin/env bash
set -euo pipefail

installer="${1:?installer path required}"
agent="${2:?agent required}"
state="${3:?state required}"
commands='npm,code,uv'
selected_command="$agent"
[[ "$agent" == antigravity ]] && selected_command=agy-ide
case "$state" in
  present) commands="$commands,$selected_command" ;;
  missing) ;;
  no-npm) commands="code,uv,$selected_command" ;;
  no-code) commands="npm,uv,$selected_command" ;;
  *) echo "Unknown state: $state" >&2; exit 2 ;;
esac

set +e
output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_GRAD_AGENT="$agent" \
  AI_RESEARCH_COURSE_DIR="${TMPDIR:-/tmp}/ai-research-behavior-test" \
  bash "$installer" --setup-user 2>&1)"
status=$?
set -e
workspace_line="$(grep -n -m1 'DRY_RUN workspace=' <<<"$output" | cut -d: -f1)"
agent_line="$(grep -n -m1 -E 'REUSE (codex|claude)|INSTALL (codex|claude)|Install Antigravity IDE|INSTALL ANTIGRAVITY_EXTENSION|OPENROUTER_READY|PREREQUISITE_MISSING' <<<"$output" | cut -d: -f1)"
[[ -n "$workspace_line" && -n "$agent_line" && $workspace_line -lt $agent_line ]]
if [[ "$state" =~ ^(present|missing)$ && ( "$state" == present || "$agent" != antigravity ) ]]; then
  [[ "$output" == *'mathematic.vscode-pdf'* ]]
fi
if [[ "$agent" != antigravity && "$state" =~ ^(present|missing)$ ]]; then
  [[ "$output" == *'mechatroner.rainbow-csv'* && "$output" == *'AykutSarac.jsoncrack-vscode'* ]]
  profile_line="$(grep -n -m1 'CREATE VS_CODE_PROFILE' <<<"$output" | cut -d: -f1)"
  extension_line="$(grep -n -m1 'INSTALL VS_CODE_EXTENSION' <<<"$output" | cut -d: -f1)"
  [[ -n "$profile_line" && -n "$extension_line" && $profile_line -lt $extension_line ]]
fi

case "$agent:$state" in
  openrouter:present|openrouter:missing)
    [[ $status -eq 0 && "$output" == *'saoudrizwan.claude-dev'* && "$output" == *'ThiagoSantosDevBR.openrouter-ai-monitor'* && "$output" == *'OPENROUTER_READY'* ]]
    [[ "$output" != *'npm install'* && "$output" != *'openai.chatgpt'* && "$output" != *'anthropic.claude-code'* ]]
    ;;
  codex:missing)
    [[ $status -eq 0 && "$output" == *'DRY_RUN npm install -g @openai/codex'* && "$output" == *'openai.chatgpt'* && "$output" == *'ganymede404.vscode-codex-usage'* ]]
    [[ "$output" != *'@anthropic-ai/claude-code'* ]]
    ;;
  codex:present) [[ $status -eq 0 && "$output" == *'REUSE codex'* && "$output" != *'DRY_RUN npm install'* ]] ;;
  claude:missing)
    [[ $status -eq 0 && "$output" == *'DRY_RUN npm install -g @anthropic-ai/claude-code'* && "$output" == *'anthropic.claude-code'* && "$output" == *'growthjack.claude-code-usage'* ]]
    [[ "$output" != *'@openai/codex'* ]]
    ;;
  claude:present) [[ $status -eq 0 && "$output" == *'REUSE claude'* && "$output" != *'DRY_RUN npm install'* ]] ;;
  antigravity:missing) [[ $status -ne 0 && "$output" == *'Install Antigravity IDE'* && "$output" != *'VS_CODE_EXTENSION'* ]] ;;
  antigravity:present) [[ $status -eq 0 && "$output" == *'ANTIGRAVITY_EXTENSION mathematic.vscode-pdf'* && "$output" == *'sourabhr10122002.antigravity-quota-checker'* && "$output" != *'npm install'* && "$output" != *'openai.chatgpt'* && "$output" != *'anthropic.claude-code'* ]] ;;
  codex:no-npm|claude:no-npm|openrouter:no-npm) [[ $status -ne 0 && "$output" == *'PREREQUISITE_MISSING npm is not on PATH'* && "$output" != *'INSTALL VS_CODE_EXTENSION'* ]] ;;
  codex:no-code|claude:no-code|openrouter:no-code) [[ $status -ne 0 && "$output" == *'PREREQUISITE_MISSING VS Code CLI'* && "$output" != *'INSTALL VS_CODE_EXTENSION'* ]] ;;
  *) echo "Unknown case: $agent/$state" >&2; exit 2 ;;
esac

printf 'PASS installer=%s agent=%s state=%s\n' "$installer" "$agent" "$state"
