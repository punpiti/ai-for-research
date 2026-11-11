# Module 8 — Journal-first LaTeX Report

ชุดนี้ใช้ข้อมูลจำลอง PM2.5 ชุดเดียวกับ Module 7 จำนวน 480 แถว ผู้เรียนใช้ผลวิเคราะห์และกราฟจาก Module 7 ต่อได้ หรือเริ่ม Module 8 โดยใช้ summary และกราฟตัวอย่างในชุดนี้

## โครงสร้างที่ติดตั้ง

```text
course-materials/module-08/     # ต้นฉบับจากรายวิชา ห้ามแก้
module-08-work/                 # พื้นที่ทำงานของผู้เรียน
├── README-FIRST.md             # ลำดับงานและแผนที่โฟลเดอร์
├── input/                      # ข้อมูล ผลวิเคราะห์ และกราฟตั้งต้น
├── journal-dossiers/           # ข้อกำหนดวารสาร A/B แยกกัน
├── literature/                 # BibTeX, audit, literature map, candidate gap
├── source/                     # Markdown source of truth
├── figures/                    # รูปที่อนุมัติให้ใช้ในรายงาน
├── generated/                  # LaTeX ที่สร้างใหม่ได้
├── build/                      # PDF และ build log
└── submission/                 # readiness report และชุดไฟล์ส่ง
```

ไฟล์ใต้ `course-materials/` ใช้สำหรับอ่านหรือคัดลอกเท่านั้น ตัวติดตั้งจะรักษาไฟล์ที่ผู้เรียนแก้ไว้ และวางรุ่นใหม่ใต้ `.course-updates/` เมื่อ checksum ไม่ตรง

## จุดเชื่อม Module 7 → Module 8

- ข้อมูลทั้งสองโมดูลมี SHA-256 เดียวกัน
- ถ้ามี `module-07-work/module-07-highlights.md` ตัวติดตั้งจะคัดลอกไปที่ `module-08-work/input/module-07-highlights.md`
- ถ้ามีกราฟใน `module-07-work/figures/` ตัวติดตั้งจะคัดลอกกราฟไปที่ `module-08-work/input/module-07-figures/`
- ถ้าเริ่ม Module 8 โดยตรง ตัวติดตั้งจะใช้ `module-07-highlights-example.md` และ `pm25-before-after.png` เป็นข้อมูลตั้งต้น

ผู้เรียนแก้ `module-08-work/source/manuscript.md` เป็นหลัก แล้วให้ AI สร้าง `generated/main.tex` และ `build/manuscript.pdf` ใหม่
