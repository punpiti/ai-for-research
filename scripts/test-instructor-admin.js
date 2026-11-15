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
assert.equal(
  admin.moduleContentPath("module-3", "faculty-pilot-2569"),
  "/api/ai-for-research/classrooms/faculty-pilot-2569/content/module-3.html?classroom_id=faculty-pilot-2569",
);
assert.equal(admin.submissionLabel("completed"), "เสร็จแล้ว");
assert.equal(admin.submissionLabel("not_submitted"), "ยังไม่ส่ง");
assert.equal(admin.enrollmentLabel("pending"), "รออนุมัติ");
assert.deepEqual(
  admin.parseBulkEmails("Student-001@KU.TH, student-002@ku.th\nstudent-001@ku.th; student-003@ku.th"),
  ["student-001@ku.th", "student-002@ku.th", "student-003@ku.th"],
);
assert.equal(admin.formatTokens(null), "—");
assert.match(admin.formatTokens(12345), /12.*345/);

// AI budget (USD): default 0, never "unlimited"; 0-1000 with cents precision.
assert.equal(admin.budgetValue({}), 0);
assert.equal(admin.budgetValue({ ai_budget_usd: null }), 0);
assert.equal(admin.budgetValue({ ai_budget_usd: 12.5 }), 12.5);
assert.equal(admin.parseBudget(""), 0);
assert.equal(admin.parseBudget("2.345"), 2.35);
assert.equal(admin.parseBudget("1000"), 1000);
assert.equal(admin.parseBudget("1000.01"), null);
assert.equal(admin.parseBudget("-1"), null);
assert.equal(admin.parseBudget("abc"), null);

// PATCH body: status + legacy token_quota always; role only for non-teacher rows.
assert.deepEqual(
  admin.enrollmentPatchBody({ role: "student", token_quota: 50000 }, { status: "active", role: "ta", budget: 5 }),
  { status: "active", token_quota: 50000, ai_budget_usd: 5, role: "ta" },
);
assert.deepEqual(
  admin.enrollmentPatchBody({ role: "teacher" }, { status: "active", role: "ta", budget: 0 }),
  { status: "active", token_quota: null, ai_budget_usd: 0 },
);
assert.equal(admin.enrollmentPatchBody({ role: "student" }, { status: "pending", role: "teacher", budget: 0 }).role, undefined);

assert.equal(admin.roleLabel("teacher"), "ผู้สอน");
assert.equal(admin.roleLabel("ta"), "TA");
assert.equal(admin.roleLabel("student"), "ผู้เรียน");
assert.equal(admin.formatDateTime(null), "—");
assert.equal(admin.formatDateTime("not-a-date"), "—");
assert.match(admin.formatDateTime("2026-11-15T07:30:00Z"), /2569/);
assert.equal(admin.enrollmentName({ given_name: "สมชาย", family_name: "ใจดี", email: "a@b.c" }), "สมชาย ใจดี");
assert.equal(admin.enrollmentName({ email: "a@b.c" }), "a@b.c");

const ta = { role: "ta", status: "active", display_name: "Ann Lee", email: "ann@ku.th" };
assert.equal(admin.matchesEnrollmentFilter(ta, { query: "ANN" }), true);
assert.equal(admin.matchesEnrollmentFilter(ta, { query: "ku.th", role: "ta", status: "active" }), true);
assert.equal(admin.matchesEnrollmentFilter(ta, { role: "student" }), false);
assert.equal(admin.matchesEnrollmentFilter(ta, { status: "pending" }), false);
assert.equal(admin.matchesEnrollmentFilter(ta, { query: "zzz" }), false);
console.log("Instructor admin helper tests passed.");
assert.equal(admin.usageText(null), "");
assert.equal(admin.usageText({ label: "L01" }), "");
assert.equal(admin.usageText({ usage_usd: 0.254, limit_usd: 2 }), "$0.25 / $2.00");
assert.equal(admin.usageText({ usage_usd: 0, limit_usd: null }), "$0.00 / —");
