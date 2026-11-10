#!/usr/bin/env bash
set -euo pipefail

workspace="$HOME/ai-for-research-workspace"
while (($#)); do
  case "$1" in
    --workspace) workspace="${2:?Missing value after --workspace}"; shift 2 ;;
    *) printf '[AI for Research · Module 7] Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
done
cd "$HOME"
uv_installer=""
setup_script=""

if ! command -v uv >/dev/null 2>&1; then
  printf '[AI for Research · Module 7] Installing uv under the current user account.\n'
  uv_installer="$(mktemp)"
  trap 'rm -f "${uv_installer:-}" "${setup_script:-}"' EXIT
  curl -fsSL 'https://astral.sh/uv/install.sh' -o "$uv_installer"
  sh "$uv_installer"
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi
command -v uv >/dev/null 2>&1 || { printf '[AI for Research · Module 7] FINAL_RESULT FAIL — uv was not found.\n' >&2; exit 1; }

setup_script="$(mktemp)"
trap 'rm -f "${uv_installer:-}" "${setup_script:-}"' EXIT
curl -fsSL 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-module-07.py' -o "$setup_script"
AI_MODULE07_UV="$(command -v uv)" uv run --no-project --python 3.12 python "$setup_script" --workspace "$workspace"
