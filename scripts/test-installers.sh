#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 -B "$root/scripts/test-runtime.py"
bash "$root/scripts/test-wsl-vscode.sh"
bash -n "$root/downloads/setup-linux.sh"
bash -n "$root/downloads/setup-macos.sh"
bash -n "$root/downloads/setup-module-07-linux.sh"
bash -n "$root/downloads/setup-module-07-macos.sh"
python3 -c 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding="utf-8"), str(p), "exec")' "$root/downloads/setup-module-07.py"
python3 -c 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding="utf-8"), str(p), "exec")' "$root/downloads/setup-module-08.py"
python3 -B "$root/scripts/test-module-8-installer.py"
bash -n "$root/downloads/setup-module-08-linux.sh"
bash -n "$root/downloads/setup-module-08-macos.sh"
python3 -B "$root/scripts/test-module-7-cli.py"
grep -q 'FINAL_RESULT PASS' "$root/downloads/setup-module-07.py"
grep -q 'module-7-steps.js' "$root/module-7.html"
grep -q 'setup-module-07-windows.ps1' "$root/module-7.html"
grep -q 'setup-module-07-macos.sh' "$root/module-7.html"
grep -q 'setup-module-07-linux.sh' "$root/module-7.html"
grep -q 'prepare_work_area(workspace)' "$root/downloads/setup-module-07.py"
grep -q 'module-07-highlights.md' "$root/downloads/setup-module-07.py"
grep -q '\.airr/' "$root/downloads/setup-module-07.py"
grep -q 'airr.sh' "$root/downloads/setup-module-07.py"
grep -q 'airr.ps1' "$root/downloads/setup-module-07.py"
grep -q 'Open this folder in VS Code' "$root/downloads/setup-module-07.py"
grep -q 'FINAL_RESULT PASS' "$root/downloads/setup-module-08.py"
grep -q 'setup-module-08-windows.ps1' "$root/module-8.html"
grep -q 'setup-module-08-macos.sh' "$root/module-8.html"
grep -q 'setup-module-08-linux.sh' "$root/module-8.html"
grep -q 'continued-from-module-07' "$root/downloads/setup-module-08.py"
grep -q 'standalone-example' "$root/downloads/setup-module-08.py"
grep -q 'module-08-work' "$root/downloads/setup-module-08.py"
grep -q 'build-module-08.sh' "$root/downloads/setup-module-08.py"
[[ "$(grep -o 'workspaceTitle:' "$root/assets/module-7-steps.js" | wc -l)" -eq 5 ]]
grep -q 'dataset.module7WorkspaceGuide' "$root/assets/module-7-steps.js"
if grep -q 'href="downloads/' "$root/module-7.html"; then
  echo 'Module 7 course files must be installed once in the first stage and opened from the VS Code workspace.' >&2
  exit 1
fi
if grep -q 'class="section final-cta"' "$root/module-7.html"; then
  echo 'Module 7 must use the classroom/module navigation and must not duplicate previous/next module buttons.' >&2
  exit 1
fi
[[ "$(grep -o 'command markdown-command ai-prompt' "$root/module-7.html" | wc -l)" -ge 5 ]]
[[ "$(grep -o 'command markdown-command copy-example' "$root/module-7.html" | wc -l)" -eq 2 ]]
if grep -q '<blockquote>' "$root/module-7.html"; then
  echo 'Module 7 must use semantic prompt/example/note components instead of ambiguous blockquotes.' >&2
  exit 1
