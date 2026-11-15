#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
page="$root/admin/index.html"

grep -q 'data-classroom-selector' "$page"
grep -q 'data-open-create-class' "$page"
grep -q 'data-create-class-dialog' "$page"
grep -q 'data-source-classroom' "$page"
grep -q 'data-template-notice' "$page"
grep -q 'data-template-only' "$page"
grep -q 'data-template-summary' "$page"
grep -q 'รายละเอียดต้นแบบ' "$page"
grep -q 'ต้นแบบแก้ไขและรับลงทะเบียนไม่ได้' "$page"
grep -q 'data-class-only' "$page"
grep -q 'data-syllabus-actions' "$page"
grep -q 'data-class-details-form' "$page"
grep -q 'data-instructor-tabs' "$page"
[[ "$(grep -c 'data-admin-tab=' "$page")" -eq 7 ]]
[[ "$(grep -c 'data-admin-panel=' "$page")" -eq 7 ]]
grep -q 'data-class-config-form' "$page"
grep -q 'data-admin-only' "$page"
grep -q 'ตั้งค่าโครงสร้างคลาส' "$page"
grep -q 'Course ถูกกำหนดตอนสร้างคลาสและไม่เปลี่ยนภายหลัง' "$page"
grep -q 'หน้ารายละเอียดและลงทะเบียน' "$page"
grep -q 'name="enrollment_status"' "$page"
grep -q 'name="summary"' "$page"
grep -q '01 · Class details' "$page"
grep -q '02 · Enrollment' "$page"
grep -q 'ผู้สอน ผู้เรียน และงบ AI' "$page"
# Shared shell + console mode (no private header, no own logout button).
grep -q '<body class="console">' "$page"
grep -q '<body class="console">' "$root/admin/airr.html"
grep -q 'assets/site-shell.js?v=' "$page"
grep -q 'assets/console.css?v=' "$page"
grep -q 'assets/site-shell.js?v=' "$root/admin/airr.html"
grep -q 'assets/console.css?v=' "$root/admin/airr.html"
grep -q '<site-header current="console" root="../"' "$page"
grep -q 'public-class-link' "$page"
grep -q 'back-link' "$root/admin/airr.html"
grep -q 'current === "console"' "$root/assets/site-shell.js"
if grep -q 'data-logout\|instructor-header' "$page" "$root/admin/airr.html"; then
  echo 'Admin pages must use the shared site header (logout is in its user menu).' >&2
  exit 1
fi
if grep -q '^\.instructor-' "$root/assets/styles.css"; then
  echo 'Instructor console rules belong in assets/console.css, not styles.css.' >&2
  exit 1
fi
# Enrollment table: compact, filterable, expandable, no sideways scroll.
grep -q 'class="data-table enrollment-table"' "$page"
grep -q 'data-enrollment-search' "$page"
grep -q 'data-enrollment-role-filter' "$page"
grep -q 'data-enrollment-status-filter' "$page"
grep -q 'data-instructor-management-panel' "$page"
grep -q 'data-student-management-panel' "$page"
grep -q '<th class="col-budget num" scope="col">งบ AI (\$)</th>' "$page"
grep -q '<th class="col-name" scope="col">ชื่อ</th><th class="col-role" scope="col">บทบาท</th>' "$page"
grep -q 'data-summary-ta' "$page"
if grep -q 'Token quota\|ไม่จำกัด' "$page" "$root/assets/instructor-admin.js"; then
  echo 'AI budget replaces the token quota input; never show "unlimited".' >&2
  exit 1
