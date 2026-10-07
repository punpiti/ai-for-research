#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
page="$root/prepare.html"
grep -q 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/setup-windows.ps1' "$page"
if grep -Rqs 'punpiti.github.io/ai-for-research' "$root/prepare.html" "$root/downloads"; then
  echo 'Legacy GitHub Pages download host remains in learner setup files.' >&2
  exit 1
fi

for agent in codex claude openrouter; do
  grep -q "name=\"agent\" value=\"$agent\"" "$page"
done
grep -q -- '-Agent {agent}' "$page"

for platform in windows macos linux; do
  grep -q "data-platform-button=\"$platform\"" "$page"
  grep -q "data-platform-panel=\"$platform\"" "$page"
done

grep -q 'SETUP_VERSION 2026.10.07.2' "$page"
grep -q 'FONT_READY' "$page"
grep -q 'CREATE VS_CODE_PROFILE' "$page"
grep -q 'Script จะเปิด Workspace ใน <span data-workspace-app>VS Code</span> ให้อัตโนมัติ' "$page"
grep -q 'ตรวจว่า Workspace เปิดแล้ว' "$page"
grep -q '<details class="fallback-details">' "$page"
grep -q 'Workspace ไม่เปิดอัตโนมัติ? ดูวิธีเปิดใหม่' "$page"
grep -q '<code>~/ai-for-research-workspace</code>' "$page"
if grep -q 'open -a &quot;Visual Studio Code&quot; --args' "$page"; then
  echo 'macOS learner flow must show the workspace folder path, not reopen VS Code with open -a.' >&2
  exit 1
fi
grep -q 'โหลด Script ในข้อ 1 ใหม่ก่อนเสมอ' "$page"
grep -q 'RUNTIME_READY' "$page"
grep -q 'profile/learner-profile.yaml' "$page"
grep -q 'profile/learner-profile.md' "$page"
grep -q 'profile/learning-context.md' "$page"
grep -q 'profile/author-profile.bib' "$page"
grep -q 'อนุมัติและบันทึก' "$page"
grep -q 'เริ่ม session ใหม่' "$page"
grep -q 'mainfont: Sarabun' "$root/downloads/modern-thai.yaml"
grep -q 'Path=templates/fonts/' "$root/downloads/modern-thai.yaml"
grep -q 'classList.add("terminal-command")' "$root/assets/app.js"
grep -q 'terminal-command.*background:#101c31' "$root/assets/styles.css"

if grep -qiE 'antigravity|agy-ide' "$page"; then
  echo 'Antigravity must remain hidden from the preparation page.' >&2
  exit 1
fi
echo 'Prepare page learner-flow checks passed.'
