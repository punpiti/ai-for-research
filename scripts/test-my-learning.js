const assert = require("node:assert/strict");
const learning = require("../assets/my-learning.js");

assert.equal(learning.roleLabel("teacher"), "ผู้สอน");
assert.equal(learning.roleLabel("student"), "ผู้เรียน");
assert.equal(learning.statusLabel("pending"), "รออนุมัติ");
assert.equal(
  learning.classroomPath({ classroom_id: "class-1", role: "teacher", status: "active" }),
  "admin/?id=class-1",
);
assert.equal(
  learning.classroomPath({ classroom_id: "class-1", role: "student", status: "pending" }),
  "classroom.html?id=class-1",
);
console.log("My learning helper tests passed.");