fi
bash "$root/scripts/test-project-name.sh"
bash -n "$root/downloads/import-documents.sh"
python3 -c 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding="utf-8"), str(p), "exec")' "$root/downloads/import-office.py"
grep -q -- '--install-system|--setup-user' "$root/downloads/setup-linux.sh"
grep -q -- '--install-system|--setup-user' "$root/downloads/setup-macos.sh"
grep -q "ValidateSet('Check','Install','InstallSystem','SetupUser','Repair','Uninstall','UninstallSystem')" "$root/downloads/setup-windows.ps1"
grep -q 'UNINSTALL_RECEIPT_INVALID' "$root/downloads/setup-windows.ps1"
grep -q 'UNINSTALL_PRESERVE_MODIFIED' "$root/downloads/setup-windows.ps1"
grep -q 'installed-by-receipt' "$root/downloads/setup-windows.ps1"
grep -q 'preserves reused and modified items' "$root/scripts/test-windows-uninstall.ps1"
grep -q "SetupUser must run in a normal, non-Administrator PowerShell" "$root/downloads/setup-windows.ps1"
grep -q "InstallSystem requires -Agent codex, claude, openrouter, or antigravity" "$root/downloads/setup-windows.ps1"
grep -q "\[string\]\$Agent = 'openrouter'" "$root/downloads/setup-windows.ps1"
grep -q 'Write-Progress.*system installation' "$root/downloads/setup-windows.ps1"
grep -q 'ADMIN_PROGRESS' "$root/downloads/setup-windows.ps1"
grep -q '^function Save-UserPath' "$root/downloads/setup-windows.ps1"
for installer in setup-macos.sh setup-linux.sh; do
  grep -q 'agent="${AI_GRAD_AGENT:-openrouter}"' "$root/downloads/$installer"
  grep -q '^show_admin_progress()' "$root/downloads/$installer"
  grep -q '^persist_user_path()' "$root/downloads/$installer"
  default_output="$(AI_RESEARCH_DRY_RUN=1 AI_RESEARCH_TEST_COMMANDS='npm,code,uv' AI_RESEARCH_COURSE_DIR="${TMPDIR:-/tmp}/ai-research-default-agent-test" bash "$root/downloads/$installer" --setup-user)"
  [[ "$default_output" == *'OPENROUTER_READY'* && "$default_output" == *'AI workspace=openrouter'* && "$default_output" == *'PATH_READY'* ]]
done
grep -q -- '-Mode Install -Agent {agent}' "$root/prepare.html"
[[ "$(grep -c 'AI_GRAD_AGENT={agent}.*--install' "$root/prepare.html")" -eq 2 ]]
grep -q 'setPreference("ai-research-platform"' "$root/assets/app.js"
grep -q 'setPreference("ai-research-agent"' "$root/assets/app.js"
grep -q 'setPreference(projectNamePreference, projectName)' "$root/assets/app.js"
grep -q 'return getCookie(name) || localStorage.getItem(name)' "$root/assets/app.js"
grep -q 'data-template="cd.*{projectSh}' "$root/prepare.html"
grep -q 'AI_RESEARCH_PROJECT_NAME={projectPs}' "$root/prepare.html"
[[ "$(grep -o 'AI_RESEARCH_PROJECT_NAME={projectSh}' "$root/prepare.html" | wc -l)" -eq 2 ]]
grep -q 'href="prepare.html#project-basics"' "$root/module-2.html"
grep -q 'data-workspace-app' "$root/assets/app.js"
grep -q 'data-workspace-open-command' "$root/assets/app.js"
grep -q 'data-agent-panel' "$root/assets/app.js"
grep -q 'mainfont: Sarabun' "$root/downloads/modern-thai.yaml"
grep -q 'Path=templates/fonts/' "$root/downloads/modern-thai.yaml"
grep -Fq '\usepackage[fontsize=10.5pt]{fontsize}' "$root/downloads/modern-thai.tex"
if grep -Eq 'TH Sarabun|THSarabun|16pt' "$root/downloads/modern-thai.tex"; then
  echo 'Thai template must use Google Sarabun at the 10.5 pt baseline.' >&2
  exit 1
fi
grep -q 'latexmk, BibTeX/natbib, latexdiff, or Biber/BibLaTeX/csquotes' "$root/downloads/starter-AGENTS.md"
grep -q 'latexdiff old.tex new.tex' "$root/downloads/starter-AGENTS.md"
grep -Fq "Bash(latexdiff:*)" "$root/downloads/setup-runtime.py"
grep -Fq "Bash(latexmk:*)" "$root/downloads/setup-runtime.py"
grep -q 'saoudrizwan.claude-dev' "$root/downloads/setup-windows.ps1"
grep -q 'setup_windows_vscode' "$root/downloads/setup-linux.sh"
grep -q 'ms-vscode-remote.remote-wsl' "$root/downloads/setup-vscode-wsl.ps1"
grep -q 'The learner authorizes downloads' "$root/downloads/starter-AGENTS.md"
grep -q 'T1 Standard.*C0 Economy' "$root/downloads/starter-AGENTS.md"
grep -q 'token-saving Markdown subset' "$root/downloads/starter-STARTUP.md"
grep -q 'High-Cost Consent Rule' "$root/downloads/starter-TOKEN-BUDGET.md"
grep -q 'T3 Agentic Run' "$root/downloads/starter-TOKEN-DISCIPLINE.md"
grep -q 'Current objective:' "$root/downloads/starter-PROJECT-STATE.md"
grep -q 'Read and follow `AGENTS.md`' "$root/downloads/setup-runtime.py"
grep -q 'install_course_materials(workspace)' "$root/downloads/setup-runtime.py"
grep -q 'course-materials.json' "$root/downloads/setup-runtime.py"
[[ -s "$root/downloads/course-materials.json" ]]
python3 - "$root/downloads/course-materials.json" <<'PY'
import json
from pathlib import Path
import sys

