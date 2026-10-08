#!/usr/bin/env bash
set -euo pipefail

site_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
module_source_dir="$site_dir/../documents/ai-for-grad-students-syllabus/modules"
failed=0

check_file() {
  local file="$1"
  local label="$2"
  local pattern="$3"
  if ! grep -Eqi "$pattern" "$file"; then
    printf 'MISSING %-18s %s\n' "$label" "${file##*/}"
    failed=1
  fi
}

check_file "$site_dir/index.html" "hunger review" 'หิว.*กิน.*อิ่ม'
check_file "$site_dir/hunger-research-methodology.html" "long hunger story" 'id="full-story"'
check_file "$site_dir/hunger-research-methodology.html" "original hunger image" 'assets/images/hunger-research-facebook-original\.jpg'
check_file "$site_dir/hunger-research-methodology.html" "original Facebook post" 'facebook\.com/punpiti/posts/10225212568646302'
check_file "$site_dir/hunger-research-methodology.html" "quick hunger review" 'id="quick-review"'

for number in {2..9}; do
  file="$site_dir/module-$number.html"
  check_file "$file" "preparation" 'ของต้องมีก่อนเรียน'
  check_file "$file" "LO label" '<p class="eyebrow">LO</p>'
  check_file "$file" "learning outcomes" '<h2[^>]*>สิ่งที่จะทำได้</h2>'
  check_file "$file" "checkpoint label" '<p class="eyebrow">Checkpoint</p>'
  check_file "$file" "post-lesson result" '<h2[^>]*>จบบทเรียน</h2>'
  check_file "$file" "learner profile" 'data-research-profile'
done
check_file "$site_dir/module-3.html" "M3 learner level choice" 'นักเรียน / ผู้เริ่มต้น'
check_file "$site_dir/module-3.html" "M3 faculty route" 'อาจารย์ / นักวิจัย'
check_file "$site_dir/module-3.html" "M3 own seed paper" 'research article ของตนเอง'
check_file "$site_dir/module-3.html" "M3 abstract provenance" 'abstract_source|Abstract และ Provenance'
check_file "$site_dir/module-3.html" "M3 field dimensions" 'method, dataset/material, objective, technique/model'
check_file "$site_dir/module-3.html" "M3 research map" 'Research Map'
check_file "$site_dir/module-3.html" "M3 seed problem statement" 'seed-problem-statement\.md'
check_file "$site_dir/module-3.html" "M3 opportunity critique" 'วิจารณ์โอกาสของโจทย์'
check_file "$site_dir/module-3.html" "M3 reverse search" 'reverse search'
check_file "$site_dir/module-3.html" "M3 lawful access" 'เข้าถึงได้อย่างถูกต้อง'
check_file "$site_dir/module-3.html" "M3 PDF fallback DOI report" 'reference-download-report\.csv.*DOI'
check_file "$site_dir/module-3.html" "M3 citation audit" 'citation-audit\.csv'
check_file "$site_dir/module-3.html" "M3 citation without ref" 'citation_without_reference'
check_file "$site_dir/module-3.html" "M3 unsupported citation" 'not_supported'
check_file "$site_dir/module-3.html" "M3 reference database check" 'reference_not_found_in_checked_databases'
check_file "$site_dir/module-3.html" "M3 course search abstraction" 'ระบบสืบค้นของรายวิชา'
if rg -qi 'openalex' "$site_dir/module-3.html"; then
  echo "LEAK M3 backend search provider module-3.html" >&2
  status=1
fi
check_file "$site_dir/module-3.html" "M3 reference quality profile" 'reference-quality\.csv'
check_file "$site_dir/module-3.html" "M3 retraction status" 'retracted'
check_file "$site_dir/module-3.html" "M3 author prior" 'author-prior\.md'
check_file "$site_dir/module-3.html" "M3 blind-spot ledger" 'blind-spot-ledger\.csv'
check_file "$site_dir/module-3.html" "M3 personal learning status" 'new_to_author'
check_file "$site_dir/module-3.html" "M3 paper-alignment gate" 'opportunity-alignment\.csv'
check_file "$site_dir/module-3.html" "M3 adjacent opportunity separation" 'adjacent_only'
check_file "$site_dir/module-3.html" "M3 Introduction paper anchor" 'Introduction ใน input/markdown/seed-paper\.md'
check_file "$site_dir/module-3.html" "M3 multi-dimensional RQ" 'research-question-candidates\.csv'
check_file "$site_dir/module-3.html" "M3 learner rating review" 'rq-rating-review\.csv'
check_file "$site_dir/module-3.html" "M3 RQ rating disagreement" 'partly_agree.*disagree'
check_file "$site_dir/module-3.html" "M3 completion JSON" 'module-3-completion\.json'
check_file "$site_dir/module-3.html" "M3 local AI validator" 'tools/validate-module-3\.py'
check_file "$site_dir/module-3.html" "M3 progress form" 'data-module-3-submission-form'
check_file "$site_dir/assets/module-3-submission.js" "M3 progress endpoint" '/api/ai-for-research/module-3/submissions'
node --check "$site_dir/assets/module-3-submission.js"
python3 - "$site_dir/downloads/validate-module-3.py" <<'PYM3'
import hashlib, json, subprocess, sys, tempfile
from pathlib import Path

