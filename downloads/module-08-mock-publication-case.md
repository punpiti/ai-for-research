# เคสฝึกสำหรับนิสิตและนักวิจัยมือใหม่ — โมดูล 8

## จากกราฟ Module 7 สู่รายงาน LaTeX

เคสนี้ใช้ข้อมูลจำลอง PM2.5 ชุดเดียวกับ Module 7 จำนวน 480 แถว ครอบคลุม North, Central และ South, กลุ่ม intervention/comparison, ช่วง before/after, 16 สัปดาห์ และ 5 sensors ต่อ site-arm-week

ผู้เรียนไม่ต้องดาวน์โหลดไฟล์ทีละรายการ ใช้คำสั่งติดตั้งบนหน้า Module 8 เพื่อรับข้อมูล summary, figure, journal profiles, BibTeX และ Markdown starter ผ่าน manifest ของ AIRR พร้อม checksum

## ทางเข้าสองแบบ

### เรียนต่อจาก Module 7

ตัวติดตั้งคัดลอก `module-07-work/module-07-highlights.md` และกราฟของผู้เรียนไปที่ `module-08-work/input/` โดยไม่เขียนทับไฟล์เดิม จากนั้นผู้เรียนใช้ผลที่ตนเองตรวจแล้วเขียนรายงาน

### เริ่มที่ Module 8

ตัวติดตั้งให้ `module-07-highlights-example.md`, `analysis-summary.csv` และ `pm25-before-after.png` ซึ่งคำนวณจากข้อมูล 480 แถวเดียวกัน ผู้เรียนจึงเริ่มจากงานเขียนและ publication workflow ได้ทันที

## ขอบเขตหลักฐาน

- Intervention overall mean: 37.02 → 34.36 µg/m³
- Comparison overall mean: 37.64 → 38.32 µg/m³
- North intervention: 44.42 → 35.50 µg/m³
- Central intervention: 37.41 → 33.01 µg/m³
- South intervention: 29.22 → 34.56 µg/m³
- ไม่มีรายละเอียดการสุ่ม การมอบหมายมาตรการ ตัวแปรกวน calibration record หรือแบบจำลอง uncertainty

รายงานจึงอธิบาย descriptive contrasts และ heterogeneity ตามพื้นที่ได้ แต่ห้ามสรุปว่ามาตรการเป็นสาเหตุของการเปลี่ยน PM2.5

## งานรอบที่ 1 — Journal A

1. อ่าน `module-08-work/README-FIRST.md`
2. ประเมิน scope, audience และ evidence fit ของ Journal A
3. ตรวจ `literature/references.bib` และสร้าง bibliography audit, literature map และ candidate gap
4. แก้ `source/manuscript.md` ให้เป็นรายงานจากข้อมูล PM2.5
5. ให้ AI สร้าง `generated/main.tex` และ `build/manuscript.pdf`
6. กรอก `submission/submission-readiness.md` เป็น PASS/FAIL/BLOCKED พร้อมหลักฐาน

## งานรอบที่ 2 — เปลี่ยนเป็น Journal B

1. อ่าน dossier ของ Journal B โดยไม่เขียนทับ Journal A
2. กรอก `submission/venue-change-impact.md`
3. ปรับ title, abstract, section structure, citation style และ submission package ตามข้อกำหนดใหม่
4. คงข้อมูล วิธี ผล ตัวเลข และข้อจำกัดเดิม
5. สร้าง LaTeX/PDF และ readiness report แยกจากรอบ Journal A

## Prompt ตั้งต้น

```text
เปิด module-08-work/README-FIRST.md แล้วตรวจโครงสร้าง workspace ก่อน ใช้ไฟล์ใน input/ เป็นหลักฐานตั้งต้น ใช้ literature/references.bib เป็น citation corpus และใช้ journal-dossiers/journal-a/original/profile.md เป็นข้อกำหนดรอบแรก

ช่วยฉันทำ journal dossier และ fit decision ก่อน จากนั้นตรวจ BibTeX พร้อม abstract สร้าง literature map และ candidate research gap ที่ยังไม่อ้างว่าเป็น novelty เมื่อฉันอนุมัติแล้ว ให้ช่วยเขียนรายงานที่ source/manuscript.md โดยใช้เฉพาะตัวเลขและข้อจำกัดจาก input/ ให้ไฟล์ Markdown นี้เป็น source of truth สร้าง generated/main.tex และ build/manuscript.pdf ใหม่ ห้ามแก้ Markdown กับ LaTeX เป็นสองต้นฉบับคู่กัน ปิดท้ายด้วย submission/submission-readiness.md ที่แยก PASS/FAIL/BLOCKED พร้อมหลักฐาน
```

## เกณฑ์ผ่าน

- อธิบายหน้าที่ของแต่ละโฟลเดอร์ได้
- ตัวเลขในข้อความ ตาราง และรูปตรงกับ input
- กล่าวถึง South heterogeneity และไม่ใช้ภาษาเชิงเหตุ
- citation keys ทุกตัวมีใน BibTeX
- Markdown เป็น source of truth เพียงชุดเดียว
- PDF และ log ได้รับการตรวจจริง
- การเปลี่ยนวารสารไม่เปลี่ยนข้อมูล วิธี ผล หรือข้อจำกัด
