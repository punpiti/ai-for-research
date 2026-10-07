#!/usr/bin/env bash
set -euo pipefail

mode="${1:---check}"
course_dir="${AI_RESEARCH_COURSE_DIR:-${AI_GRAD_COURSE_DIR:-$HOME/ai-for-research-workspace}}"
agent="${AI_GRAD_AGENT:-}"
dry_run="${AI_RESEARCH_DRY_RUN:-0}"
setup_version='2026.10.07.18'
test_commands=",${AI_RESEARCH_TEST_COMMANDS:-},"

trace_platform=linux
trace_root="$HOME/.local/share/ai-for-research"

trace_file=''
json_string() {
  local value="$1"
  value=${value//\\/\\\\}; value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}; value=${value//$'\r'/\\r}; value=${value//$'\t'/\\t}
  printf '"%s"' "$value"
}
trace() {
  [[ -n "$trace_file" ]] || return 0
  printf '{"schema":1,"at":"%s","phase":"%s","action":%s,"kind":%s,"target":%s,"status":%s,"details":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$trace_platform" "$(json_string "$1")" "$(json_string "$2")" "$(json_string "$3")" "$(json_string "$4")" "$(json_string "${5:-}")" >> "$trace_file"
}
trace_path() {
  [[ -n "$trace_file" ]] || return 0
  local path="$1" stage="$2" state=missing digest
  if [[ -L "$path" ]]; then state=symlink:preserve
  elif [[ -f "$path" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then digest="$(sha256sum "$path")"; else digest="$(shasum -a 256 "$path")"; fi
    state="file:${digest%% *}"
  elif [[ -d "$path" ]]; then state=directory; fi
  trace snapshot path "$path" "$stage" "$state"
}
quiet() {
  if [[ -z "$trace_file" ]]; then "$@"; return; fi
  local result
  trace command process "$1" started "${2:-}"
  if "$@" >> "${trace_file%.jsonl}.log" 2>&1; then
    trace command process "$1" completed
  else
    result=$?; trace command process "$1" failed "$result"
    printf '[AI for Research] INSTALL_FAILED %s (exit %s). Details: %s\n' "$1" "$result" "${trace_file%.jsonl}.log" >&2
    return "$result"
  fi
}
log() {
  trace message installer "$mode" observed "$*"
  if [[ "$dry_run" != 1 && "$*" == AI\ workspace=* ]]; then
    printf '[AI for Research] FINAL_RESULT PASS - Setup complete. Open the AI panel in your workspace and sign in or configure your provider.\n'
    return 0
  fi
  if [[ "$*" == *FAILED* || "$*" == *MISSING* || "$*" == INSTALL_STOPPED* || "$*" == FAIL* || "$*" == 'Install Antigravity'* ]]; then
    printf '[AI for Research] %s\n' "$*"
    return 0
  fi
  if [[ "$dry_run" == 1 || "$mode" == --check || "$*" =~ ^(SETUP_VERSION|DEVICE_CHECK|ADMIN_PHASE_REQUIRED|RUNTIME_READY|FINAL_RESULT|workspace=|AI\ workspace=|STEP) ]]; then
    printf '[AI for Research] %s\n' "$*"
  fi
}
watched_paths=()
if [[ "$dry_run" != 1 && "$mode" != --check ]]; then
  trace_dir="$trace_root/install-traces"
  (umask 077; mkdir -p "$trace_dir")
  trace_file="$(mktemp "$trace_dir/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
  mv "$trace_file" "$trace_file.jsonl"; trace_file="$trace_file.jsonl"
  export AI_RESEARCH_TRACE_FILE="$trace_file"
  (umask 077; : > "${trace_file%.jsonl}.log")
  trace phase installer "$mode" started "agent=$agent; version=$setup_version"
  trace snapshot workspace "$course_dir" before preserve-personal-files
  for name in content.md README.md AGENTS.md CLAUDE.md .ai/PROJECT_STATE.md .ai/TOKEN_BUDGET.md .ai/agent-project-kit/STARTUP.md .ai/agent-project-kit/TOKEN_DISCIPLINE.md templates/modern-thai.yaml templates/modern-thai.lua templates/modern-thai.tex templates/fonts/Sarabun-Regular.ttf templates/fonts/Sarabun-Bold.ttf templates/fonts/OFL.txt tools/import-documents.sh tools/import-documents.ps1 tools/import-office.py tools/install-summary.py .vscode/extensions.json; do
    watched_paths+=("$course_dir/$name")
  done
  for name in python envs/research TinyTeX node npm uv-tools bin tessdata envs/research/pyvenv.cfg TinyTeX/tlpkg/texlive.tlpdb; do watched_paths+=("$trace_root/$name"); done
  for path in "${watched_paths[@]}"; do trace_path "$path" before; done
  finish_trace() {
    local result=$? status=completed
    trap - EXIT
    ((result == 0)) || status=failed
    for path in "${watched_paths[@]}"; do trace_path "$path" after; done
    trace phase installer "$mode" "$status" "$result"
    if ((result != 0)); then printf '[AI for Research] Installation did not finish. Details: %s\n' "${trace_file%.jsonl}.log" >&2; fi
    return "$result"
  }
  trap finish_trace EXIT
fi
log "SETUP_VERSION $setup_version"
have() {
  if [[ "$test_commands" != ",," ]]; then [[ "$test_commands" == *",$1,"* ]]; else command -v "$1" >/dev/null 2>&1; fi
}
is_wsl() { [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qi microsoft /proc/version 2>/dev/null; }
setup_windows_vscode() {
  if [[ "$dry_run" == 1 ]]; then
    log 'DRY_RUN WSL: powershell.exe installs Windows VS Code + WSL extension; code runs the Linux workspace.'
    return
  fi
  have powershell.exe && have wslpath || { log 'WSL_INTEROP_MISSING Enable Windows interoperability in WSL, then rerun.'; exit 2; }
  wsl_setup="$(mktemp --suffix=.ps1)"
  wsl_output="$(mktemp)"
  curl -fsSL https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-vscode-wsl.ps1 -o "$wsl_setup"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$wsl_setup")" | tee "$wsl_output"
  windows_code="$(awk '/^VSCODE_CLI_PATH=/{sub(/^VSCODE_CLI_PATH=/, ""); sub(/\r$/, ""); print}' "$wsl_output")"
  rm -f "$wsl_setup" "$wsl_output"
  [[ -n "$windows_code" ]] || { log 'WSL_CODE_FAILED Windows helper did not return a VS Code path.'; exit 2; }
  code_launcher="$(wslpath -u "$windows_code")"
  code_launcher="${code_launcher%.cmd}"
  [[ -f "$code_launcher" ]] || { log "WSL_CODE_FAILED Missing WSL launcher: $code_launcher"; exit 2; }
  export PATH="$(dirname "$code_launcher"):$PATH"
  log "WSL_CODE_READY $code_launcher"
}
run_npm_install() { if [[ "$dry_run" == 1 ]]; then log "DRY_RUN npm install -g $1"; else trace install user-tool "$1" started; quiet npm install -g "$1"; trace install user-tool "$1" completed; fi; }
check() {
  ram_gb="$(( $(awk '/MemTotal/{print $2}' /proc/meminfo) / 1024 / 1024 ))"
  free_disk_gb="$(df -Pk "$HOME" | awk 'NR==2 {printf "%.1f", $4/1024/1024}')"
  if curl -fsSI --max-time 5 https://github.com/ >/dev/null 2>&1; then network=yes; else network=no; fi
  ai_commands=(codex claude agy-ide)
  [[ "$agent" == antigravity ]] && ai_commands=(agy-ide)
  [[ -n "$agent" && "$agent" != antigravity ]] && ai_commands=("$agent")
  [[ "$agent" == openrouter ]] && ai_commands=(code)
  available_ai=()
  missing_ai=()
  for cmd in "${ai_commands[@]}"; do
    if have "$cmd"; then available_ai+=("$cmd"); else missing_ai+=("$cmd"); fi
  done
  available_text="$(IFS=,; echo "${available_ai[*]:-none}")"
  missing_text="$(IFS=,; echo "${missing_ai[*]:-none}")"
  log "AI_FRONTENDS available=$available_text missing=$missing_text"
  arch_ready=no; [[ "$(uname -m)" == x86_64 || "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]] && arch_ready=yes
  ram_ready=no; (( ram_gb >= 8 )) && ram_ready=yes
  disk_ready=no; awk -v disk="$free_disk_gb" 'BEGIN {exit !(disk >= 20)}' && disk_ready=yes
  issues=()
  [[ "$arch_ready" == yes ]] || issues+=("supported 64-bit architecture")
  [[ "$ram_ready" == yes ]] || issues+=("RAM 8 GB (found $ram_gb GB)")
  [[ "$disk_ready" == yes ]] || issues+=("free disk 20 GB (found $free_disk_gb GB)")
  [[ "$network" == yes ]] || issues+=("HTTPS network access to github.com")
  if (( ${#issues[@]} == 0 )); then
    if [[ "$mode" == --check ]]; then log 'FINAL_RESULT PASS - Device is ready.'; else log 'DEVICE_CHECK_PASS Hardware and network checks passed.'; fi
    return 0
  fi
  issue_text="$(IFS=';'; echo "${issues[*]}")"
  log "FINAL_RESULT FAIL - Missing: ${issue_text//;/; }"
  return 1
}
make_workspace() {
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN workspace=$course_dir"; return; fi
  mkdir -p "$course_dir/input/original" "$course_dir/input/markdown" "$course_dir/output" "$course_dir/tools" "$course_dir/.ai/agent-project-kit"
  mkdir -p "$course_dir/templates/fonts"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/Sarabun-Regular.ttf' -o "$course_dir/templates/fonts/Sarabun-Regular.ttf"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/Sarabun-Bold.ttf' -o "$course_dir/templates/fonts/Sarabun-Bold.ttf"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/OFL.txt' -o "$course_dir/templates/fonts/OFL.txt"
  [[ -s "$course_dir/templates/fonts/Sarabun-Regular.ttf" && -s "$course_dir/templates/fonts/Sarabun-Bold.ttf" && -s "$course_dir/templates/fonts/OFL.txt" ]] || { log 'FONT_SETUP_FAILED Sarabun files are missing or empty.'; exit 2; }
  log 'FONT_READY Sarabun Regular/Bold bundled in workspace.'
  if [[ ! -e "$course_dir/content.md" ]]; then
    printf '# My AI Research Workspace\n\nDescribe the research task here.\n' > "$course_dir/content.md"
  fi
  if [[ ! -e "$course_dir/README.md" ]]; then
    printf '# AI for Research\n\nKeep permitted inputs in `input/` and generated work in `output/`.\n' > "$course_dir/README.md"
  fi
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.yaml' -o "$course_dir/templates/modern-thai.yaml"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.lua' -o "$course_dir/templates/modern-thai.lua"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.tex' -o "$course_dir/templates/modern-thai.tex"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-AGENTS.md' -o "$course_dir/AGENTS.md"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-STARTUP.md' -o "$course_dir/.ai/agent-project-kit/STARTUP.md"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-TOKEN-DISCIPLINE.md' -o "$course_dir/.ai/agent-project-kit/TOKEN_DISCIPLINE.md"
  [[ -e "$course_dir/.ai/PROJECT_STATE.md" ]] || quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-PROJECT-STATE.md' -o "$course_dir/.ai/PROJECT_STATE.md"
  [[ -e "$course_dir/.ai/TOKEN_BUDGET.md" ]] || quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-TOKEN-BUDGET.md' -o "$course_dir/.ai/TOKEN_BUDGET.md"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-documents.sh' -o "$course_dir/tools/import-documents.sh"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-documents.ps1' -o "$course_dir/tools/import-documents.ps1"
  quiet curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-office.py' -o "$course_dir/tools/import-office.py"
  quiet curl -fL https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-summary.py -o "$course_dir/tools/install-summary.py"
  chmod +x "$course_dir/tools/import-documents.sh"
  log "workspace=$course_dir"
}
configure_vscode() {
  have code || { log 'PREREQUISITE_MISSING VS Code CLI not found. Finish the VS Code/WSL setup, then rerun --setup-user.'; exit 2; }
  profile="AI for Research - $agent"
  extensions=(mathematic.vscode-pdf mechatroner.rainbow-csv AykutSarac.jsoncrack-vscode)
  case "$agent" in codex) extensions=(openai.chatgpt "${extensions[@]}") ;; claude) extensions=(anthropic.claude-code "${extensions[@]}") ;; openrouter) extensions=(saoudrizwan.claude-dev "${extensions[@]}") ;; esac
  log 'STEP Preparing your AI workspace and extensions.'
  log "CREATE VS_CODE_PROFILE profile=$profile workspace=$course_dir"
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN code --profile $profile $course_dir"; else quiet code --profile "$profile" "$course_dir"; fi
  existing_extensions=''
  extensions_known=no
  if [[ "$dry_run" != 1 ]]; then
    trace snapshot vscode-profile "$profile" before ownership-unknown-preserve
    if existing_extensions="$(code --profile "$profile" --list-extensions 2>> "${trace_file%.jsonl}.log")"; then extensions_known=yes; fi
  fi
  for extension in "${extensions[@]}"; do
    before=unknown-preserve
    if [[ "$extensions_known" == yes ]]; then
      before=missing
      if printf '%s\n' "$existing_extensions" | awk -v target="$extension" 'tolower($0) == tolower(target) {found=1} END {exit !found}'; then before=present; fi
    fi
    trace snapshot vscode-extension "$extension" before "$before; profile=$profile"
    if [[ "$dry_run" != 1 && "$before" == present ]]; then
      trace snapshot vscode-extension "$extension" after "present; profile=$profile; reused"
      continue
    fi
    log "INSTALL VS_CODE_EXTENSION $extension profile=$profile"
    if [[ "$dry_run" == 1 ]]; then log "DRY_RUN code --profile $profile --install-extension $extension"; else quiet code --profile "$profile" --install-extension "$extension"; fi
    trace snapshot vscode-extension "$extension" after "present; profile=$profile"
  done
  [[ "$dry_run" == 1 ]] && return
  mkdir -p "$course_dir/.vscode"
  recommendations="$(printf '"%s",' "${extensions[@]}")"
  printf '{\n  "recommendations": [%s]\n}\n' "${recommendations%,}" > "$course_dir/.vscode/extensions.json"
}
configure_antigravity() {
  extension=mathematic.vscode-pdf
  log "INSTALL ANTIGRAVITY_EXTENSION $extension"
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN agy-ide --install-extension $extension"; else quiet agy-ide --install-extension "$extension"; fi
  if [[ "$dry_run" != 1 ]]; then
    mkdir -p "$course_dir/.vscode"
    printf '{\n  "recommendations": ["%s"]\n}\n' "$extension" > "$course_dir/.vscode/extensions.json"
  fi
}
install_system_tools() {
  [[ "$(uname -s)" == Linux ]] || { log 'This installer requires Linux.'; exit 2; }
  [[ "$agent" =~ ^(codex|claude|openrouter|antigravity)$ ]] || { log 'Set AI_GRAD_AGENT to codex, claude, openrouter, or antigravity.'; exit 2; }
  if ! check; then log 'INSTALL_STOPPED System requirements did not pass. Nothing was installed.'; exit 2; fi
  have apt-get || { log 'Only Ubuntu/Debian apt systems are currently supported.'; exit 2; }
  packages=()
  for package in perl xz-utils fontconfig libfontconfig1 libfreetype6 libx11-6; do
    dpkg -s "$package" >/dev/null 2>&1 || packages+=("$package")
  done
  have git || packages+=(git)
  have curl || packages+=(curl)
  have pandoc || packages+=(pandoc)
  have tesseract || packages+=(tesseract-ocr)
  if ! have pdftotext || ! have pdftoppm || ! have pdfinfo; then packages+=(poppler-utils); fi
  dpkg -s tesseract-ocr-tha >/dev/null 2>&1 || packages+=(tesseract-ocr-tha)
  for cmd in git curl node npm pandoc xelatex tesseract pdftotext pdftoppm pdfinfo; do
    if have "$cmd"; then log "REUSE $cmd"; fi
  done
  if ((${#packages[@]})); then log "INSTALL apt=${packages[*]}"; else log 'All apt system software is already available.'; fi
  if [[ "$agent" != antigravity ]]; then
    if have code; then log 'REUSE code'; else log 'INSTALL code if a supported snap/WSL path is available.'; fi
  fi
  if [[ "$mode" != --install ]]; then
    read -r -p 'Continue? [y/N] ' answer
    [[ "$answer" =~ ^[Yy]$ ]] || exit 0
  fi
  code_deb=''
  if [[ "$agent" != antigravity ]] && ! is_wsl && ! have code; then
    case "$(dpkg --print-architecture)" in
      amd64) vscode_arch=x64 ;;
      arm64) vscode_arch=arm64 ;;
      *) log 'VS Code package supports amd64/arm64 only.'; exit 2 ;;
    esac
    code_deb="$(mktemp --suffix=.deb)"
    quiet curl -fL "https://update.code.visualstudio.com/latest/linux-deb-$vscode_arch/stable" -o "$code_deb"
    chmod 644 "$code_deb"
    packages+=("$code_deb")
  fi
  if ((${#packages[@]})); then
    log 'ADMIN_PHASE_REQUIRED One sudo phase installs all missing system packages.'
    for package in "${packages[@]}"; do trace install system-package "$package" started shared-system-software-preserve; done
    quiet sudo bash -c 'set -e; apt-get update; DEBIAN_FRONTEND=noninteractive apt-get -o Dpkg::Options::=--force-confold install -y "$@"' ai-research-system "${packages[@]}"
    for package in "${packages[@]}"; do trace install system-package "$package" completed shared-system-software-preserve; done
    [[ -z "$code_deb" ]] || rm -f "$code_deb"
  else
    log 'REUSE_SYSTEM_TOOLS No sudo phase needed.'
  fi
  if [[ "$agent" != antigravity ]] && is_wsl; then setup_windows_vscode; fi
  if [[ "$agent" == antigravity ]] && ! have agy-ide; then
    log 'INSTALL Antigravity IDE from the official Google download page; complete its installer before --setup-user.'
    if have xdg-open; then xdg-open 'https://antigravity.google/download#antigravity-ide'; fi
  fi
  log 'System tools ready. Legacy two-phase setup: open Terminal/Ubuntu normally, then run --setup-user.'
}
setup_user() {
  if [[ -z "$agent" ]]; then read -r -p 'Choose AI frontend [claude/codex/openrouter]: ' agent; fi
  [[ "$agent" =~ ^(codex|claude|openrouter|antigravity)$ ]] || { log 'AI frontend must be codex, claude, openrouter, or antigravity.'; exit 2; }
  log 'STEP Preparing your workspace files.'
  make_workspace
  if [[ "$dry_run" == 1 ]]; then
    is_wsl && log 'DRY_RUN WSL extensions install in the remote Linux workspace'
    log 'DRY_RUN runtime Python 3.12 + user-owned TinyTeX + scoped Codex permissions'
  else
    export PATH="$HOME/.local/bin:$PATH"
    export UV_PYTHON_INSTALL_DIR="$HOME/.local/share/ai-for-research/python"
    export UV_CACHE_DIR="$HOME/.local/share/ai-for-research/cache/uv"
    if have uv; then trace snapshot system-tool uv before present; fi
    if ! have uv; then
      uv_script="$(mktemp)"
      curl -fsSL https://astral.sh/uv/install.sh -o "$uv_script"
      trace install user-tool uv started shared-user-tool-preserve
    quiet sh "$uv_script"
    trace install user-tool uv completed shared-user-tool-preserve
      rm -f "$uv_script"
    fi
    runtime_script="$(mktemp)"
    curl -fsSL https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-runtime.py -o "$runtime_script"
    log 'STEP Preparing Python and PDF tools. The first run may take several minutes.'
    quiet uv python install 3.12
    quiet uv run --no-project --python 3.12 python "$runtime_script" --workspace "$course_dir" --agent "$agent"
    rm -f "$runtime_script"
    source "$course_dir/tools/runtime-env.sh"
    log "RUNTIME_READY Python environment and Thai PDF test passed."
  fi
  [[ "$agent" == antigravity ]] || have npm || { log 'PREREQUISITE_MISSING npm is not on PATH. Close Terminal, open a new Terminal, then rerun --setup-user.'; exit 2; }
  case "$agent" in
    openrouter) log 'OPENROUTER_READY Cline extension; configure provider OpenRouter and your own key in the IDE.' ;;
    codex) if have codex; then log 'REUSE codex'; else log 'INSTALL codex'; run_npm_install @openai/codex; fi ;;
    claude) if have claude; then log 'REUSE claude'; else log 'INSTALL claude'; run_npm_install @anthropic-ai/claude-code; fi ;;
    antigravity) have agy-ide || { log 'Install Antigravity IDE and enable the agy-ide command during onboarding, then rerun --setup-user.'; exit 2; } ;;
    *) log 'AI frontend must be codex, claude, openrouter, or antigravity.'; exit 2 ;;
  esac
  if [[ "$agent" == antigravity ]]; then configure_antigravity; else configure_vscode; fi
  if [[ "$dry_run" != 1 ]]; then "$VIRTUAL_ENV/bin/python" "$course_dir/tools/install-summary.py" --trace "$trace_file"; fi
  log "AI workspace=$agent installed. Next: open the workspace, open its AI panel, and sign in with your own account. The terminal command is only a fallback."
}

case "$mode" in
  --install)
    [[ "$EUID" != 0 ]] || { log 'Run --install as your normal user; sudo is requested only for system tools.'; exit 2; }
    [[ -n "$agent" ]] || read -r -p 'Choose AI frontend [claude/codex/openrouter]: ' agent
    install_system_tools
    export PATH="$HOME/.local/bin:/Applications/Visual Studio Code.app/Contents/Resources/app/bin:$PATH"
    setup_user
    ;;
  --check) check ;;
  --install-system) install_system_tools ;;
  --setup-user) setup_user; [[ "$dry_run" == 1 ]] || check ;;
  --repair) install_system_tools; setup_user; [[ "$dry_run" == 1 ]] || check ;;
  *) echo "Usage: $0 [--install|--check|--install-system|--setup-user|--repair]" >&2; exit 2 ;;
esac
