const assert = require("node:assert/strict");
const classroom = require("../assets/classroom.js");

(async () => {
  assert.equal(classroom.classroomIdFromPage(null, "?id=class-a1b2c3"), "class-a1b2c3");
  assert.equal(classroom.classroomIdFromPage({ querySelector: () => ({ dataset: { classroomId: "fallback-class" } }) }, "?id=../../bad"), "fallback-class");
  assert.equal(
    classroom.loginUrl("faculty-pilot-2569"),
    "login.html?next=classroom.html%3Fid%3Dfaculty-pilot-2569%26action%3Denroll",
  );

  const guest = await classroom.sessionState(async () => ({ ok: false, status: 401 }));
  assert.deepEqual(guest, { authenticated: false });

  const member = await classroom.sessionState(async (url, options) => {
    assert.equal(url, "/api/ai-for-research/classrooms/me");
    assert.equal(options.credentials, "same-origin");
    return { ok: true, status: 200, json: async () => ({ preview: true }) };
  });
  assert.equal(member.authenticated, true);
  assert.equal(member.preview, true);

  assert.deepEqual(
    classroom.membershipFor({
      classrooms: [
        { classroom_id: "another-class", status: "active" },
        { classroom_id: "faculty-pilot-2569", role: "teacher", status: "active" },
      ],
    }, "faculty-pilot-2569"),
    { classroom_id: "faculty-pilot-2569", role: "teacher", status: "active" },
  );
  assert.equal(classroom.membershipFor({ classrooms: [] }, "faculty-pilot-2569"), null);

  const requested = await classroom.enroll("faculty-pilot-2569", async (url, options) => {
    assert.equal(url, "/api/ai-for-research/classrooms/faculty-pilot-2569/enroll");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { payment: "not-required" });
    return { ok: true, status: 202, json: async () => ({ status: "pending", paywall: "disabled" }) };
  });
  assert.equal(requested.enrolled, false);
  assert.equal(requested.pending, true);
  assert.equal(requested.paywall, "disabled");

  const expired = await classroom.enroll("faculty-pilot-2569", async () => ({ ok: false, status: 401 }));
  assert.deepEqual(expired, { authenticated: false });
  console.log("Classroom enrollment tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
