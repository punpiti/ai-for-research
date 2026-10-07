#!/usr/bin/env bash
set -euo pipefail

mode="${1:---check}"
course_dir="${AI_RESEARCH_COURSE_DIR:-${AI_GRAD_COURSE_DIR:-$HOME/ai-for-research-workspace}}"
agent="${AI_GRAD_AGENT:-}"
dry_run="${AI_RESEARCH_DRY_RUN:-0}"
setup_version='2026.10.07.1'
test_commands=",${AI_RESEARCH_TEST_COMMANDS:-},"
log() { printf '[ai-grad] %s\n' "$*"; }
log "SETUP_VERSION $setup_version"
have() {
  if [[ "$test_commands" != ",," ]]; then [[ "$test_commands" == *",$1,"* ]]; else command -v "$1" >/dev/null 2>&1; fi
}
run_npm_install() { if [[ "$dry_run" == 1 ]]; then log "DRY_RUN npm install -g $1"; else npm install -g "$1"; fi; }
check() {
  [[ "$(uname -s)" == Darwin ]] || { log 'FAIL This script requires macOS.'; return 2; }
  ram_gb="$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))"
  free_disk_gb="$(df -Pk "$HOME" | awk 'NR==2 {printf "%.1f", $4/1024/1024}')"
  if curl -fsSI --max-time 5 https://github.com/ >/dev/null 2>&1; then network=yes; else network=no; fi
  ai_commands=(codex claude agy-ide)
  [[ "$agent" == antigravity ]] && ai_commands=(agy-ide)
  [[ -n "$agent" && "$agent" != antigravity ]] && ai_commands=("$agent")
  available_ai=()
  missing_ai=()
  for cmd in "${ai_commands[@]}"; do
    if have "$cmd"; then available_ai+=("$cmd"); else missing_ai+=("$cmd"); fi
  done
  available_text="$(IFS=,; echo "${available_ai[*]:-none}")"
  missing_text="$(IFS=,; echo "${missing_ai[*]:-none}")"
  log "AI_FRONTENDS available=$available_text missing=$missing_text"
  arch_ready=no; [[ "$(uname -m)" == arm64 || "$(uname -m)" == x86_64 ]] && arch_ready=yes
  ram_ready=no; (( ram_gb >= 8 )) && ram_ready=yes
  disk_ready=no; awk -v disk="$free_disk_gb" 'BEGIN {exit !(disk >= 20)}' && disk_ready=yes
  issues=()
  [[ "$arch_ready" == yes ]] || issues+=("supported 64-bit Apple silicon or Intel architecture")
  [[ "$ram_ready" == yes ]] || issues+=("RAM 8 GB (found $ram_gb GB)")
  [[ "$disk_ready" == yes ]] || issues+=("free disk 20 GB (found $free_disk_gb GB)")
  [[ "$network" == yes ]] || issues+=("HTTPS network access to github.com")
  if (( ${#issues[@]} == 0 )); then log 'FINAL_RESULT PASS - Device is ready.'; return 0; fi
  issue_text="$(IFS=';'; echo "${issues[*]}")"
  log "FINAL_RESULT FAIL - Missing: ${issue_text//;/; }"
  return 1
}
make_workspace() {
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN workspace=$course_dir"; return; fi
  mkdir -p "$course_dir/input/original" "$course_dir/input/markdown" "$course_dir/output" "$course_dir/tools"
  mkdir -p "$course_dir/templates/fonts"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/Sarabun-Regular.ttf' -o "$course_dir/templates/fonts/Sarabun-Regular.ttf"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/Sarabun-Bold.ttf' -o "$course_dir/templates/fonts/Sarabun-Bold.ttf"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/fonts/OFL.txt' -o "$course_dir/templates/fonts/OFL.txt"
  [[ -s "$course_dir/templates/fonts/Sarabun-Regular.ttf" && -s "$course_dir/templates/fonts/Sarabun-Bold.ttf" && -s "$course_dir/templates/fonts/OFL.txt" ]] || { log 'FONT_SETUP_FAILED Sarabun files are missing or empty.'; exit 2; }
  log 'FONT_READY Sarabun Regular/Bold bundled in workspace.'
  [[ -e "$course_dir/content.md" ]] || printf '# My AI Research Workspace\n\nDescribe the research task here.\n' > "$course_dir/content.md"
  [[ -e "$course_dir/README.md" ]] || printf '# AI for Research\n\nKeep permitted inputs in `input/` and generated work in `output/`.\n' > "$course_dir/README.md"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.yaml' -o "$course_dir/templates/modern-thai.yaml"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.lua' -o "$course_dir/templates/modern-thai.lua"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/modern-thai.tex' -o "$course_dir/templates/modern-thai.tex"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/starter-AGENTS.md' -o "$course_dir/AGENTS.md"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-documents.sh' -o "$course_dir/tools/import-documents.sh"
  curl -fL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/import-documents.ps1' -o "$course_dir/tools/import-documents.ps1"
  chmod +x "$course_dir/tools/import-documents.sh"
  log "workspace=$course_dir"
}
configure_vscode() {
  if [[ "$dry_run" == 1 ]]; then
    have code || { log 'PREREQUISITE_MISSING VS Code CLI not found. Open VS Code or reopen Terminal, then rerun --setup-user.'; exit 2; }
    vscode_cli=code
  else
    vscode_cli="$(command -v code || true)"
    [[ -n "$vscode_cli" ]] || vscode_cli='/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    [[ -x "$vscode_cli" ]] || { log 'PREREQUISITE_MISSING VS Code CLI not found. Open VS Code or reopen Terminal, then rerun --setup-user.'; exit 2; }
  fi
  profile="AI for Research - $agent"
  extensions=(mathematic.vscode-pdf)
  case "$agent" in codex) extensions=(openai.chatgpt "${extensions[@]}") ;; claude) extensions=(anthropic.claude-code "${extensions[@]}") ;; esac
  log "CREATE VS_CODE_PROFILE profile=$profile workspace=$course_dir"
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN code --profile $profile $course_dir"; else "$vscode_cli" --profile "$profile" "$course_dir"; fi
  for extension in "${extensions[@]}"; do
    log "INSTALL VS_CODE_EXTENSION $extension profile=$profile"
    if [[ "$dry_run" == 1 ]]; then log "DRY_RUN code --profile $profile --install-extension $extension"; else "$vscode_cli" --profile "$profile" --install-extension "$extension"; fi
  done
  [[ "$dry_run" == 1 ]] && return
  mkdir -p "$course_dir/.vscode"
  printf '{\n  "recommendations": ["%s", "%s"]\n}\n' "${extensions[0]}" "${extensions[1]:-${extensions[0]}}" > "$course_dir/.vscode/extensions.json"
}
configure_antigravity() {
  extension=mathematic.vscode-pdf
  log "INSTALL ANTIGRAVITY_EXTENSION $extension"
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN agy-ide --install-extension $extension"; else agy-ide --install-extension "$extension"; fi
  if [[ "$dry_run" != 1 ]]; then
    mkdir -p "$course_dir/.vscode"
    printf '{\n  "recommendations": ["%s"]\n}\n' "$extension" > "$course_dir/.vscode/extensions.json"
  fi
  log "OPEN ANTIGRAVITY_WORKSPACE workspace=$course_dir"
  if [[ "$dry_run" == 1 ]]; then log "DRY_RUN agy-ide $course_dir"; else agy-ide "$course_dir"; fi
}
install_system_tools() {
  [[ "$(uname -s)" == Darwin ]] || { log 'This installer requires macOS.'; exit 2; }
  [[ "$agent" =~ ^(codex|claude|antigravity)$ ]] || { log 'Set AI_GRAD_AGENT to codex, claude, or antigravity.'; exit 2; }
  if ! check; then log 'INSTALL_STOPPED System requirements did not pass. Nothing was installed.'; exit 2; fi
  formulae=()
  casks=()
  for cmd in git node pandoc; do
    if have "$cmd"; then log "REUSE $cmd"; else formulae+=("$cmd"); fi
  done
  if have tesseract; then log 'REUSE tesseract'; else formulae+=(tesseract); fi
  if have pdftotext; then log 'REUSE pdftotext'; else formulae+=(poppler); fi
  if have tesseract && tesseract --list-langs 2>/dev/null | grep -qx tha; then log 'REUSE tesseract-lang tha'; else formulae+=(tesseract-lang); fi
  if [[ "$agent" != antigravity ]]; then
    if have code || [[ -d '/Applications/Visual Studio Code.app' ]]; then log 'REUSE code'; else casks+=(visual-studio-code); fi
  fi
  if (( ${#formulae[@]} == 0 && ${#casks[@]} == 0 )); then log 'All system software is already available. Nothing to install.'; return 0; fi
  if ! have brew; then
    log 'INSTALL Homebrew; its official installer may ask for your password.'
    brew_script="$(mktemp)"
    curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$brew_script"
    /bin/bash "$brew_script"
    rm -f "$brew_script"
    if [[ -x /opt/homebrew/bin/brew ]]; then eval "$(/opt/homebrew/bin/brew shellenv)"; else eval "$(/usr/local/bin/brew shellenv)"; fi
  fi
  log 'This uses Homebrew to install only missing system software. It does not install Rosetta.'
  ((${#formulae[@]})) && log "INSTALL formulae=${formulae[*]}"
  ((${#casks[@]})) && log "INSTALL casks=${casks[*]}"
  if [[ "$mode" != --install ]]; then
    read -r -p 'Continue? [y/N] ' answer
    [[ "$answer" =~ ^[Yy]$ ]] || exit 0
  fi
  ((${#formulae[@]})) && brew install "${formulae[@]}"
  ((${#casks[@]})) && brew install --cask "${casks[@]}"
  if [[ "$agent" == antigravity ]] && ! have agy-ide; then
    log 'INSTALL Antigravity IDE from the official Google download page; complete its installer before --setup-user.'
    open 'https://antigravity.google/download#antigravity-ide'
  fi
  log 'System tools ready. Legacy two-phase setup: open Terminal normally, then run --setup-user.'
}
setup_user() {
  if [[ -z "$agent" ]]; then read -r -p 'Choose AI frontend [codex/claude/antigravity]: ' agent; fi
  [[ "$agent" =~ ^(codex|claude|antigravity)$ ]] || { log 'AI frontend must be codex, claude, or antigravity.'; exit 2; }
  make_workspace
  [[ "$agent" == antigravity ]] || have npm || { log 'PREREQUISITE_MISSING npm is not on PATH. Close Terminal, open a new Terminal, then rerun --setup-user.'; exit 2; }
  if [[ "$dry_run" == 1 ]]; then
    log 'DRY_RUN runtime Python 3.12 + user-owned TinyTeX + scoped Codex permissions'
  else
    export PATH="$HOME/.local/bin:$PATH"
    export UV_PYTHON_INSTALL_DIR="$HOME/Library/Application Support/ai-for-research/python"
    export UV_CACHE_DIR="$HOME/Library/Application Support/ai-for-research/cache/uv"
    if ! have uv; then
      uv_script="$(mktemp)"
      curl -fsSL https://astral.sh/uv/install.sh -o "$uv_script"
      sh "$uv_script"
      rm -f "$uv_script"
    fi
    runtime_script="$(mktemp)"
    curl -fsSL https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-runtime.py -o "$runtime_script"
    uv python install 3.12
    uv run --no-project --python 3.12 python "$runtime_script" --workspace "$course_dir" --agent "$agent"
    rm -f "$runtime_script"
    source "$course_dir/tools/runtime-env.sh"
  fi
  case "$agent" in
    codex) if have codex; then log 'REUSE codex'; else log 'INSTALL codex'; run_npm_install @openai/codex; fi ;;
    claude) if have claude; then log 'REUSE claude'; else log 'INSTALL claude'; run_npm_install @anthropic-ai/claude-code; fi ;;
    antigravity) have agy-ide || { log 'Install Antigravity IDE and enable the agy-ide command during onboarding, then rerun --setup-user.'; exit 2; } ;;
    *) log 'AI frontend must be codex, claude, or antigravity.'; exit 2 ;;
  esac
  if [[ "$agent" == antigravity ]]; then configure_antigravity; else configure_vscode; fi
  log "AI workspace=$agent installed. Next: open the workspace, open its AI panel, and sign in with your own account. The terminal command is only a fallback."
}
case "$mode" in
  --install)
    [[ "$EUID" != 0 ]] || { log 'Run --install as your normal user; sudo is requested only for system tools.'; exit 2; }
    [[ -n "$agent" ]] || read -r -p 'Choose AI frontend [codex/claude/antigravity]: ' agent
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
