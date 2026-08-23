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
