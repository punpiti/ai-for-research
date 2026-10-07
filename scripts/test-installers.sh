#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 -B "$root/scripts/test-runtime.py"
bash "$root/scripts/test-wsl-vscode.sh"
bash -n "$root/downloads/setup-linux.sh"
bash -n "$root/downloads/setup-macos.sh"
bash -n "$root/downloads/import-documents.sh"
python3 -c 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding="utf-8"), str(p), "exec")' "$root/downloads/import-office.py"
grep -q -- '--install-system|--setup-user' "$root/downloads/setup-linux.sh"
grep -q -- '--install-system|--setup-user' "$root/downloads/setup-macos.sh"
grep -q "ValidateSet('Check','Install','InstallSystem','SetupUser','Repair','Uninstall','UninstallSystem')" "$root/downloads/setup-windows.ps1"
grep -q 'UNINSTALL_RECEIPT_INVALID' "$root/downloads/setup-windows.ps1"
grep -q 'UNINSTALL_PRESERVE_MODIFIED' "$root/downloads/setup-windows.ps1"
grep -q 'installed-by-receipt' "$root/downloads/setup-windows.ps1"
grep -q -- '-Mode Uninstall' "$root/prepare.html"
grep -q 'preserves reused and modified items' "$root/scripts/test-windows-uninstall.ps1"
grep -q "SetupUser must run in a normal, non-Administrator PowerShell" "$root/downloads/setup-windows.ps1"
grep -q "InstallSystem requires -Agent codex, claude, openrouter, or antigravity" "$root/downloads/setup-windows.ps1"
grep -q -- '-Mode Install -Agent {agent}' "$root/prepare.html"
[[ "$(grep -c 'AI_GRAD_AGENT={agent}.*--install' "$root/prepare.html")" -eq 2 ]]
grep -q 'setPreference("ai-research-platform"' "$root/assets/app.js"
grep -q 'setPreference("ai-research-agent"' "$root/assets/app.js"
grep -q 'return getCookie(name) || localStorage.getItem(name)' "$root/assets/app.js"
grep -q 'cd.*ai-for-research-workspace' "$root/prepare.html"
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
grep -q 'first-ai-research-task.pdf' "$root/module-2.html"
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
[[ "$(grep -o 'ตัวอย่างหิว–กิน–อิ่ม:' "$root/module-3.html" | wc -l)" -ge 12 ]]
grep -q 'href="hunger-research-methodology.html"' "$root/module-3.html"
grep -q 'Research Methodology Review' "$root/hunger-research-methodology.html"
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
grep -q 'href="module-3.html"' "$root/index.html"
grep -q 'Literature Evidence' "$root/module-4.html"
grep -q 'Discovery Source' "$root/module-4.html"
grep -q 'fabricated / phantom reference' "$root/module-4.html"
grep -q 'BibTeX คืออะไร และต่างจาก Citation อย่างไร' "$root/module-4.html"
grep -q 'ข้อกำหนดของงานนี้:</strong> BibTeX ทุก entry ต้องมี <code>abstract</code>' "$root/module-4.html"
grep -q 'Crawling แบบมีขอบเขตและทำซ้ำได้' "$root/module-4.html"
grep -q 'output/openalex/raw-works.jsonl' "$root/module-4.html"
grep -q 'per_page=100 และ cursor paging' "$root/module-4.html"
grep -q 'Use the OpenAlex snapshot instead of cursoring through the whole database' "$root/downloads/starter-AGENTS.md"
grep -q 'สร้าง BibTeX พร้อม Abstract' "$root/module-4.html"
grep -q 'ห้ามสรุปแทนต้นฉบับ' "$root/module-4.html"
grep -q 'BibTeX เก็บข้อมูลอ้างอิง, DOI ชี้ตัวเอกสาร' "$root/module-4.html"
grep -q 'APA คือกติกาการแสดงผล; BibTeX และ RIS คือรูปแบบไฟล์' "$root/module-4.html"
grep -q 'ตัวอย่างสมมติ—ห้ามนำไปอ้างอิง' "$root/module-4.html"
grep -q 'Claim ที่ต้องหาหลักฐาน' "$root/module-4.html"
grep -q 'งานเขียนที่ต้องตรวจ Citation' "$root/module-4.html"
grep -q 'ตัดสินใจว่าจะเก็บ ปรับ หรือตัด Citation' "$root/module-4.html"
if grep -q 'จุดนัดพบ\|มาบรรจบกัน\|Module นี้เริ่มเรียนได้โดยตรง\|ผู้เรียนทำ:\|ส่งให้ AI:\|ส่งให้ AI หลังมีแหล่งต้นทาง:\|ผลที่คาดหวัง:' "$root/module-4.html"; then
  echo 'Module 4 must use learner-facing language instead of workflow labels.' >&2
  exit 1
fi
grep -q 'output/literature-evidence-table.md' "$root/module-4.html"
grep -q 'output/citation-self-audit.md' "$root/module-4.html"
grep -q 'output/citation-verification-checklist.md' "$root/module-4.html"
grep -q 'href="module-4.html"' "$root/index.html"
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

canonical_module_names=(
  'Prepare Your AI Research Workspace'
  'Your First AI Research Task'
  'Problem → Gap → Research Question'
  'Literature Evidence'
  'Research Logic'
  'Experiment Design Stress Test'
  'Analysis &amp; Visualization'
  'Document Production'
  'Personal AI Research Workflow'
)
for name in "${canonical_module_names[@]}"; do
  grep -Fq "$name" "$root/index.html"
done
for name in \
  'Prepare Your AI Research Workspace' \
  'Your First AI Research Task' \
  'Problem → Gap → Research Question' \
  'Literature Evidence' \
  'Research Logic' \
  'Experiment Design Stress Test' \
  'Analysis & Visualization' \
  'Document Production' \
  'Personal AI Research Workflow'; do
  grep -Fq "$name" "$root/assets/site-shell.js"
done
if rg -n 'M2 · AI Boundaries</a>|M3 · Problem–Gap–RQ</a>|M4 · Literature</a>|M5 · Logic Review</a>|M6 · (Experiment Design|Design Review|Result–Claim)</a>|M7 · (Analysis Review|Analysis &amp; Visuals)</a>|M8 · Document QA</a>|M9 · (Build-up Kit|Reviews Kit|Publication Kit)</a>' "$root/index.html"; then
  echo 'Non-canonical module label found on the homepage.' >&2
  exit 1
fi
for page in prepare.html module-{2..9}.html; do
  grep -q 'data-research-profile' "$root/$page"
done
grep -q 'ai-research-profile:v1' "$root/assets/app.js"
grep -q 'คัดลอกข้อมูลให้ AI' "$root/assets/app.js"
grep -q 'profileContextText' "$root/assets/app.js"
grep -q 'profileKeysByModule' "$root/assets/app.js"
echo 'Installer static checks passed.'