manifest = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
assert manifest['schema_version'] == 'ai-for-research.course-materials.v1'
assert manifest['module_id'] == 'module-07'
assert len(manifest['files']) == 17
assert all(item['path'].startswith('course-materials/module-07/') for item in manifest['files'])
assert all('/downloads/course-materials/visualization/' in item['url'] for item in manifest['files'])
assert not any('instructor' in item['path'].lower() for item in manifest['files'])
paths = {item['path'] for item in manifest['files']}
assert {
    'course-materials/module-07/fonts/Sarabun-Regular.ttf',
    'course-materials/module-07/fonts/Sarabun-Bold.ttf',
    'course-materials/module-07/fonts/OFL.txt',
} <= paths
assert 'course-materials/module-07/tools/ai-for-research-course.py' in paths
PY
[[ -s "$root/downloads/course-materials-module-08.json" ]]
python3 - "$root/downloads/course-materials-module-08.json" "$root/downloads/course-materials.json" <<'PY'
import hashlib, json
from pathlib import Path
import sys

module8 = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
module7 = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
assert module8['schema_version'] == 'ai-for-research.course-materials.v1'
assert module8['module_id'] == 'module-08'
assert len(module8['files']) == 11
assert all(item['path'].startswith('course-materials/module-08/') for item in module8['files'])
assert all('/downloads/course-materials/document-production/' in item['url'] for item in module8['files'])
paths = {item['path'] for item in module8['files']}
assert {
    'course-materials/module-08/data/mock-study-data.csv',
    'course-materials/module-08/evidence/module-07-highlights-example.md',
    'course-materials/module-08/figures/pm25-before-after.png',
    'course-materials/module-08/literature/references.bib',
    'course-materials/module-08/templates/manuscript-starter.md',
} <= paths
m7_data = next(item for item in module7['files'] if item['path'].endswith('/mock-study-data.csv'))
m8_data = next(item for item in module8['files'] if item['path'].endswith('/mock-study-data.csv'))
assert m7_data['sha256'] == m8_data['sha256']
for item in module8['files']:
    relative = item['url'].split('/downloads/', 1)[1]
    source = Path(sys.argv[1]).parent / relative
    payload = source.read_bytes()
    assert len(payload) == item['bytes']
    assert hashlib.sha256(payload).hexdigest() == item['sha256']
PY
if rg -q 'scripts/context.py|workflow-registry|MACHINE_PROFILE|COMPUTING_ENVIRONMENT_VERSION' "$root/downloads/starter-STARTUP.md" "$root/downloads/starter-TOKEN-BUDGET.md" "$root/downloads/starter-TOKEN-DISCIPLINE.md"; then
  echo 'Token-economy starter must not pull full Agent Project Kit machinery.' >&2
  exit 1
fi
for font_file in Sarabun-Regular.ttf Sarabun-Bold.ttf OFL.txt; do
  [[ -s "$root/downloads/fonts/$font_file" ]]
