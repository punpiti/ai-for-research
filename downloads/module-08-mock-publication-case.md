# เคสฝึกสำหรับนิสิตและนักวิจัยมือใหม่ — โมดูล 8: จาก journal dossier สู่รายงาน LaTeX

เคสนี้ใช้ข้อมูลและวรรณกรรมสมมติเพื่อฝึก workflow ให้ครบตั้งแต่เลือกวารสาร วิเคราะห์ BibTeX ไปจนถึงสร้าง PDF ห้ามนำชื่อวารสาร ระเบียนอ้างอิง หรือข้อสรุปเรื่อง research gap ในชุดนี้ไปใช้เป็นหลักฐานในงานจริง

## โจทย์และข้อมูลที่ตรวจแล้ว

โรงอาหารมหาวิทยาลัยทดลองวัดผู้เข้าร่วม 30 คนก่อนและหลังมื้อกลางวัน คำถามคือ “คะแนนความอิ่มหลังอาหารสูงกว่าคะแนนความหิวก่อนอาหารหรือไม่”

| ตัวแปร | จำนวน | ค่าเฉลี่ย | ส่วนเบี่ยงเบนมาตรฐาน |
|---|---:|---:|---:|
| ความหิวก่อนอาหาร | 30 | 7.2 | 1.4 |
| ความอิ่มหลังอาหาร | 30 | 8.1 | 1.1 |

ข้อมูลมีเฉพาะค่าสรุป ไม่มีข้อมูลรายบุคคล ไม่มีกลุ่มเปรียบเทียบ และยังทดสอบความแตกต่างหรือเหตุและผลไม่ได้ รายงานจึงอธิบายได้เพียงความต่างของค่าเฉลี่ยในเคสสมมติ

## แฟ้มของเคส

- `module-08-mock-journal-a-profile.md` — วารสารจำลอง A เน้นการประเมินบริการอาหารในสถานศึกษา
- `module-08-mock-journal-b-profile.md` — วารสารจำลอง B เน้นวิธีวิเคราะห์ข้อมูลสุขภาวะนักศึกษา
- `module-08-mock-references.bib` — ระเบียนจำลองพร้อม abstract สำหรับฝึก literature map
- `module-08-mock-report.tex` — ต้นฉบับ LaTeX ที่สร้าง PDF ได้และเรียก BibTeX

## งานรอบแรก: Journal A

1. อ่าน profile A แล้วสร้าง `journal-dossiers/mock-journal-a/journal-dossier.md`
2. ตรวจ `module-08-mock-references.bib` และทำ `bibliography-audit.md`
3. สกัด problem/outcome, population/context, method/design, finding และ limitation จาก abstract
4. สร้าง `literature-map.md` และ `candidate-gap.md` โดยติดป้ายว่าเป็นข้อสังเกตภายใน mock corpus
5. เปรียบเทียบ candidate gap กับข้อมูลที่มี แล้วตัดสิ่งที่ข้อมูลตอบไม่ได้
6. ใช้ Markdown เป็น source of truth แล้วให้ AI สร้าง LaTeX/PDF ให้ตรง profile A โดยรักษาตัวเลขและข้อจำกัดเดิม
7. ตรวจ log, citation, ตาราง และข้อความทุกหน้า
8. สร้าง `submission-readiness.md` แยก PASS, FAIL และ BLOCKED

## คำสั่งให้ AI ทำรายงานฉบับแรก

> ทำ Module 8 mock case นี้ใน workspace ให้ครบ เริ่มจากอ่าน journal profile, BibTeX, LaTeX starter และข้อมูลในไฟล์นี้ สร้าง journal dossier พร้อมหลักฐานจาก profile วิเคราะห์ BibTeX จาก abstract เป็น literature map และ candidate gaps โดยห้ามอ้าง novelty จาก mock corpus สร้าง `source/manuscript.md` เป็นเนื้อหาหลัก แล้ว generate LaTeX ใน `generated/` และ compile ด้วย XeLaTeX + BibTeX ตรวจ log และ PDF จริง สร้าง submission-readiness report แยก PASS/FAIL/BLOCKED ห้ามแก้ตัวเลข แต่งสถิติ เพิ่มกลไก หรือรับรองความพร้อมส่งแทนฉัน

## งานรอบสอง: เปลี่ยนเป็น Journal B

เก็บแฟ้ม Journal A ไว้ทั้งหมด แล้วสร้าง dossier และ working copy ใหม่สำหรับ Journal B ทำ `venue-change-impact.md` เปรียบเทียบ scope, audience, structure, abstract length, citation style, anonymity, declarations และ submission files ปรับการนำเสนอเท่าที่ข้อกำหนดรองรับ ห้ามเปลี่ยนข้อมูล วิธี ผล หรือข้อจำกัด

## คำสั่งเปลี่ยนวารสาร

> เปลี่ยนเป้าหมายจาก Mock Journal A เป็น Mock Journal B โดยไม่เขียนทับ dossier, generated LaTeX, PDF หรือ readiness report เดิม อ่าน profile B แล้วสร้าง dossier ใหม่ ทำ venue-change-impact เทียบทีละข้อ ประเมิน fit ใหม่ และ generate working copy/PDF สำหรับ Journal B จาก Markdown source เดิม ปรับ title, abstract, keywords, section order, template metadata และ submission package ได้ ห้ามเปลี่ยนข้อมูล วิธี ผล หรือข้อจำกัดเพื่อให้ดู fit หากข้อกำหนดใหม่ต้องการหลักฐานที่ไม่มี ให้ติด BLOCKED และบอกว่าต้องเก็บอะไรเพิ่ม

## เกณฑ์ผ่าน

- dossier ของวารสารทั้งสองแยกกันและมีหลักฐานทุกข้อ
- BibTeX audit ระบุชัดว่าระเบียนและ abstract เป็นข้อมูลจำลอง
- candidate gap มี citation keys, counterevidence และ search-needed status
- Markdown เป็น source of truth และ generated `.tex` ไม่ถูกใช้เป็นต้นฉบับคู่ขนาน
- PDF ทั้งสองเปิดได้ citation ไม่เป็น `?` และตัวเลขตรงกับเคส
- venue-change-impact แสดงสิ่งที่เปลี่ยนกับสิ่งที่ต้องคงเดิม
- readiness report ไม่เปลี่ยน BLOCKED เป็น PASS โดยไม่มีหลักฐาน
