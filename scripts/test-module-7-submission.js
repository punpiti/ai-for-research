const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const siteRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(siteRoot, "assets/module-7-submission.js"), "utf8");
const context = { document: { querySelector: () => null }, TextEncoder, console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context);

const completed = `# Module 7 highlights

## คำถามที่สำรวจ

ค่า PM2.5 เปลี่ยนอย่างไรตามพื้นที่ กลุ่ม ก่อน–หลังมาตรการ และเวลา

## Highlights

- North intervention ลดลง 8.2 µg/m³ หลังมาตรการ เมื่อเทียบค่าเฉลี่ยก่อนและหลัง
- Central intervention ลดลง 5.1 µg/m³ ขณะที่ control เปลี่ยนเพียง 0.8 µg/m³
- South มีรูปแบบต่างจากสองพื้นที่แรก โดยค่าเฉลี่ยหลังมาตรการสูงขึ้น 1.4 µg/m³

## กราฟที่เลือก

ใช้กราฟเส้นแยกพื้นที่และกลุ่มเพื่อให้เห็นแนวโน้มรายสัปดาห์ พร้อมกราฟจุดสรุปการเปลี่ยนแปลงก่อนและหลัง

## ข้อสรุป

ข้อมูลจำลองสนับสนุนว่าการเปลี่ยนแปลงหลังมาตรการแตกต่างกันตามพื้นที่ โดย North และ Central ลดลงชัดกว่า South จึงไม่ควรสรุปผลรวมเพียงค่าเดียวสำหรับทุกพื้นที่

## ข้อจำกัดและสิ่งที่ยังสรุปไม่ได้

ข้อมูลนี้เป็นข้อมูลจำลองและไม่ได้ยืนยันเหตุและผล ยังต้องตรวจแบบการศึกษา ตัวแปรกวน และความไม่แน่นอนก่อนนำไปอ้างอิงภายนอกบทเรียน
`;

const inspection = context.module7SubmissionTestApi.validateMarkdown(completed);
assert.equal(inspection.highlightCount, 3);
assert.ok(inspection.conclusionCharacters >= 40);
assert.throws(() => context.module7SubmissionTestApi.validateMarkdown(completed.replace(/^\- South .*$/m, "")), /3–5/);
assert.throws(() => context.module7SubmissionTestApi.validateMarkdown(completed.replace("## ข้อสรุป", "## สรุป")), /ขาดหัวข้อ/);
assert.throws(() => context.module7SubmissionTestApi.safeCode("bad code", "รหัสคลาส"), /3–40/);
console.log("module-7-submission validator: ok");
