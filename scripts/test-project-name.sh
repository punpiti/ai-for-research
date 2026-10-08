#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
commands='npm,code,uv,codex'

for installer in setup-linux.sh setup-macos.sh; do
  output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_GRAD_AGENT=codex \
    AI_RESEARCH_PROJECT_NAME=thesis-water-quality bash "$root/downloads/$installer" --setup-user 2>&1)"
  [[ "$output" == *"DRY_RUN workspace=$HOME/thesis-water-quality"* ]]

  default_output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_GRAD_AGENT=codex \
    bash "$root/downloads/$installer" --setup-user 2>&1)"
  [[ "$default_output" == *"DRY_RUN workspace=$HOME/ai-for-research-workspace"* ]]

  blank_output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_GRAD_AGENT=codex \
    AI_RESEARCH_PROJECT_NAME='   ' bash "$root/downloads/$installer" --setup-user 2>&1)"
  [[ "$blank_output" == *"DRY_RUN workspace=$HOME/ai-for-research-workspace"* ]]

  set +e
  invalid_output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_GRAD_AGENT=codex \
    AI_RESEARCH_PROJECT_NAME='../outside' bash "$root/downloads/$installer" --setup-user 2>&1)"
  invalid_status=$?
  set -e
  [[ $invalid_status -eq 2 && "$invalid_output" == *'PROJECT_NAME_INVALID'* ]]

  set +e
  trailing_output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_GRAD_AGENT=codex \
    AI_RESEARCH_PROJECT_NAME='project.' bash "$root/downloads/$installer" --setup-user 2>&1)"
  trailing_status=$?
  set -e
  [[ $trailing_status -eq 2 && "$trailing_output" == *'PROJECT_NAME_INVALID'* ]]
done

if command -v pwsh >/dev/null 2>&1; then
  windows="$root/downloads/setup-windows.ps1"
  windows_test_root="$(mktemp -d)"
  trap 'rm -rf "$windows_test_root"' EXIT
  output="$(LOCALAPPDATA="$windows_test_root/local" ProgramFiles="$windows_test_root/program-files" TEMP="$windows_test_root/temp" \
    AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_RESEARCH_PROJECT_NAME=thesis-water-quality \
    pwsh -NoProfile -File "$windows" -Mode SetupUser -Agent codex 2>&1)"
  [[ "$output" == *"DRY_RUN workspace=$HOME/thesis-water-quality"* ]]

  default_output="$(LOCALAPPDATA="$windows_test_root/local" ProgramFiles="$windows_test_root/program-files" TEMP="$windows_test_root/temp" \
    AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" \
    pwsh -NoProfile -File "$windows" -Mode SetupUser -Agent codex 2>&1)"
  [[ "$default_output" == *"DRY_RUN workspace=$HOME/ai-for-research-workspace"* ]]

  set +e
  invalid_output="$(LOCALAPPDATA="$windows_test_root/local" ProgramFiles="$windows_test_root/program-files" TEMP="$windows_test_root/temp" \
    AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS="$commands" AI_RESEARCH_PROJECT_NAME='../outside' \
    pwsh -NoProfile -File "$windows" -Mode SetupUser -Agent codex 2>&1)"
  invalid_status=$?
  set -e
  [[ $invalid_status -ne 0 && "$invalid_output" == *'PROJECT_NAME_INVALID'* ]]
fi

echo 'Project-name installer checks passed.'
