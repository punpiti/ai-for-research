# Module 8 Workbook — Journal-first LaTeX Research Report

## 1. Journal Dossier and Submission Format

| รายการ | คำตอบ |
|---|---|
| Venue และประเภทบทความ | |
| กลุ่มผู้อ่าน | |
| Official guideline URL | |
| วันที่เข้าถึงและรุ่น/ปี | |
| รูปแบบที่รับ: DOCX/LaTeX/PDF/อื่น | |
| Word หรือ LaTeX ที่เลือก และเหตุผล | |
| จำนวนหน้า/คำ | |
| โครงสร้างที่บังคับ | |
| Anonymous review | |
| Citation engine/style | |
| รูป ตาราง สมการ และ supplementary requirements | |
| Ethics/authorship/AI disclosure requirements | |
| ชื่อแฟ้มและ submission package | |

| เอกสารทางการที่ต้องเก็บ | URL/แฟ้ม | วันที่เข้าถึง | หลักฐาน/หัวข้อ | สถานะ confirmed/unclear/not found |
|---|---|---|---|---|
| Aims & Scope | | | | |
| Guide for Authors | | | | |
| Submission Guide/Checklist | | | | |
| Article type | | | | |
| Official LaTeX template/author kit | | | | |
| Peer review/anonymization | | | | |
| Ethics/authorship/AI disclosure | | | | |
| Data/code availability and supplementary files | | | | |
| Figures/tables/reporting guideline | | | | |
| Open access/APC/license/preprint | | | | |
| Cover letter/highlights/graphical abstract/reviewers | | | | |

### Fit Decision

| มิติ | fit/conditional/no fit | หลักฐานจากวารสาร | หลักฐาน/ข้อจำกัดของงาน | สิ่งที่ต้องตัดสิน |
|---|---|---|---|---|
| Scope | | | | |
| Audience | | | | |
| Evidence/article type | | | | |

## 2. Venue Package Manifest

| แฟ้ม | ชนิด/หน้าที่ | URL/แหล่งที่มา | วันที่ | checksum | Original ห้ามแก้? |
|---|---|---|---|---|---|
| | | | | | |

| รายการตรวจ | ผล |
|---|---|
| `venue-original/` แยกจาก `venue-working/` | |
| Master `.tex` หรือ Word template | |
| `.cls` | |
| `.sty` | |
| `.bst`/bibliography style | |
| ตัวอย่าง `.bib` | |
| Engine/build instruction | |
| Package หรือ script ที่ต้องอนุญาตเป็นพิเศษ | |

## 3. Build Gates

| Gate | การเปลี่ยนแปลงครั้งนี้ | ผล compile/export | Error/warning | PDF/เอกสารที่ตรวจ | ผ่าน/ไม่ผ่าน |
|---|---|---|---|---|---|
| 0 Venue verified | | | | | |
| 1 Pristine template | ไม่แก้ template | | | | |
| 2 Outline | placeholder เท่านั้น | | | | |
| 3 Section | เพิ่ม Markdown ทีละส่วน | | | | |
| 4 Citation | เพิ่ม `.bib`/citation | | | | |
| 5 Figure | เพิ่มรูปทีละรูป | | | | |
| 6 Table | เพิ่มตารางทีละตาราง | | | | |
| 7 Full venue build | ประกอบครบ | | | | |
| 8 Revision diff | เทียบ snapshot ก่อนและหลัง | | | | |
| 9 Final PDF QA | แก้หลังตรวจ | | | | |

## 4. Outline and Section Plan

| ลำดับ | Section ตาม venue | หน้าที่ | ข้อกล่าวอ้างหลัก | หลักฐาน/citation | รูป/ตาราง | Limit | Markdown file |
|---:|---|---|---|---|---|---|---|
| 1 | | | | | | | |

## 5. LaTeX Structure Map

| รายการ | แฟ้ม/ตำแหน่งที่พบ | หน้าที่ | แก้ได้หรือไม่ | ผู้รับผิดชอบตรวจ |
|---|---|---|---|---|
| Master `.tex` | | | | |
| `\documentclass` / `.cls` | | | | |
| `.sty` packages | | | | |
| content `\input` | | | | |
| bibliography `.bib` | | | | |
| `.bst`/citation style | | | | |
| figure/table paths | | | | |
| generated `.tex` | | | | |
| build/log output | | | | |

## 5.1 Insight-to-Paragraph Contract

| รายการ | คำตอบ |
|---|---|
| Section/purpose | |
| Observation | |
| Comparison/baseline | |
| Insight | |
| Statement | |
| Evidence and exact numbers | |
| Figure/table/citation references | |
| Explanation supported by evidence | |
| Alternative explanation/limitation | |
| Uncertainty and scope | |
| Terms that must remain unchanged | |
| Claims that must not be added | |
| Target length and tone | |