done
grep -q 'pdf-engine: xelatex' "$root/downloads/modern-thai.yaml"
grep -q 'BrandBlue' "$root/downloads/modern-thai.lua"
grep -q 'BrandTeal' "$root/downloads/modern-thai.tex"
grep -q -- '--defaults templates/modern-thai.yaml' "$root/downloads/starter-AGENTS.md"
grep -q 'input/original/' "$root/downloads/starter-AGENTS.md"
grep -q 'input/markdown/' "$root/downloads/starter-AGENTS.md"
grep -q 'tesseract.*tha+eng' "$root/downloads/import-documents.sh"
grep -q 'pdftotext' "$root/downloads/import-documents.sh"
grep -q 'pdftoppm' "$root/downloads/import-documents.sh"
grep -q 'pdfinfo' "$root/downloads/setup-windows.ps1"
grep -q 'poppler-pdftotext' "$root/downloads/import-documents.sh"
grep -q 'Extraction:' "$root/downloads/import-documents.ps1"
grep -Fq 'python-pptx>=1.0,<2' "$root/downloads/import-documents.sh"
grep -Fq 'openpyxl>=3.1,<4' "$root/downloads/import-documents.ps1"
grep -q 'on-demand-packages.jsonl' "$root/downloads/import-documents.sh"
if grep -q 'requests>=2.32' "$root/downloads/setup-runtime.py"; then
  echo 'Requests must remain an on-demand OpenAlex dependency.' >&2
  exit 1
fi
grep -q 'L1–L4' "$root/module-2.html"
grep -q 'module-2-conclusion.md' "$root/module-2.html"
grep -q 'module-2-submission.json' "$root/module-2.html"
grep -q 'OPEN ANTIGRAVITY_WORKSPACE' "$root/downloads/setup-macos.sh"
grep -q 'คำตอบเปลี่ยนอย่างไรเมื่อกำหนดหลักฐานให้ชัด' "$root/module-2.html"
grep -q 'ช่วงที่ 1 · ดูคำตอบก่อนกำหนดกติกา' "$root/module-2.html"
grep -q 'ช่วงที่ 2 · ตรวจคำตอบกับต้นฉบับ' "$root/module-2.html"
grep -q 'ช่วงที่ 3 · ปรับคำสั่งแล้วเปรียบเทียบผล' "$root/module-2.html"
grep -q 'ขั้นนี้ไม่มี Prompt ให้คัดลอก' "$root/module-2.html"
grep -q 'ข้อความด้านล่างเป็นคำสั่งสร้างชิ้นงาน' "$root/module-2.html"
if grep -q 'อย่าเพิ่งใช้ Prompt ที่ดี' "$root/module-2.html"; then
  echo 'Module 2 activity must use learner-facing language.' >&2
  exit 1
fi
grep -q 'Evidence Boundary' "$root/module-3.html"
grep -q 'Candidate Gap' "$root/module-3.html"
grep -q 'Gap Prosecutor' "$root/module-3.html"
grep -q 'หิว → กิน → อิ่ม' "$root/module-3.html"
grep -q 'ลองหักล้างตัวอย่าง' "$root/module-3.html"
[[ "$(grep -o 'เคสฝึกนิสิต/นักวิจัยมือใหม่:' "$root/module-3.html" | wc -l)" -ge 12 ]]
grep -q 'href="hunger-research-methodology.html"' "$root/module-3.html"
grep -q 'Student &amp; Novice Researcher Case' "$root/hunger-research-methodology.html"
grep -q 'Problem Definition' "$root/hunger-research-methodology.html"
grep -q 'Constraint &amp; Scope' "$root/hunger-research-methodology.html"
grep -q 'Variable, Indicator &amp; Decision' "$root/hunger-research-methodology.html"
grep -q 'สร้างแล้วต้องพยายามหักล้าง' "$root/hunger-research-methodology.html"
grep -q 'output/problem-gap-rq.md' "$root/module-3.html"
grep -q 'การเตรียมตัวก่อนเรียน' "$root/module-3.html"
grep -q 'การเตรียมตัวก่อนเรียน' "$root/module-3.html"
if grep -q 'Standalone แต่ต่อยอดได้' "$root/module-3.html"; then
  echo 'Module 3 preparation must use learner-facing language.' >&2
  exit 1
