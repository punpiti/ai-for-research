# Module 7 — Visualization Workflow & Prompt Card

ไฟล์นี้เก็บลำดับกิจกรรม Prompt และเกณฑ์ส่งงานแยกจาก notebook เพื่อให้ notebook
เหลือเฉพาะเนื้อหาอ้างอิง ตัวอย่าง และการตีความกราฟ

## 1. เส้นทางเรียน

ดาวน์โหลด [Notebook bundle](../notebooks/module-07-notebook-bundle.zip) หรือดาวน์โหลด `.ipynb`
แต่ละ Part พร้อม [คู่มือติดตั้ง standalone](../notebooks/module-07-standalone-setup.md)

1. เปิด [Part A — อ่านและตรวจกราฟ](../notebooks/module-07a-read-and-audit.ipynb)
2. ทำ Graph Clinic โดยเขียนคำตอบของมนุษย์ก่อนใช้ AI
3. เปิด [Part B — ปรับและส่งออก](../notebooks/module-07b-revise-and-publish.ipynb)
4. เปิด [Part C — Matplotlib Foundations](../notebooks/module-07c-matplotlib-foundations.ipynb)
   เฉพาะเมื่อต้องตรวจหรือแก้โค้ด

| ช่วง | เวลาแนะนำ | วิธีใช้ในชั้นเรียน |
|---|---:|---|
| Part A | 90–120 นาที | บรรยายสั้นสลับให้ผู้เรียนวินิจฉัยกราฟก่อนอ่านคำอธิบาย |
| Graph Clinic | 45–60 นาที | ทำกลุ่ม เขียนคำตอบมนุษย์ก่อน แล้วจึงใช้ AI audit |
| Part B | 90–120 นาที | เดิน makeover แล้วแก้กราฟของผู้เรียนหนึ่งภาพ |
| Part C | 30–45 นาที | optional clinic สำหรับผู้ที่จะเปิดโค้ดหรือส่งภาพเข้า paper |

ถ้ามีเวลาครึ่งวัน ให้ใช้ Part A → Graph Clinic → เลือกช่วง makeover และ paper export
จาก Part B ส่วน interaction และ Part C ให้เป็น self-study

## 2. ใช้บน Google Colab

1. ดาวน์โหลด `.ipynb` แล้วอัปโหลดไปที่ Colab จากนั้นเลือก **Runtime → Run all**
2. cell setup ตรวจทั้งการมีอยู่และรุ่นของ core package แล้วติดตั้งส่วนที่ขาดหรือไม่รองรับให้ครบ
3. หาก Colab ขอให้ restart runtime ให้ restart แล้ว Run all อีกครั้ง
4. ไฟล์ใน `/content/` เป็นไฟล์ชั่วคราว ต้องดาวน์โหลดหรือ mount Google Drive ก่อนปิด runtime
5. อย่าอัปโหลดข้อมูลวิจัยที่มีข้อจำกัดด้านความลับโดยยังไม่ได้ตรวจสิทธิ

ถ้าใช้เครื่องของตนเอง ให้สร้าง environment `ai-for-research-module07` จาก
`module-07-environment.yml` ตามคู่มือติดตั้ง ไม่ใช้ environment ของบทก่อนหน้า

## 3. Chart Contract

กรอกก่อนรับกราฟฉบับแรกจาก AI

| รายการ | คำตอบ |
|---|---|
| Question — ผู้อ่านต้องตอบคำถามใดจากภาพ | |
| Grain — หนึ่งแถวใน plot data แทนอะไร | |
| Filter และ missing-data rule | |
| Transform/aggregation/denominator | |
| x / y / color / size / facet / tooltip | |
| Variability หรือ uncertainty และความหมาย | |
| Claim ที่ภาพรองรับ | |
| Claim ที่ภาพไม่รองรับ | |
| รูปแบบส่งออกและขนาดใช้งานจริง | |
| เลือก static หรือ interactive เพราะเหตุใด | |

แนวคิดของ contract สังเคราะห์จาก `[KIERAN-HEALY, pdf pp. 22–32]` และ
`[HANDBOOK, pdf pp. 69–90]`; ดู tag ที่
[source map](../notebooks/module-07-data-visualization-source-map.md)

## 4. Prompt ให้ AI เสนอกราฟฉบับแรก

```text
จากคำถามและข้อมูลที่แนบ ให้เสนอกราฟฉบับแรก 2 ทางเลือก
แต่ละทางเลือกต้องระบุ:
1) งานที่ผู้อ่านต้องทำ
2) หนึ่งแถวใน plot data แทนอะไร
3) filter, aggregation และ denominator
4) mapping ของ x, y, color, size, facet และ tooltip
5) สิ่งที่กราฟจงใจไม่แสดง
6) ความเสี่ยงต่อการเข้าใจผิด
7) วิธีแสดง raw data, n และ uncertainty เมื่อเกี่ยวข้อง

อย่าเลือกจากความสวยหรือความนิยมอย่างเดียว
ยังไม่ต้องสร้างกราฟจนกว่าฉันจะเลือกทางหนึ่ง
```

## 5. Prompt ตรวจกราฟ

```text
ทำหน้าที่เป็น graph auditor ไม่ใช่ graphic designer
ตรวจกราฟและ plot-data ที่แนบ โดยแยกเป็น:
- factual error
- ambiguous choice
- acceptable trade-off

ตรวจ grain, filter, aggregation, denominator, missing data, scale,
baseline, units, time window, ordering, color accessibility,
uncertainty, annotation, caption และ claim ที่ชื่อกราฟชวนให้เชื่อ

อ้างค่าหรือแถวใน plot-data ทุกครั้งที่กล่าวว่าตัวเลขผิด
เสนอ revision ที่น้อยที่สุดซึ่งแก้ปัญหา
และบอกสิ่งที่ยังต้องให้มนุษย์ตัดสิน
```

