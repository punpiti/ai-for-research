const assert = require("node:assert/strict");
const admin = require("../assets/instructor-admin.js");

assert.equal(
  admin.dashboardEndpoint("faculty-pilot-2569"),
  "/api/ai-for-research/classrooms/faculty-pilot-2569/instructor",
);
assert.equal(admin.submissionLabel("completed"), "เสร็จแล้ว");
assert.equal(admin.submissionLabel("not_submitted"), "ยังไม่ส่ง");
assert.equal(admin.enrollmentLabel("pending"), "รออนุมัติ");
assert.equal(admin.formatTokens(null), "—");
assert.match(admin.formatTokens(12345), /12.*345/);
console.log("Instructor admin helper tests passed.");