fi
grep -q 'ทาง A · เรียนต่อจาก Module 2' "$root/module-3.html"
grep -q 'ทาง B · เริ่มจาก Module 3' "$root/module-3.html"
grep -q 'ขั้นที่ 2 · จุดนัดพบ' "$root/module-3.html"
grep -q 'ขั้นที่ 3 · กิจกรรมร่วม' "$root/module-3.html"
grep -q 'พัฒนาโจทย์และคำถามวิจัย' "$root/classroom.html"
grep -q 'Literature Evidence' "$root/module-4.html"
grep -q 'Discovery Source' "$root/module-4.html"
grep -q 'fabricated / phantom reference' "$root/module-4.html"
grep -q 'สี่คำที่ต้องแยกก่อนตรวจการอ้างอิง' "$root/module-4.html"
grep -q 'ข้อกำหนดของงานนี้:</strong> BibTeX ทุก entry ต้องมี <code>abstract</code>' "$root/module-4.html"
grep -q 'ให้ AI ค้นรายชื่องานที่เกี่ยวข้องแบบมีขอบเขต' "$root/module-4.html"
grep -q 'output/openalex/raw-works.jsonl' "$root/module-4.html"
grep -q 'per_page=100 และ cursor paging' "$root/module-4.html"
grep -q 'Use the OpenAlex snapshot instead of cursoring through the whole database' "$root/downloads/starter-AGENTS.md"
grep -q 'สร้าง BibTeX พร้อม Abstract' "$root/module-4.html"
grep -q 'ห้ามสรุปแทนต้นฉบับ' "$root/module-4.html"
grep -q 'BibTeX เก็บข้อมูลอ้างอิง, DOI ชี้ตัวเอกสาร' "$root/module-4.html"
grep -q 'APA คือกติกาการแสดงผล; BibTeX และ RIS คือรูปแบบไฟล์' "$root/module-4.html"
grep -q 'ตัวอย่างสมมติ—ห้ามนำไปอ้างอิง' "$root/module-4.html"
grep -q 'ค้นหลักฐานใหม่สำหรับ Claim' "$root/module-4.html"
grep -q 'มีงานเขียนที่อยากตรวจการอ้างอิง' "$root/module-4.html"
grep -q 'ตัดสินใจว่าจะเก็บ ปรับ หรือตัด Citation' "$root/module-4.html"
if grep -q 'จุดนัดพบ\|มาบรรจบกัน\|Module นี้เริ่มเรียนได้โดยตรง\|ผู้เรียนทำ:\|ส่งให้ AI:\|ส่งให้ AI หลังมีแหล่งต้นทาง:\|ผลที่คาดหวัง:' "$root/module-4.html"; then
  echo 'Module 4 must use learner-facing language instead of workflow labels.' >&2
  exit 1
fi
grep -q 'output/literature-evidence-table.md' "$root/module-4.html"
grep -q 'output/citation-self-audit.md' "$root/module-4.html"
grep -q 'output/citation-verification-checklist.md' "$root/module-4.html"
grep -q 'ค้นและตรวจวรรณกรรม' "$root/classroom.html"
grep -q 'latexdiff old.tex new.tex' "$root/module-8.html"
grep -q 'diff.tex.*source หลัก' "$root/module-8.html"
grep -q 'Revision Diff Record' "$root/downloads/module-08-venue-document-workbook.md"
if grep -q 'data-agent-launch' "$root/prepare.html"; then
  echo 'Primary readiness flow must use the in-editor AI panel, not launch a CLI.' >&2
  exit 1