### Paragraph Reverse Check

| Sentence | Role: statement/evidence/explanation/limitation/bridge | Contract field/source | Supported/revise/remove | Revision |
|---:|---|---|---|---|
| 1 | | | | |

| Final paragraph check | ผ่าน/ไม่ผ่าน | หลักฐาน/หมายเหตุ |
|---|---|---|
| Exact numbers, units, direction, and references preserved | | |
| Every sentence maps to the contract | | |
| No invented mechanism/citation/result | | |
| Causal/generalization language within design scope | | |
| Limitation/boundary retained | | |

## 6. Citation and BibTeX Record with Abstract

| Citation key | DOI/source URL | Metadata verified | Abstract source/accessed | Cited in section | Appears in PDF | Issue/action |
|---|---|---|---|---|---|---|
| | | | | | | |

| รายการตรวจ | ผล |
|---|---|
| Duplicate citation keys | |
| Missing required fields | |
| Undefined citations | |
| Uncited bibliography entries | |
| In-text and reference-list agreement | |

## 6.1 Literature Map and Candidate Gap

| Citation key | Problem/outcome | Population/context | Method/design | Finding/direction | Limitation/future work |
|---|---|---|---|---|---|
| | | | | | |

| Candidate gap | Evidence in corpus | Counterevidence/search needed | Relation to current study | Status observed/candidate/rejected |
|---|---|---|---|---|
| | | | | |

## 7. Figure Record

| Label | Source data/script | Output file | Caption verified | Cited in text | Size/format/rights QA |
|---|---|---|---|---|---|
| | | | | | |

## 8. Table Record

| Label | Source CSV/XLSX/result | Title/notes verified | Cited in text | Number agreement | Width/page QA |
|---|---|---|---|---|---|
| | | | | | |

## 9. Content QA

| รายการ | ผ่าน/ไม่ผ่าน | ตำแหน่ง/หลักฐาน | การแก้ไข |
|---|---|---|---|
| Problem–objective–method–result–conclusion alignment | | | |
| Claim–evidence–citation agreement | | | |
| Text–table–figure number agreement | | | |
| Abstract/title/conclusion do not overclaim | | | |
| Uncertainty, limitation, scope, and by-products | | | |
| No fabricated result/reference/method detail | | | |
| Authorship/ethics/funding/conflict/data/AI disclosure | | | |
| Anonymous-review compliance | | | |

## 10. Visual and PDF QA

| รายการ | ผ่าน/ไม่ผ่าน | หน้า/ตำแหน่ง | การแก้ไข |
|---|---|---|---|
| Page/word/paper-size requirement | | | |
| No missing text after conversion | | | |
| No unresolved citation/reference | | | |
| No overfull text/table/figure | | | |
| Figure readable at final size and grayscale | | | |
| Table readable and correctly continued | | | |
| Caption/label/number consistent | | | |
| Equations, units, abbreviations, and fonts consistent | | | |
| Headings and page breaks acceptable | | | |
| Fonts embedded and PDF opens correctly | | | |
| Required metadata/file naming/package complete | | | |

## 11. Revision Diff Record

| รายการ | คำตอบ |
|---|---|
| Old source snapshot/path | |
| New source snapshot/path | |
| `latexdiff` command | |
| Marked PDF path | |
| Intended claim/number/citation/limitation changes | |
| Unexpected changes and action | |
| Reviewer response or venue requirement linked | |

## 12. Repair Record

| ปัญหา | ชั้นที่เป็นสาเหตุ: content/template/generated/build | Source ที่แก้ | เหตุผล | ผล rebuild/QA |
|---|---|---|---|---|
| | | | | |

## 13. Journal Change Impact

| รายการ | วารสารเดิม | วารสารใหม่ | การปรับที่อนุญาต | หลักฐานใหม่/การตัดสินที่ต้องมี |
|---|---|---|---|---|
| Scope/audience/article type | | | | |
| Title/abstract/keywords | | | | |
| Sections/word or page limit | | | | |
| Citation engine/style | | | | |
| Blind review/declarations | | | | |
| Figures/tables/supplement | | | | |
| Submission package | | | | |
| Fee/license/preprint | | | | |

## 14. Final Decision

| รายการ | คำตอบ |
|---|---|
| พร้อมส่งตาม venue หรือไม่ | |
| Blocking issues | |
| Human decisions still required | |
| External verification still required | |
| Final source/package path | |
| Final PDF/DOCX path | |
