#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
page="$root/admin/index.html"

grep -q 'data-classroom-selector' "$page"
grep -q 'data-open-create-class' "$page"
grep -q 'data-create-class-dialog' "$page"
grep -q 'data-source-classroom' "$page"
grep -q '01 · Enrollment' "$page"
grep -q 'ผู้ลงทะเบียนและ Token' "$page"
grep -q '02 · Syllabus' "$page"
grep -q 'โมดูลของคลาส' "$page"
grep -q '03 · Current status' "$page"
grep -q 'Submission ของ Active module' "$page"
grep -q 'data-enrollment-rows' "$page"
grep -q 'data-module-list' "$page"
grep -q 'data-submission-rows' "$page"
grep -q '/api/ai-for-research/classrooms' "$root/assets/instructor-admin.js"
grep -q 'source_classroom_id' "$root/assets/instructor-admin.js"
grep -q 'history.replaceState' "$root/assets/instructor-admin.js"
if grep -q '/admin/ai-for-research' "$page" "$root/assets/instructor-admin.js"; then
  echo 'Instructor classroom must not use the Urban admin route.' >&2
  exit 1
fi
node "$root/scripts/test-instructor-admin.js"
echo 'Instructor admin page checks passed.'