validator = Path(sys.argv[1])
names = ("refs.bib", "reference-status.csv", "reference-download-report.csv", "citation-audit.csv", "author-prior.md", "reference-quality.csv", "blind-spot-ledger.csv", "reference-quality-assessment.md", "paper-classification.csv", "research-map.md", "seed-problem-statement.md", "opportunity-alignment.csv", "research-opportunity-brief.md", "research-question-candidates.csv", "rq-rating-review.csv")
with tempfile.TemporaryDirectory(prefix="module3-validator-test-") as folder:
    root = Path(folder); out = root / "output/module-3"; out.mkdir(parents=True)
    artifacts = []
    for name in names:
        path = out / name; path.write_text(f"verified test artifact: {name}\n", encoding="utf-8")
        artifacts.append({"path": f"output/module-3/{name}", "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    metrics = {key: 0 for key in ("reference_count", "reference_verified_count", "reference_not_found_count", "reference_unresolved_count", "pdf_downloaded_count", "pdf_missing_count", "markdown_reference_count", "citation_count", "citation_without_reference_count", "citation_supported_count", "citation_partial_count", "citation_not_supported_count", "citation_not_checkable_count", "quartile_available_count", "quartile_not_applicable_count", "quartile_unresolved_count", "h_index_available_count", "h_index_not_applicable_count", "h_index_unresolved_count", "integrity_retracted_count", "integrity_expression_of_concern_count", "integrity_withdrawn_count", "integrity_corrected_count", "integrity_no_notice_count", "integrity_unresolved_count", "blind_spot_candidate_count", "blind_spot_already_known_count", "blind_spot_new_to_author_count", "blind_spot_rejected_count", "blind_spot_unresolved_count", "classification_dimension_count", "paper_classified_count", "opportunity_candidate_count", "opportunity_weakened_count", "opportunity_rejected_count", "opportunity_directly_aligned_count", "opportunity_extends_scope_count", "opportunity_tests_boundary_count", "opportunity_adjacent_count", "opportunity_unrelated_count", "opportunity_author_endorsed_count", "rq_candidate_count", "rq_dimension_count", "rq_ai_strong_count", "rq_ai_develop_count", "rq_ai_weak_count", "rq_review_agree_count", "rq_review_partly_agree_count", "rq_review_disagree_count", "rq_revised_rating_count", "rq_new_to_author_count", "rq_keep_count", "rq_revise_count", "rq_drop_count")}
    metrics.update(reference_count=8, reference_verified_count=6, reference_not_found_count=1, reference_unresolved_count=1, pdf_downloaded_count=6, pdf_missing_count=2, markdown_reference_count=6, citation_count=4, citation_without_reference_count=1, citation_supported_count=3, citation_not_checkable_count=1, quartile_available_count=5, quartile_not_applicable_count=1, quartile_unresolved_count=2, h_index_available_count=5, h_index_not_applicable_count=1, h_index_unresolved_count=2, integrity_retracted_count=1, integrity_corrected_count=1, integrity_no_notice_count=5, integrity_unresolved_count=1, blind_spot_candidate_count=4, blind_spot_already_known_count=1, blind_spot_new_to_author_count=1, blind_spot_rejected_count=1, blind_spot_unresolved_count=1, classification_dimension_count=5, paper_classified_count=8, opportunity_candidate_count=1, opportunity_directly_aligned_count=1, opportunity_author_endorsed_count=1, rq_candidate_count=4, rq_dimension_count=4, rq_ai_strong_count=1, rq_ai_develop_count=2, rq_ai_weak_count=1, rq_review_agree_count=1, rq_review_partly_agree_count=2, rq_review_disagree_count=1, rq_revised_rating_count=3, rq_new_to_author_count=2, rq_keep_count=1, rq_revise_count=2, rq_drop_count=1)
    payload = {"schema_version": "ai-for-research.module-3-completion.v1", "module_id": "module-3", "route": "faculty", "checks": {key: True for key in ("evidence_ready", "problem_statement_reviewed", "candidate_gap_reviewed", "reverse_search_completed", "learner_decision_recorded", "local_validator_passed")}, "metrics": metrics, "artifacts": artifacts}
    completion = out / "module-3-completion.json"; completion.write_text(json.dumps(payload), encoding="utf-8")
    passed = subprocess.run([sys.executable, str(validator), str(completion), "--workspace", str(root)], capture_output=True, text=True)
    assert passed.returncode == 0, passed.stderr
    assert "LOCAL_CHECK PASS" in passed.stdout
    payload["metrics"]["citation_count"] = 99; completion.write_text(json.dumps(payload), encoding="utf-8")
    failed = subprocess.run([sys.executable, str(validator), str(completion), "--workspace", str(root)], capture_output=True, text=True)
    assert failed.returncode == 1 and "LOCAL_CHECK FAIL" in failed.stderr
PYM3

for number in {2..9}; do
  file="$site_dir/module-$number.html"
  check_file "$file" "checkpoint checklist" "data-checklist=\"module-$number\""
  check_file "$file" "checkpoint percent" 'ความสำเร็จ <strong data-progress>0%</strong>'
done

check_file "$site_dir/prepare.html" "preparation" 'ของต้องมีก่อนเรียน'
check_file "$site_dir/prepare.html" "LO label" '<p class="eyebrow">LO</p>'
check_file "$site_dir/prepare.html" "learning outcomes" '<h2[^>]*>สิ่งที่จะทำได้</h2>'
check_file "$site_dir/prepare.html" "checkpoint label" '<p class="eyebrow">Checkpoint</p>'
check_file "$site_dir/prepare.html" "post-lesson result" '<h2[^>]*>จบบทเรียน</h2>'
check_file "$site_dir/prepare.html" "learner profile" 'data-research-profile'

check_file "$site_dir/module-5.html" "standalone M5 path" 'ทาง B — เริ่มที่โมดูล 5'
check_file "$site_dir/module-5.html" "prior-module M5 path" 'ทาง A — มีผลงานจาก Module 3–4'
check_file "$site_dir/module-5.html" "canonical M3 output" 'output/problem-gap-rq\.md'
if grep -q 'problem-gap-rq-map\.md' "$site_dir/module-5.html"; then
  printf 'Found the retired problem-gap-rq-map.md filename in module-5.html.\n'
  failed=1
fi
check_file "$site_dir/module-5.html" "guided AI learning" 'ลงมือพัฒนาโจทย์และแบบวิจัยไปทีละขั้น'
check_file "$site_dir/module-5.html" "one-question tutor" 'ถามฉันเพียงหนึ่งคำถาม'
check_file "$site_dir/module-5.html" "progressive reference" 'เปิดคลังคำอธิบายเมื่อ AI พามาถึงแนวคิดนั้น'
check_file "$site_dir/module-5.html" "interactive checkpoint" 'class="checklist" data-checklist="module-5"'
check_file "$site_dir/module-5.html" "checkpoint boxes" '<label><input type="checkbox">'

check_file "$site_dir/module-6.html" "M6 stage 1 prompt" 'เริ่มช่วง 1 จากข้อมูลที่ฉันให้ไว้'
check_file "$site_dir/module-6.html" "M6 stage 2 prompt" 'ใช้ข้อกล่าวอ้างที่ฉันยืนยันในช่วง 1'
check_file "$site_dir/module-6.html" "M6 stage 3 prompt" 'เปิดส่วนระบุส่วนประกอบของการศึกษาในสมุดงาน'
check_file "$site_dir/module-6.html" "M6 stage 4 prompt" 'พาฉันตรวจช่วง 4 ทีละเครื่องมือ'
check_file "$site_dir/module-6.html" "M6 stage 5 prompt" 'ช่วยฉันทำบัตรสถานการณ์สมมติทีละใบ'
check_file "$site_dir/module-6.html" "M6 stage 6 prompt" 'ท้าทายแบบวิจัยของฉันทีละหนึ่งประเด็น'
check_file "$site_dir/module-6.html" "M6 stage 7 prompt" 'แสดงหลักฐานสนับสนุนและจุดค้างของสถานะความพร้อมทั้งสี่ทาง'
if (( $(grep -c 'data-m6-stage-prompt' "$site_dir/module-6.html") < 7 )); then
  printf 'Module 6 needs a separate AI interaction prompt for all seven stages.\n'
  failed=1
fi
for number in 7 8 9; do
  if (( $(grep -c "data-m${number}-stage-prompt" "$site_dir/module-$number.html") < 7 )); then
    printf 'Module %s needs an AI interaction prompt for every guided stage.\n' "$number"
    failed=1
  fi
  check_file "$site_dir/module-$number.html" "M$number learner decision" 'คุณตัดสิน|ผู้เรียนตัดสิน|ก่อนผ่าน|ก่อนจบ'
done
check_file "$site_dir/module-8.html" "static M8 checklist" 'class="checklist" data-checklist="module-8"'
check_file "$site_dir/module-9.html" "static M9 checklist" 'class="checklist" data-checklist="module-9"'
if grep -Eqi 'Pain-point Inventory|Framework Mapping|Choice Clinic|Kit Assembly|Messy Folder Drill|Dry Run|Chaos Test|Peer Attack|Walkthrough' "$site_dir/module-9.html"; then
  printf 'Found unnecessary English activity labels in module-9.html.\n'
  failed=1
fi

for number in {6..9}; do
  check_file "$site_dir/assets/app.js" "guided Module $number" "^  $number: \\{"
  check_file "$site_dir/module-$number.html" "Module $number activity" 'id="activity"'
  check_file "$site_dir/module-$number.html" "Module $number checkpoint" 'id="finish"'
done
check_file "$site_dir/assets/app.js" "guided prompt" 'อ่านไป ทำไป และคิดไปทีละขั้น'
check_file "$site_dir/prepare.html" "shared copy component" 'class="command"><code>.*</code><button type="button" data-copy'
check_file "$site_dir/assets/styles.css" "copy-only visual" 'copy-only-template.*background: #0c2923'
check_file "$site_dir/assets/app.js" "explicit shared copy-only class" 'classList.add\("copy-only-template"\)'
check_file "$site_dir/assets/app.js" "copy-only learning structure" 'งาน: \$\{heading\}\\n\\nคำสั่ง:'
check_file "$site_dir/assets/app.js" "copy-only readable heading" 'copy-prompt-heading'
check_file "$site_dir/assets/styles.css" "editable visual" 'prompt-template::before.*แก้ไขข้อมูลของคุณก่อนคัดลอก'
check_file "$site_dir/assets/styles.css" "editable background" 'prompt-editor.*background: #fff1e9'
for number in {5..9}; do
  check_file "$site_dir/module-$number.html" "M$number static checklist" "class=\"checklist\" data-checklist=\"module-$number\""
  check_file "$site_dir/module-$number.html" "M$number progress percent" 'ความสำเร็จ <strong data-progress>0%</strong>'
done
check_file "$site_dir/module-5.html" "M5 learner-first path" 'คุณเริ่มได้จากหน้าสนทนา'
check_file "$site_dir/module-6.html" "M6 learner-first path" 'เริ่มจากสมุดงานหรือข้อมูลของคุณ'
check_file "$site_dir/module-7.html" "M7 learner-first path" 'คุณถาม เลือก และตรวจ ส่วน AI ช่วยคำนวณและสร้างภาพ'
check_file "$site_dir/module-8.html" "M8 learner-owned content" 'คุณรับผิดชอบเนื้อหา ส่วนแม่แบบช่วยจัดหน้า'
check_file "$site_dir/module-8.html" "M8 no-code learner path" 'ไม่ต้องแก้โค้ดหรือระบบสร้างเอกสารเอง'
check_file "$site_dir/module-9.html" "M9 learner-owned method" 'คุณกำหนดวิธีและกติกา ส่วน AI ช่วยจัดชุดใช้งาน'
for number in {6..9}; do
  if grep -Eq "class=\"command markdown-command prompt-template\" data-m${number}-stage-prompt" "$site_dir/module-$number.html"; then
    printf 'Module %s stage prompts must use the shared copy-only command component.\n' "$number"
    failed=1
  fi
  check_file "$site_dir/module-$number.html" "M$number shared copy command" "class=\"command markdown-command\" data-m${number}-stage-prompt"
done
check_file "$site_dir/module-7.html" "Thai population lab link" 'module-7-thailand-population-lab\.html'

check_file "$site_dir/module-2.html" "shared food case" 'มื้อข้าวไข่เจียวเหมาะกับนักศึกษา'
check_file "$site_dir/module-2.html" "M2 file explainer" 'data-file-structure-explainer'
check_file "$site_dir/module-2.html" "M2 Markdown structure" 'Markdown · เขียนให้คนอ่าน'
check_file "$site_dir/module-2.html" "M2 JSON structure" 'JSON · จัดข้อมูลให้โปรแกรมตรวจ'
python3 - "$site_dir/module-2.html" <<'PYFILESTRUCTURE'
import re, sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
first_reference = html.index("ข้อสรุป Markdown กับ JSON")
explainer = html.index("data-file-structure-explainer")
assert first_reference < explainer, "file explainer must follow the first Markdown/JSON reference"
tag = re.search(r"<details[^>]*data-file-structure-explainer[^>]*>", html).group(0)
assert not re.search(r"\sopen(?:\s|=|>)", tag), "file explainer must be collapsed initially"
PYFILESTRUCTURE
for extension in pdf xlsx docx png; do
  check_file "$site_dir/module-2.html" "M2 $extension evidence" "module-02-food-evidence/[^\"]+\.${extension}"
done
check_file "$site_dir/module-2.html" "M2 website evidence" 'module-2-food-case\.html'
check_file "$site_dir/module-2.html" "M2 prepared download" 'เราเตรียมข้อมูลไว้ให้แล้ว'
check_file "$site_dir/module-2.html" "M2 bundle download" 'downloads/module-02-food-evidence\.zip'
check_file "$site_dir/module-2.html" "M2 first data prompt" 'Prompt แรกใช้บริหารจัดการข้อมูล'
check_file "$site_dir/module-2.html" "M2 safe extraction" 'path ภายในไม่เขียนออกนอกโฟลเดอร์ปลายทาง'
check_file "$site_dir/module-2.html" "M2 import report" 'import-report\.md'
check_file "$site_dir/module-2.html" "M2 live web retrieval" '06-web-source\.txt.*live_url|อ่าน 06-web-source\.txt'
check_file "$site_dir/module-2.html" "M2 web provenance" 'final URL, เวลาเข้าถึง, HTTP status, content type และ SHA-256'
check_file "$site_dir/module-2.html" "M2 web fallback" 'หากเข้าไม่ได้ให้ใช้สำเนาเดิม'
check_file "$site_dir/module-2.html" "M2 conclusion Markdown" 'output/module-2-conclusion\.md'
check_file "$site_dir/module-2.html" "M2 submission JSON" 'output/module-2-submission\.json'
check_file "$site_dir/module-2.html" "M2 schema download" 'downloads/module-02-submission-schema\.json'
check_file "$site_dir/module-2.html" "M2 file lesson" 'เปิด Markdown และ JSON อ่านเองก่อน'
check_file "$site_dir/module-2.html" "M2 Markdown heading" 'Markdown \(\.md\) คือเอกสารข้อความ'
check_file "$site_dir/module-2.html" "M2 Markdown syntax" '<code>#</code> หัวข้อ'
check_file "$site_dir/module-2.html" "M2 Markdown example" 'คัดลอกตัวอย่าง Markdown'
check_file "$site_dir/module-2.html" "M2 JSON lesson" 'JSON คือข้อมูลที่มีโครงสร้างสำหรับโปรแกรม'
check_file "$site_dir/module-2.html" "M2 JSON example" 'downloads/module-02-submission-example\.json'
check_file "$site_dir/module-2.html" "M2 JSON types" 'Object.*Array|ชนิดของค่า'
check_file "$site_dir/module-2.html" "M2 open questions" 'open_questions.*ยังตอบไม่ได้|ยังไม่ตอบด้วย'
check_file "$site_dir/module-2.html" "M2 next prompt" 'next_prompt.*ห้ามรัน Prompt'
check_file "$site_dir/module-2.html" "M2 learner fills unanswered items" 'learner_additions.*ผู้เรียน|ผู้เรียนเขียน.*learner_additions'
check_file "$site_dir/module-2.html" "M2 submission form" 'data-module-2-submission-form'
check_file "$site_dir/module-2.html" "M2 receipt" 'data-module-2-receipt-download'
check_file "$site_dir/module-2.html" "M2 call sign" 'Call sign \(นามเรียกขาน\)'
check_file "$site_dir/module-2.html" "M2 local full JSON" 'ไฟล์ JSON · ตรวจในเครื่องเท่านั้น'
check_file "$site_dir/module-2.html" "M2 progress JSON only" 'ส่งเฉพาะ Progress JSON'
check_file "$site_dir/module-2.html" "M2 downloadable validator" 'downloads/validate-module-2\.py'
check_file "$site_dir/module-2.html" "M2 local validator pass" 'LOCAL_CHECK PASS'
check_file "$site_dir/module-2.html" "M2 local Markdown" 'ไฟล์ Markdown · ตรวจในเครื่องเท่านั้น'
check_file "$site_dir/assets/module-2-submission.js" "M2 call sign payload" 'const callsign = safeCode'
check_file "$site_dir/assets/module-2-submission.js" "M2 reserved call sign key" 'enteredCallsignKey \|\| localStorage\.getItem'
check_file "$site_dir/module-2.html" "M2 receipt key recovery" 'name="callsign_key"'
if grep -q 'learner_code\|name="learner_code"\|รหัสผู้เรียน' "$site_dir/module-2.html" "$site_dir/assets/module-2-submission.js"; then
  printf 'Module 2 submission must use a call sign instead of a learner identity field.\n'
  failed=1
fi
check_file "$site_dir/assets/module-2-submission.js" "M2 dedicated server endpoint" 'submissionEndpoint = "/api/ai-for-research/module-2/submissions"'
check_file "$site_dir/assets/module-2-submission.js" "M2 fixed event type" 'ai_for_research_module_2_submission'
check_file "$site_dir/module-2.html" "M2 module evaluation" 'ประเมินการใช้ AI และ Module นี้'
check_file "$site_dir/module-2.html" "M2 token source" 'name="token_source"'
check_file "$site_dir/module-2.html" "M2 difficulty rating" 'name="difficulty_rating"'
check_file "$site_dir/module-2.html" "M2 usefulness rating" 'name="usefulness_rating"'
check_file "$site_dir/assets/module-2-submission.js" "M2 class switch status" 'requireOpenClass'
check_file "$site_dir/assets/module-2-submission.js" "M2 module evaluation payload" 'module_evaluation: buildModuleEvaluation\(\)'
check_file "$site_dir/assets/module-2-submission.js" "M2 hash check" 'crypto\.subtle\.digest\("SHA-256"'
check_file "$site_dir/assets/module-2-submission.js" "M2 progress-only envelope" 'progress: buildProgressSummary\(payload\)'
check_file "$site_dir/module-2.html" "M2 full work remains local" 'ไม่เก็บ Markdown, claims, คำตอบ หรือรายการหลักฐาน'
check_file "$site_dir/assets/module-2-submission.js" "M2 deterministic result" 'machine_check: buildMachineCheck\(payload\)'
if grep -q 'markdown_content' "$site_dir/downloads/module-02-submission-schema.json" "$site_dir/assets/module-2-submission.js"; then
  printf 'Module 2 JSON must not upload full Markdown content.\n'
  failed=1
fi
node --check "$site_dir/assets/module-2-submission.js"
node "$site_dir/scripts/test-module-2-submission.js"
python3 - "$site_dir/downloads/module-02-submission-schema.json" <<'PYSCHEMA'
import json, sys
from pathlib import Path

schema = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
assert schema["properties"]["schema_version"]["const"] == "ai-for-research.module-2-submission.v4"
assert schema["properties"]["module_id"]["const"] == "module-2"
assert schema["properties"]["artifact"]["properties"]["filename"]["const"] == "module-2-conclusion.md"
assert schema["properties"]["result"]["properties"]["claims"]["minItems"] == 8
assert schema["properties"]["result"]["properties"]["open_questions"]["minItems"] == 1
assert schema["properties"]["result"]["properties"]["learner_additions"]["minItems"] == 1
PYSCHEMA
python3 - "$site_dir/downloads/module-02-submission-example.json" <<'PYEXAMPLE'
import json, sys
from pathlib import Path

example = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert example["schema_version"] == "ai-for-research.module-2-submission.v4"
assert len(example["result"]["claims"]) == 8
assert len(example["result"]["open_questions"]) >= 1
assert len(example["result"]["learner_additions"]) == len(example["result"]["open_questions"])
assert example["declaration"]["learner_additions_written_by_learner"] is True
assert {claim["level"] for claim in example["result"]["claims"]} == {"L1", "L2", "L3", "L4"}
PYEXAMPLE
python3 - "$site_dir/downloads/validate-module-2.py" "$site_dir/downloads/module-02-submission-example.json" <<'PYVALIDATOR'
import hashlib, json, subprocess, sys, tempfile
from pathlib import Path

validator = Path(sys.argv[1])
example = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
with tempfile.TemporaryDirectory(prefix="module2-validator-test-") as folder:
    root = Path(folder)
    markdown = root / "module-2-conclusion.md"
    submission = root / "module-2-submission.json"
    markdown.write_text("# Module 2\n\n" + ("ข้อความที่ผู้เรียนตรวจแล้วและอ้างกลับไปยังหลักฐานได้ " * 12), encoding="utf-8")
    example["artifact"]["sha256"] = hashlib.sha256(markdown.read_bytes()).hexdigest()
    submission.write_text(json.dumps(example, ensure_ascii=False), encoding="utf-8")
    passed = subprocess.run([sys.executable, str(validator), str(submission), str(markdown)], capture_output=True, text=True)
    assert passed.returncode == 0, passed.stderr
    assert "LOCAL_CHECK PASS" in passed.stdout
    example["result"]["learner_additions"] = []
    submission.write_text(json.dumps(example, ensure_ascii=False), encoding="utf-8")
    failed = subprocess.run([sys.executable, str(validator), str(submission), str(markdown)], capture_output=True, text=True)
    assert failed.returncode == 1
    assert "LOCAL_CHECK FAIL" in failed.stderr
PYVALIDATOR
check_file "$site_dir/module-2-food-case.html" "fictional source label" 'ข้อมูล ชื่อ และรีวิวทั้งหมดสร้างขึ้นเพื่อการสอน'
check_file "$site_dir/module-2-food-case.html" "bilingual evidence" 'English review'
check_file "$site_dir/module-2-food-case.html" "source date" 'แก้ไขล่าสุดเมื่อ 6 กันยายน 2569'
for evidence in 01-lunch-brief-th.pdf 02-menu-observations.xlsx 03-omelette-recipe-bilingual.docx 04-lunch-tray.png 05-canteen-reviews.html 06-web-source.txt README.md; do
  [[ -s "$site_dir/downloads/module-02-food-evidence/$evidence" ]] || {
    printf 'Missing or empty Module 2 evidence file: %s\n' "$evidence"
    failed=1
  }
done
python3 - "$site_dir/downloads/module-02-food-evidence" <<'PYTEST'
import struct, sys, zipfile
from pathlib import Path

root = Path(sys.argv[1])
for name in ("02-menu-observations.xlsx", "03-omelette-recipe-bilingual.docx"):
    with zipfile.ZipFile(root / name) as archive:
        assert archive.testzip() is None, name
png = (root / "04-lunch-tray.png").read_bytes()
assert png[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", png[16:24]) == (1200, 900)
pdf = (root / "01-lunch-brief-th.pdf").read_bytes()
assert pdf.startswith(b"%PDF-")
bundle = root.parent / "module-02-food-evidence.zip"
with zipfile.ZipFile(bundle) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {
        "README.md", "01-lunch-brief-th.pdf", "02-menu-observations.xlsx",
        "03-omelette-recipe-bilingual.docx", "04-lunch-tray.png",
        "05-canteen-reviews.html", "06-web-source.txt",
    }
PYTEST
for stage in {1..7}; do
  check_file "$site_dir/module-7.html" "M7 Thai stage $stage" "ช่วง $stage —"
done
if grep -Eqi 'Hypothesis Clinic|Data Intake and Quality Gate|DataFrame-to-Visual Bridge' "$site_dir/module-7.html"; then
  printf 'Found unnecessary English activity headings in module-7.html.\n'
  failed=1
fi
check_file "$site_dir/module-8.html" "M8 ready mock case" 'downloads/module-08-mock-publication-case\.md'
check_file "$site_dir/module-8.html" "M8 publication demo" 'module-8-publication-demo\.html'
check_file "$site_dir/assets/publication-demo.js" "M8 structured abstract" 'class="abstract"'
check_file "$site_dir/assets/publication-demo.js" "M8 body-only columns" 'class="paper-body"'
check_file "$site_dir/assets/publication-demo.css" "M8 visible overflow" 'overflow:visible'
check_file "$site_dir/module-9.html" "M9 ready mock case" 'downloads/module-09-mock-workflow-case\.md'
check_file "$site_dir/downloads/module-08-mock-publication-case.md" "M8 mock content" 'กรณีตัวอย่างโมดูล 8'
check_file "$site_dir/downloads/module-09-mock-workflow-case.md" "M9 mock content" 'กรณีตัวอย่างโมดูล 9'
check_file "$site_dir/module-7-thailand-population-lab.html" "official population data" 'catalog\.nso\.go\.th'
check_file "$site_dir/module-7-thailand-population-lab.html" "survey statistics" 'ตารางไขว้'
check_file "$site_dir/module-7-thailand-population-lab.html" "map activity" 'Map: สัดส่วนหญิงรายจังหวัด'
check_file "$site_dir/module-7-thailand-population-lab.html" "CKAN API" 'datastore_search.*offset=10000'
check_file "$site_dir/module-7-thailand-population-lab.html" "scatter plot" 'Scatter plot'
check_file "$site_dir/module-7-thailand-population-lab.html" "pairplot" 'Pairplot'
check_file "$site_dir/module-7-thailand-population-lab.html" "candlebar" 'Candlebar'
check_file "$site_dir/module-7-thailand-population-lab.html" "GeoJSON API" 'geoboundaries\.org/api/current/gbOpen/THA/ADM1'
check_file "$site_dir/module-7-thailand-population-lab.html" "data provenance" 'ข้อมูลประชากรมาจากไหน'
check_file "$site_dir/module-7-thailand-population-lab.html" "API ingestion" 'นำข้อมูลมาใช้อย่างไร'
check_file "$site_dir/module-7-thailand-population-lab.html" "chart tools" 'กราฟเรียกว่าอะไร และสร้างด้วยอะไร'
check_file "$site_dir/module-7-thailand-population-lab.html" "Seaborn tool" 'Seaborn และ Matplotlib'
check_file "$site_dir/module-7-thailand-population-lab.html" "Plotly tool" 'pandas และ Plotly'
check_file "$site_dir/module-7-thailand-population-lab.html" "map tool" 'GeoPandas และ Plotly'
check_file "$site_dir/module-7-thailand-population-lab.html" "summary table" 'ตารางสรุป'
check_file "$site_dir/module-7-thailand-population-lab.html" "bar chart" 'กราฟแท่ง'
check_file "$site_dir/module-7-thailand-population-lab.html" "line chart" 'กราฟเส้น'
check_file "$site_dir/module-7-thailand-population-lab.html" "pie chart" 'กราฟวงกลม'
check_file "$site_dir/module-7-thailand-population-lab.html" "basic charts prompt" 'ตารางและกราฟพื้นฐาน'
check_file "$site_dir/module-7-thailand-population-lab.html" "interactive checkpoint" 'data-checklist="module-7-thailand-population"'
check_file "$site_dir/assets/app.js" "dynamic checkpoint" 'checklist\.dataset\.checklist = `module-\$\{guidedModuleNumber\}`'
check_file "$site_dir/register.html" "group registration page" 'หนึ่งกลุ่ม'
check_file "$site_dir/register.html" "no false submission" 'ยังไม่รับชำระเงินและยังไม่ส่งข้อมูลออกจากเว็บไซต์'
check_file "$site_dir/register.html" "meal planning" 'ข้อจำกัดอาหาร'
check_file "$site_dir/assets/registration.js" "local registration draft" 'ai-for-research-registration-draft\.txt'
check_file "$site_dir/assets/site-shell.js" "registration navigation" 'สมัครเป็นกลุ่ม'
check_file "$site_dir/assets/site-shell.js" "production base URL" 'https://urban\.cpe\.ku\.ac\.th/ai-for-research/'
check_file "$site_dir/assets/course-cart.js" "three-course bundle" 'BUNDLE_TOTAL=8900'
check_file "$site_dir/index.html" "no-sale project status" 'ยังไม่เปิดรับสมัครและยังไม่รับชำระเงิน'
if grep -Eq '[0-9],[0-9]{3} บาท|data-course-card|data-select-course' "$site_dir/index.html"; then
  printf 'Found course pricing/cart markup on index.html. The homepage must not sell before the project is approved — keep pricing in documents/public-site-drafts/index-with-pricing.html instead.\n'
  failed=1
fi
check_file "$site_dir/checkout.html" "checkout identity fields" 'ชื่อ–นามสกุล'
check_file "$site_dir/assets/checkout.js" "KU email discount" 'ku\\.th|ku\\.ac\\.th'
check_file "$site_dir/checkout.html" "email code delivery purpose" 'รหัสยืนยันการสมัคร รหัสเข้าเรียน และรหัสใช้ครั้งเดียว'
if grep -q 'ช่วงบรรยาย' "$site_dir/module-5.html"; then
  printf 'Found instructor-facing lecture language in module-5.html.\n'
  failed=1
fi

if grep -EIn 'id="time"|class="module-time"|class="course-duration"|เวลาที่แนะนำ|ระยะเวลาโดยประมาณ|Self-paced lesson|Recommended [0-9]|Module [0-9]+ · .*([0-9]+ (minutes|hours|นาที|ชั่วโมง)|ประมาณ)' \
  "$site_dir"/*.html; then
  printf 'Found planning-time content in public HTML. Keep it in module Markdown only.\n'
  failed=1
fi

for number in {1..9}; do
  shopt -s nullglob
  sources=("$module_source_dir/module-0$number-"*.md)
  shopt -u nullglob
  if (( ${#sources[@]} != 1 )); then
    printf 'Expected one Markdown source for Module %s, found %s.\n' "$number" "${#sources[@]}"
    failed=1
    continue
  fi
  check_file "${sources[0]}" "Markdown time" '\*\*(เวลาแกนโมดูล|เวลาที่แนะนำ):\*\*'
done

if grep -Ein 'TODO|FIXME|DEV[-_ ]ONLY|INTERNAL[-_ ]NOTE|workflow message' \
  "$site_dir"/index.html "$site_dir"/prepare.html "$site_dir"/module-{2..9}.html; then
  printf 'Found an internal development marker in learner-facing content.\n'
  failed=1
fi

if (( failed )); then
  exit 1
fi
printf 'Learner-content checks passed for Modules 1–9.\n'
