const assert = require("node:assert/strict");
const admin = require("../assets/instructor-admin.js");

assert.equal(
  admin.dashboardEndpoint("faculty-pilot-2569"),
  "/api/ai-for-research/classrooms/faculty-pilot-2569/instructor",
);
assert.equal(admin.classroomListEndpoint, "/api/ai-for-research/classrooms/instructor/classes");
assert.equal(admin.classroomIdFromSearch("?id=class-a1b2c3"), "class-a1b2c3");
assert.equal(admin.classroomIdFromSearch("?id=../../bad"), "");
assert.equal(admin.loginPath("class-a1b2c3"), "../login.html?next=admin%2F%3Fid%3Dclass-a1b2c3");
assert.equal(admin.moduleContentPath("module-1"), "../prepare.html");
assert.equal(admin.moduleContentPath("module-7"), "../module-7.html");
assert.equal(admin.moduleContentPath("module-3", "faculty-pilot-2569"), "../module-3.html?classroom_id=faculty-pilot-2569");
assert.equal(admin.submissionLabel("completed"), "เสร็จแล้ว");
assert.equal(admin.submissionLabel("not_submitted"), "ยังไม่ส่ง");
assert.equal(admin.enrollmentLabel("pending"), "รออนุมัติ");
assert.equal(admin.formatTokens(null), "—");
assert.match(admin.formatTokens(12345), /12.*345/);
console.log("Instructor admin helper tests passed.");
