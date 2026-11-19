# เปเปอร์จริงที่ถูกถอน (retracted) — เลือกหนึ่งเรื่องมาทดลอง

`AIRR init module-4` วาง PDF ของทั้งห้าเรื่องไว้ให้แล้วที่ `module-04-work/retracted/<รหัส>/paper.pdf` (สำเนาที่ผู้สอนเก็บไว้ เผื่อวารสารเอาออก) ทุกเรื่องเป็น open access และมีประกาศถอนบทความ (retraction notice) ที่บอกว่าปัญหาอยู่ที่ reference ข้อไหน

ประกาศนั้นคือ **เฉลย** อยู่ที่ `module-04-work/retracted/<รหัส>/answer/retraction-notice.md` — **อย่าเปิดจนถึงขั้นที่ 7**

เป้าหมายคือฝึกวิธีตรวจ ไม่ใช่ตัดสินผู้เขียน ห้ามนำบทความเหล่านี้ไปอ้างอิงเป็นหลักฐานทางวิชาการ

| รหัส | เรื่อง (วารสาร ปี) | จำนวน ref | ฝึกอะไรได้ดี | ต้นฉบับออนไลน์ |
|---|---|---:|---|---|
| A | Country-level indices in predictive models of helminth infections: Perspectives from Southeast Asia (PLOS Negl Trop Dis 2025) | 16 | ref ที่ไม่มีจริง · สั้น เหมาะเริ่มต้น | https://doi.org/10.1371/journal.pntd.0013330 |
| B | Leading evidence-based practice: nurse managers' strategies for knowledge utilisation in acute care settings (BMC Nursing 2025) | 54 | ref ที่ไม่มีจริง + ref ผิด + ref ซ้ำ | https://doi.org/10.1186/s12912-025-02912-5 |
| C | Wasp venom peptide improves the proapoptotic activity of alendronate sodium in A549 lung cancer cells (PLOS ONE 2022) | 59 | อ้างงานที่ถูกถอน + ข้อความที่ ref ไม่รองรับ | https://doi.org/10.1371/journal.pone.0264093 |
| D | Research on risk identification of manufacturing enterprises' Internet strategic transformation (PLOS ONE 2024) | 30 | ref ที่ไม่เกี่ยวกับบริบท (cite มั่ว) | https://doi.org/10.1371/journal.pone.0299857 |
| E | The application and challenges of ChatGPT in educational transformation: New demands for teachers' roles (Heliyon 2024) | 73 | ref ที่ไม่เกี่ยวกับบทความ | https://doi.org/10.1016/j.heliyon.2024.e24289 |

แนะนำ: ครั้งแรกใช้ **A** (สั้น เห็นผลเร็ว) · อยากฝึกตรวจว่า cite ถูกไหม ใช้ **C** หรือ **B**

## ที่เก็บไฟล์ของแต่ละเรื่อง (`module-04-work/retracted/<รหัส>/`)

| ไฟล์ | มาจาก | คืออะไร |
|---|---|---|
| `paper.pdf` | init | เปเปอร์ที่ถูกถอน (ห้ามแก้) |
| `answer/retraction-notice.md` | init | เฉลย — เปิดในขั้นที่ 7 เท่านั้น |
| `paper.md` | ขั้นที่ 1 | ข้อความที่แกะจาก PDF |
| `refs.bib` | ขั้นที่ 1 | BibTeX ของทุก ref พร้อม abstract จาก OpenAlex |
| `existence-check.md` | ขั้นที่ 1 | ref ไหนหาเจอ ไหนหาไม่เจอ ไหนถูกถอน |
| `relevance-check.md` | ขั้นที่ 2 | ref เกี่ยวกับประโยคที่อ้างไหม (ดูจาก abstract) |
| `cited/ref-NN.pdf` | ขั้นที่ 3–4 | PDF ของงานที่ถูกอ้าง |
| `download-log.md` | ขั้นที่ 3 | ผลดาวน์โหลดอัตโนมัติ |
| `manual-download.md` | ขั้นที่ 4 | รายการที่ต้องดาวน์โหลดเอง |
| `cited-md/ref-NN.md` | ขั้นที่ 5 | ข้อความที่แกะจาก PDF ใน `cited/` |
| `citation-check.md` | ขั้นที่ 6 | ข้อความที่อ้างตรงกับต้นฉบับไหม |
| `compare-notice.md` | ขั้นที่ 7 | ผลของคุณเทียบกับเฉลย |
