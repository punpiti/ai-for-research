#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
page="$root/classroom.html"

grep -q 'data-classroom-id="faculty-pilot-2569"' "$page"
grep -q 'เปิดรับลงทะเบียน' "$page"
grep -q 'การลงทะเบียน' "$page"
grep -q '20 พฤศจิกายน 2569' "$page"
grep -q 'สำหรับอาจารย์/นักวิจัย 2569' "$page"
grep -q 'อาจารย์และนักวิจัย' "$page"
grep -q 'รุ่นนี้ยังไม่เปิดรับนิสิต' "$page"
grep -q 'ตรวจสิทธิ์ก่อนเข้าร่วม' "$page"
grep -q 'Non-coding Data Analytics &amp; Visualization' "$page"
grep -q 'Machine Learning เมื่อสอดคล้องกับคำถามวิจัย' "$page"
grep -q 'Manuscript Preparation' "$page"
grep -q 'ทุกกิจกรรมทำได้โดยไม่ต้องเขียนโปรแกรม' "$page"
grep -q 'AI ช่วยสร้าง Markdown, JSON และ LaTeX พร้อมเขียนและรัน Python' "$page"
grep -q 'เก็บเนื้อหาใน Markdown' "$page"
grep -q 'id="syllabus"' "$page"
grep -q '<dt>ค่าใช้จ่าย</dt><dd data-public-fee>ไม่มีค่าใช้จ่าย</dd>' "$page"
[[ "$(grep -c '<li><span>0[1-9]</span>' "$page")" -eq 9 ]]
grep -q 'พัฒนาโจทย์และคำถามวิจัย' "$page"
grep -q 'Manuscript Preparation' "$page"
if sed 's/faculty-pilot-2569//g' "$page" | grep -Eqi 'M01|M09|workflow|paywall|pilot|รุ่นทดลอง'; then
  echo 'Classroom copy must not expose internal module, workflow, paywall, or pilot language.' >&2
  exit 1
fi
grep -q 'classroom.html' "$root/index.html"
grep -q 'class="section open-classrooms" id="course"' "$root/index.html"
grep -q 'target?.scrollIntoView' "$root/assets/site-shell.js"
grep -q 'พัฒนาโจทย์ ช่องว่าง วัตถุประสงค์ และคำถามวิจัย' "$root/index.html"
grep -q 'ประเมิน privacy, citation, ethics' "$root/index.html"
grep -q 'เมื่อจบคลาส ผู้เรียนสามารถ' "$root/index.html"
grep -q 'เพิ่มทั้งกำลังการผลิตและคุณภาพของงานวิจัย' "$root/index.html"
grep -q 'อาจารย์/นักวิจัย · 20 พฤศจิกายน 2569' "$root/index.html"
grep -q 'AI for Research สำหรับอาจารย์/นักวิจัย 2569' "$root/index.html"
grep -q 'ไม่มีค่าใช้จ่าย' "$root/index.html"
grep -q 'ดูรายละเอียดและลงทะเบียน' "$root/index.html"
grep -q 'Data Analytics' "$root/index.html"
grep -q 'Data Visualization' "$root/index.html"
grep -q 'Machine Learning' "$root/index.html"
grep -q 'Manuscript Preparation' "$root/index.html"
grep -q 'Markdown' "$root/index.html"
grep -q 'JSON' "$root/index.html"
grep -q 'Python' "$root/index.html"
grep -q 'LaTeX' "$root/index.html"
grep -q 'ทุกกิจกรรมทำได้โดยไม่ต้องเขียนโปรแกรม' "$root/index.html"
if sed 's/faculty-pilot-2569//g' "$root/index.html" | grep -Eqi 'M01–M09|workflow|paywall|pilot|รุ่นทดลอง'; then
  echo 'Homepage class copy must not expose internal module, workflow, paywall, or pilot language.' >&2
  exit 1
fi
[[ "$(grep -c 'classroom-feature-grid' "$root/classroom.html")" -eq 1 ]]
[[ "$(grep -c '<article><span>0[1-6]</span><h3>' "$root/classroom.html")" -eq 6 ]]
grep -q 'เมื่อจบคลาส' "$root/classroom.html"
grep -q 'เวลาที่ลงไป' "$root/classroom.html"
grep -q 'id="prepare"' "$root/classroom.html"
grep -q 'โน้ตบุ๊กส่วนตัวพร้อมที่ชาร์จ' "$root/classroom.html"
grep -q 'พื้นที่ว่างอย่างน้อย 20 GB' "$root/classroom.html"
grep -q 'ไม่แนะนำ tablet, iPad หรือ Chromebook เป็นเครื่องหลัก' "$root/classroom.html"
grep -q 'กรณีศึกษาและข้อมูลสำรองของคลาส' "$root/classroom.html"
grep -Fq '["prepare", "เตรียมตัว"]' "$root/assets/site-shell.js"
grep -q 'งานวิจัยของตนเองเดินหน้าต่อ' "$root/classroom.html"
grep -q 'ผลิตงานได้ต่อเนื่องขึ้น' "$root/classroom.html"
grep -q 'มีจุดตรวจคุณภาพก่อนเผยแพร่' "$root/classroom.html"
[[ "$(grep -c 'class="classroom-return-grid"' "$root/classroom.html")" -eq 1 ]]
[[ "$(grep -c 'class="open-classroom-card"' "$root/index.html")" -eq 1 ]]
if grep -Eq 'research-methodology-review|id="promise"|class="section course-family"|id="modules"|id="requirements"|class="section final-cta"' "$root/index.html"; then
  echo 'Homepage must contain classroom discovery only; detailed course-family sections belong in the private archive.' >&2
  exit 1
fi
grep -q 'const apiBase = "/api/ai-for-research/classrooms"' "$root/assets/classroom.js"
grep -q '/public`' "$root/assets/classroom.js"
grep -q 'data-public-summary' "$root/classroom.html"
grep -q 'data-public-syllabus' "$root/classroom.html"
grep -q '\${apiBase}/me' "$root/assets/classroom.js"
grep -q 'payment: "not-required"' "$root/assets/classroom.js"
grep -q 'เข้าสู่ระบบเพื่อลงทะเบียน' "$root/assets/classroom.js"
grep -q 'ลงทะเบียนคลาสนี้' "$root/assets/classroom.js"
grep -q 'ลงทะเบียนแล้ว' "$root/assets/classroom.js"
grep -q 'membershipFor(state, classroomId)' "$root/assets/classroom.js"
grep -q 'membership?.status === "active"' "$root/assets/site-shell.js"
grep -q 'cta.textContent = current === "classroom" ? "ลงทะเบียนแล้ว" : "ห้องเรียนของฉัน"' "$root/assets/site-shell.js"
grep -q 'cta.textContent = "รออนุมัติ"' "$root/assets/site-shell.js"
grep -q 'cta.textContent = "หน้าของอาจารย์"' "$root/assets/site-shell.js"
grep -q 'globalObject.location.assign(`admin/?id=' "$root/assets/classroom.js"
node "$root/scripts/test-classroom.js"
echo 'Classroom public-detail and enrollment checks passed.'
