#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/Windows VS Code/bin"
printf '#!/bin/sh\nexit 0\n' > "$scratch/Windows VS Code/bin/code"
export WSL_TEST_ROOT="$scratch" WSL_TEST_SITE="$root"
# Exercise the Windows helper handoff without installing anything on this host.
sed '/^case "$mode" in/,$d' "$root/downloads/setup-linux.sh" > "$scratch/functions.sh"
cat > "$scratch/runner.sh" <<'RUNNER'
#!/usr/bin/env bash
set -euo pipefail
source "$WSL_TEST_ROOT/functions.sh"
curl() { cp "$WSL_TEST_SITE/downloads/setup-vscode-wsl.ps1" "${@: -1}"; }
wslpath() {
  if [[ "$1" == -u ]]; then printf '%s\n' "$WSL_TEST_ROOT/Windows VS Code/bin/code.cmd"; else printf '%s\n' "$2"; fi
}
powershell.exe() {
  printf '%s\n' "$@" > "$WSL_TEST_ROOT/ps-args.txt"
  [[ "${WSL_TEST_FAIL:-0}" != 1 ]] || return 7
  printf 'VSCODE_CLI_PATH=C:\\Windows VS Code\\bin\\code.cmd\r\n'
}
setup_windows_vscode
[[ "$PATH" == "$WSL_TEST_ROOT/Windows VS Code/bin:"* ]]
RUNNER
AI_GRAD_AGENT=codex bash "$scratch/runner.sh"
grep -q -- '-NoProfile' "$scratch/ps-args.txt"
grep -q -- '-File' "$scratch/ps-args.txt"
if WSL_TEST_FAIL=1 AI_GRAD_AGENT=codex bash "$scratch/runner.sh" > "$scratch/failure.txt" 2>&1; then
  echo 'Failed Windows helper must stop WSL setup.' >&2
  exit 1
fi
if grep -q 'WSL_CODE_READY' "$scratch/failure.txt"; then
  echo 'Failed Windows helper incorrectly reported readiness.' >&2
  exit 1
fi
echo 'WSL VS Code handoff checks passed.'
