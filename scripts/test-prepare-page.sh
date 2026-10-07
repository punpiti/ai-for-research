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

for installer in setup-windows.ps1 setup-linux.sh setup-macos.sh; do
  version="$(sed -n "s/.*[Ss]etup[Vv]ersion *= *'\([^']*\)'.*/\1/p; s/^setup_version='\([^']*\)'.*/\1/p" "$root/downloads/$installer")"
  [[ -n "$version" ]]
  grep -Fq "SETUP_VERSION $version" "$page"
done
grep -q 'Script จะเปิด Workspace ใน <span data-workspace-app>VS Code</span> ให้อัตโนมัติ' "$page"
grep -q 'ตรวจว่า Workspace เปิดแล้ว' "$page"
grep -q '<details class="fallback-details">' "$page"
grep -q 'Workspace ไม่เปิดอัตโนมัติ? ดูวิธีเปิดใหม่' "$page"
grep -q '<code>~/ai-for-research-workspace</code>' "$page"
if grep -q 'open -a &quot;Visual Studio Code&quot; --args' "$page"; then
  echo 'macOS learner flow must show the workspace folder path, not reopen VS Code with open -a.' >&2
  exit 1
fi
grep -q 'คัดลอกคำสั่งติดตั้งด้านล่างใหม่แล้วรันได้เลย' "$page"
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
python3 - "$page" <<'PYTEST'
import re, sys
from pathlib import Path
page = Path(sys.argv[1]).read_text()
assert re.findall(r'name="agent" value="([^"]+)"', page) == ['claude', 'codex', 'openrouter']
assert 'คอร์ส Introduction ไม่ต้องติดตั้ง WSL2' in page
assert 'เพิ่มเติม: สำหรับผู้ที่มี WSL2 อยู่แล้ว' in page
assert not re.search(r'data-platform-button="linux">[^<]*WSL', page)
from html import unescape
install = page[page.index('ติดตั้งครั้งแรกด้วยคำสั่งเดียว'):page.index('มีอยู่แล้วให้ใช้ต่อ')]
commands = [unescape(x) for x in re.findall(r'data-template="([^"]+)"', install)]
assert len(commands) == 3, 'One combined download/run command per OS required'
assert 'Invoke-WebRequest' in commands[0] and '-Mode Install -Agent {agent}' in commands[0]
for command in commands[1:]:
    assert 'curl -fsSL' in command and '&& AI_GRAD_AGENT={agent} bash' in command and '--install' in command
assert 'Run as administrator' not in install
assert 'Downloads' not in '\n'.join(commands)
PYTEST
echo 'Prepare page learner-flow checks passed.'