fi
grep -q 'table-layout: fixed' "$root/assets/console.css"
grep -q 'body.console' "$root/assets/console.css"
grep -q 'setAttribute("aria-expanded"' "$root/assets/instructor-admin.js"
grep -q 'setAttribute("aria-controls", detailId)' "$root/assets/instructor-admin.js"
grep -q 'roleSelect.addEventListener("change", saveEnrollment)' "$root/assets/instructor-admin.js"
grep -q 'budgetInput.step = "0.5"' "$root/assets/instructor-admin.js"
grep -q 'budgetInput.value = String(budgetValue(item))' "$root/assets/instructor-admin.js"
grep -q 'item.given_name' "$root/assets/instructor-admin.js"
grep -q 'item.family_name' "$root/assets/instructor-admin.js"
grep -q '03 · Syllabus' "$page"
grep -q 'โมดูลของคลาส' "$page"
grep -q '04 · Live submissions' "$page"
grep -q '05 · Current status' "$page"
grep -q 'Submission ของ Active module' "$page"
grep -q 'ภาพรวมการส่งงาน' "$page"
grep -q 'data-submission-module-rows' "$page"
grep -q 'data-recent-submission-rows' "$page"
grep -q 'data-refresh-submissions' "$page"
grep -q 'อัตโนมัติทุก 15 วินาที' "$root/assets/instructor-admin.js"
grep -q 'renderSubmissionOverview' "$root/assets/instructor-admin.js"
grep -q 'submission-module-link' "$root/assets/instructor-admin.js"
grep -q 'moduleContentPath(module.module_id, classroomId)' "$root/assets/instructor-admin.js"
grep -q '/content/\${path}?classroom_id=' "$root/assets/instructor-admin.js"
grep -q 'data-enrollment-rows' "$page"
grep -q 'data-instructor-management-form' "$page"
grep -q 'data-instructor-email' "$page"
grep -q 'data-student-management-form' "$page"
grep -q 'data-student-emails' "$page"
grep -q 'เพิ่มผู้เรียนหลายคน' "$page"
grep -q 'data-instructor-add' "$page"
grep -q 'data-student-add' "$page"
grep -q '/instructors`' "$root/assets/instructor-admin.js"
grep -q '/students/bulk`' "$root/assets/instructor-admin.js"
grep -q 'parseBulkEmails' "$root/assets/instructor-admin.js"
grep -q 'const emails = parseBulkEmails' "$root/assets/instructor-admin.js"
grep -q 'method: "DELETE"' "$root/assets/instructor-admin.js"
grep -q 'statusSelect.addEventListener("change", saveEnrollment)' "$root/assets/instructor-admin.js"
grep -q 'budgetInput.addEventListener("input"' "$root/assets/instructor-admin.js"
grep -q 'setTimeout(saveEnrollment, 700)' "$root/assets/instructor-admin.js"
grep -q 'บันทึกอัตโนมัติ' "$root/assets/instructor-admin.js"
if grep -q 'const saveButton' "$root/assets/instructor-admin.js"; then
  echo 'Enrollment rows must auto-save without a save button.' >&2
  exit 1
fi
grep -q 'data-module-list' "$page"
grep -q 'name="content_route" value="student"' "$page"
grep -q 'name="content_route" value="faculty"' "$page"
grep -q 'หิว → กิน → อิ่ม' "$page"
grep -q '/content-route`' "$root/assets/instructor-admin.js"
grep -q 'module3_routes: \[currentContentRoute\]' "$root/assets/instructor-admin.js"
grep -q 'data-submission-rows' "$page"
grep -q '/api/ai-for-research/classrooms' "$root/assets/instructor-admin.js"
grep -q 'source_classroom_id' "$root/assets/instructor-admin.js"
grep -q 'history.replaceState' "$root/assets/instructor-admin.js"
grep -q 'คัดลอกเป็นคลาสใหม่' "$root/assets/instructor-admin.js"
grep -q 'classroom_type === "template"' "$root/assets/instructor-admin.js"
grep -q '/details`' "$root/assets/instructor-admin.js"
grep -q 'activateAdminTab' "$root/assets/instructor-admin.js"
grep -q 'renderTemplateDetails' "$root/assets/instructor-admin.js"
grep -q 'can_manage_class_config' "$root/assets/instructor-admin.js"
if grep -q 'can_manage_class_config.*can_manage_instructors' "$root/assets/instructor-admin.js"; then
  echo 'Classroom instructor management must not imply global admin UI.' >&2
  exit 1
fi
grep -q '/admin/config`' "$root/assets/instructor-admin.js"
if grep -q '/admin/ai-for-research' "$page" "$root/assets/instructor-admin.js"; then
  echo 'Instructor classroom must not use the Urban admin route.' >&2
  exit 1
fi
node "$root/scripts/test-instructor-admin.js"
echo 'Instructor admin page checks passed.'