fi
for installer in "$root/downloads/setup-windows.ps1" "$root/downloads/setup-macos.sh" "$root/downloads/setup-linux.sh"; do
  grep -q '@openai/codex' "$installer"
  grep -q '@anthropic-ai/claude-code' "$installer"
  grep -q 'antigravity.google/download#antigravity-ide' "$installer"
  grep -q 'agy-ide' "$installer"
  grep -q 'openai.chatgpt' "$installer"
  grep -q 'anthropic.claude-code' "$installer"
  grep -q 'mathematic.vscode-pdf' "$installer"
  grep -q 'ganymede404.vscode-codex-usage' "$installer"
  grep -q 'growthjack.claude-code-usage' "$installer"
  grep -q 'ThiagoSantosDevBR.openrouter-ai-monitor' "$installer"
  grep -q 'sourabhr10122002.antigravity-quota-checker' "$installer"
  grep -q 'modern-thai.yaml' "$installer"
  grep -q 'modern-thai.tex' "$installer"
  grep -q 'Sarabun-Regular.ttf' "$installer"
  grep -q 'Sarabun-Bold.ttf' "$installer"
  grep -q 'FONT_READY Sarabun Regular/Bold bundled in workspace' "$installer"
  grep -q 'FONT_SETUP_FAILED' "$installer"
  grep -q 'CREATE VS_CODE_PROFILE' "$installer"
  grep -q 'SETUP_VERSION' "$installer"
  grep -q 'PREREQUISITE_MISSING' "$installer"
  grep -q 'starter-AGENTS.md' "$installer"
  grep -q 'starter-STARTUP.md' "$installer"
  grep -q 'starter-TOKEN-DISCIPLINE.md' "$installer"
  grep -q 'starter-TOKEN-BUDGET.md' "$installer"
  grep -q 'starter-PROJECT-STATE.md' "$installer"
  grep -q 'import-documents.sh' "$installer"
  grep -q 'import-documents.ps1' "$installer"
  grep -q 'import-office.py' "$installer"
  grep -q 'validate-module-2.py' "$installer"
  grep -q 'validate-module-3.py' "$installer"
  grep -qi 'tesseract' "$installer"
  grep -qi 'poppler\|pdftotext' "$installer"
  grep -q 'AI for Research - ' "$installer"
  grep -q 'extensions.json' "$installer"
  grep -q 'AI_FRONTENDS available=' "$installer"
  grep -q 'FINAL_RESULT PASS' "$installer"
  grep -q 'FINAL_RESULT FAIL' "$installer"
  grep -q 'INSTALL_STOPPED' "$installer"
  grep -q 'REUSE' "$installer"
  grep -q 'INSTALL' "$installer"
done
bash "$root/scripts/test-prepare-page.sh"
if rg -n --glob '!test-installers.sh' 'gemini|Gemini CLI|@google/gemini-cli' "$root"; then
  echo 'Obsolete Gemini CLI reference found.' >&2
  exit 1
fi

grep -Fq 'พัฒนาโจทย์และคำถามวิจัย' "$root/classroom.html"
grep -Fq 'ค้นและตรวจวรรณกรรม' "$root/classroom.html"
grep -Fq 'Data Analytics, Visualization &amp; Machine Learning' "$root/classroom.html"
grep -Fq 'Manuscript Preparation' "$root/classroom.html"
grep -q 'LOCAL_CHECK PASS/FAIL' "$root/downloads/starter-AGENTS.md"
for name in \
  'Prepare Your AI Research Workspace' \
  'Your First AI Research Task' \
  'Problem Statement → Research Gap' \
  'Literature Evidence' \
  'Research Logic' \
  'Experiment Design Stress Test' \
  'Analysis & Visualization' \
  'Document Production' \
  'Personal AI Research Practice'; do
  grep -Fq "$name" "$root/assets/site-shell.js"
done
if rg -n 'M2 · AI Boundaries</a>|M3 · Problem–Gap–RQ</a>|M4 · Literature</a>|M5 · Logic Review</a>|M6 · (Experiment Design|Design Review|Result–Claim)</a>|M7 · (Analysis Review|Analysis &amp; Visuals)</a>|M8 · Document QA</a>|M9 · (Build-up Kit|Reviews Kit|Publication Kit)</a>' "$root/index.html"; then
  echo 'Non-canonical module label found on the homepage.' >&2
  exit 1
fi
for page in prepare.html module-{3..9}.html; do
  grep -q 'data-research-profile' "$root/$page"
done
grep -q 'ai-research-profile:v1' "$root/assets/app.js"
grep -q 'คัดลอกข้อมูลให้ AI' "$root/assets/app.js"
grep -q 'profileContextText' "$root/assets/app.js"
grep -q 'profileKeysByModule' "$root/assets/app.js"
echo 'Installer static checks passed.'
# Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI; UTF-8 punctuation (e.g. an em dash) breaks parsing.
# Every shipped .ps1 must be pure ASCII or start with a UTF-8 BOM.
python3 - "$root" <<'PY'
import pathlib, sys
bad = []
for p in sorted(pathlib.Path(sys.argv[1]).rglob('*.ps1')):
    b = p.read_bytes()
    if not b.startswith(b'\xef\xbb\xbf') and any(c > 127 for c in b):
        bad.append(str(p))
if bad:
    sys.exit('ERROR: non-ASCII .ps1 without UTF-8 BOM: ' + ', '.join(bad))
PY
