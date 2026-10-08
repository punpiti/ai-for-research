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

grep -q 'คำสั่งเดียวจบ' "$page"
grep -q 'เชื่อม AI แล้วทดลองสร้าง PDF' "$page"
grep -q '<details class="fallback-details">' "$page"
grep -q 'Workspace ไม่เปิดอัตโนมัติ? ดูวิธีเปิดใหม่' "$page"
grep -q '<code data-project-path>~/ai-for-research-workspace</code>' "$page"
grep -q 'data-project-name-input' "$page"
grep -q 'data-project-name-status' "$page"
grep -q 'ai-research-project-name' "$root/assets/app.js"
grep -q 'renderWorkspaceState(projectName)' "$root/assets/app.js"
grep -q 'id="project-basics"' "$page"
grep -q '<th>ใช้ทำอะไร</th><th>ซอฟต์แวร์</th><th>รุ่น</th>' "$page"
grep -q 'Python 3.12; Node.js 22+' "$page"
for kind in is-read is-input is-terminal ai-prompt; do
  grep -q "$kind" "$page"
done
grep -q '>คัดลอกคำสั่งติดตั้ง</button>' "$page"
grep -q '>คัดลอก Prompt</button>' "$page"
grep -q '<code>input/</code><span>เก็บไฟล์ต้นฉบับ</span>' "$page"
grep -q '<code>output/</code><span>เก็บงานที่ AI สร้างใหม่</span>' "$page"
if grep -q 'open -a &quot;Visual Studio Code&quot; --args' "$page"; then
  echo 'macOS learner flow must show the workspace folder path, not reopen VS Code with open -a.' >&2
  exit 1
fi
grep -q 'ข้อมูลเกี่ยวกับงานวิจัยของคุณ' "$page"
grep -q 'data-module-1-submission-form' "$page"
grep -q 'data-module-1-check="workspace_opened"' "$page"
grep -q 'ส่งสถานะ Module 1' "$page"
grep -q 'ไม่ส่ง API key ไฟล์ หรือข้อมูลวิจัย' "$page"
grep -q '/api/ai-for-research/module-1/submissions' "$root/assets/module-1-submission.js"
node --check "$root/assets/module-1-submission.js"
node "$root/scripts/test-module-1-submission.js"
if grep -qE 'SETUP_VERSION|RUNTIME_READY|installation trace|runtime-env|config\.toml|PROJECT_STATE\.md|AGENTS\.md|token budget|Auto Approve' "$page"; then
  echo 'Internal workflow or diagnostic copy must not appear on the learner page.' >&2
  exit 1
fi
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
assert not re.search(r'data-platform-button="linux">[^<]*WSL', page)
from html import unescape
install = page[page.index('<section class="section platform-section" id="install"'):page.index('<div class="notice"><strong>ติดตั้งสำเร็จเมื่อ:')]
commands = [unescape(x) for x in re.findall(r'data-template="([^"]+)"', install)]
assert len(commands) == 3, 'One combined download/run command per OS required'
assert 'Invoke-WebRequest' in commands[0] and '-Mode Install -Agent {agent}' in commands[0]
assert 'AI_RESEARCH_PROJECT_NAME={projectPs}' in commands[0]
for command in commands[1:]:
    assert 'curl -fsSL' in command and 'AI_RESEARCH_PROJECT_NAME={projectSh}' in command
    assert 'AI_GRAD_AGENT={agent} bash' in command and '--install' in command
assert 'Run as administrator' not in install
assert 'Downloads' not in '\n'.join(commands)
PYTEST
echo 'Prepare page learner-flow checks passed.'