## 6. Graph Clinic

### รอบมนุษย์

ก่อนถาม AI ให้แต่ละกลุ่มตอบ:

1. ภาพกำลังชวนให้ผู้อ่านเชื่ออะไร
2. การตัดสินใจใดทำให้เกิดความเชื่อนั้น
3. เป็น error, ambiguity หรือ acceptable trade-off
4. ต้องดูข้อมูลหรือ metadata ใดเพิ่มก่อนแก้
5. จะแก้อย่างไรโดยไม่เปลี่ยนข้อค้นพบ

### รอบ AI

ใช้ Prompt ตรวจกราฟ แล้วบันทึกผลเปรียบเทียบ

| ประเด็น | เราเห็น | AI เห็น | ต้องตรวจหลักฐานเพิ่ม | การตัดสินของกลุ่ม |
|---|---|---|---|---|
| | | | | |

### รอบแก้และแลกตรวจ

1. สร้างกราฟแก้ไขพร้อม `plot-data.csv`
2. เขียน caption ที่บอก grain, n, summary และ uncertainty
3. แลกกับอีกกลุ่ม ให้ผู้ตรวจตอบคำถามจากภาพโดยไม่เห็นขั้นตอนสร้าง
4. บันทึกว่าการแก้ใดเปลี่ยนความหมาย ไม่ใช่เพียงรูปลักษณ์

โจทย์เสริม: สร้าง multi-panel figure ที่แต่ละ panel ดูถูกต้องเมื่อมองแยก
แต่รวมกันแล้วชวนเทียบผิด จากนั้นแก้ denominator, scale, panel order และ visual hierarchy

## 7. นำข้อมูลของตนเองเข้ามา

เก็บ `raw_df`, `clean_df`, `analysis_df` และ `plot_df` แยกกัน แล้วกรอก Chart Contract
หนึ่งชุดต่อกราฟ ส่ง `plot-data.csv` คู่กับภาพเสมอ

ก่อนใช้ข้อมูลจริง ให้ตรวจสิทธิการใช้ ข้อมูลส่วนบุคคล หน่วยวิเคราะห์ missing values
และพจนานุกรมข้อมูลใน
[Module 7 Workbook](module-07-data-analysis-visualization-workbook.md)

## 8. ส่งออก

- ตั้ง `PAPER_EXPORT = True` ใน Part B เมื่อต้องการสร้าง PDF/SVG หนึ่งคอลัมน์
- บันทึกตารางที่ใช้วาดภาพด้วย `plot_df.to_csv("plot-data.csv", index=False)` หลังตรวจโฟลเดอร์ปลายทาง
- ตรวจภาพที่ขนาดใช้งานจริง ทั้งบน paper, slide และหน้าจอ
- interaction ให้ส่งเป็น HTML เมื่อ hover/filter/brush มีงานที่ภาพนิ่งทำได้ยากจริง

## 9. เกณฑ์ส่งงาน

ส่ง 5 ชิ้น:

1. `plot-data.csv` ที่สร้างกราฟได้ตรงกับภาพ
2. กราฟฉบับแรกจาก AI พร้อม Chart Contract
3. Graph Audit ที่แยก error / ambiguity / trade-off
4. ภาพแก้ไขเป็น SVG หรือ PDF และ PNG สำหรับ preview
5. หาก interaction มีประโยชน์ ให้ส่ง HTML พร้อมอธิบาย task; หากไม่มี ให้เขียนเหตุผลที่เลือกภาพนิ่ง

ผ่านเมื่อ:

- ตัวเลขย้อนกลับถึงข้อมูลได้
- หน่วย denominator และ uncertainty ชัด
- visual hierarchy ตรงกับ claim
- caption ไม่กล่าวเกินหลักฐาน
- ผู้เรียนอธิบายเหตุผลของ revision ได้

## 10. Figure Consistency Audit และ gatekeeper

เปิด [บทความจำลอง](../examples/module-07-figure-consistency/mock-article-figure-consistency.pdf)
แล้วอ่าน Methods, ตาราง, รูป, caption และข้อสรุปร่วมกัน จากนั้นตรวจค่ากับ
[ข้อมูลจำลอง](../examples/module-07-figure-consistency/mock-study-data.csv)
และกรอก [แม่แบบคำตอบ](../examples/module-07-figure-consistency/figure-consistency-audit-template.md)

เริ่มด้วย human-first pass แล้วจึงใช้ AI เป็นผู้ตรวจคนที่สอง คำตอบต้องมีอย่างน้อย 6 ประเด็น
อย่างน้อย 4 ประเด็นต้องเปรียบเทียบหลายตำแหน่ง และต้องคำนวณจาก CSV อย่างน้อย 3 ค่า
ส่งไฟล์ชื่อ `module-07-figure-audit.md` ผ่านหน้า Module 7

ระบบรับไฟล์เข้าสถานะ `pending_review` การทำ checklist หรือการส่งไฟล์สำเร็จยังไม่ถือว่าผ่าน
ผู้สอนตรวจเอกสารฉบับเต็มและให้ผล `approved`, `revision_requested` หรือ `rejected`
เฉพาะ `approved` เท่านั้นที่ทำให้ Module 7 สมบูรณ์

## Exit ticket

- กราฟของคุณซ่อนอะไรโดยตั้งใจ
- จุดใดที่ AI ตัดสินใจแทนคุณ และคุณตรวจอย่างไร
- ถ้าต้องตัดองค์ประกอบหนึ่งอย่างเพื่อให้ภาพชัดขึ้น คุณจะตัดอะไร เพราะเหตุใด
