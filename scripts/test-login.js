const assert = require("node:assert/strict");
const login = require("../assets/login.js");

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error.code === code);
}

(async () => {
  assert.equal(login.safeNextPath("classroom.html?id=faculty-pilot-2569&action=enroll"), "classroom.html?id=faculty-pilot-2569&action=enroll");
  assert.equal(login.safeNextPath("https://attacker.example/"), "");
  assert.equal(login.isLocalPreview("127.0.0.1"), true);
  assert.equal(login.isLocalPreview("localhost"), true);
  assert.equal(login.isLocalPreview("urban.cpe.ku.ac.th"), false);

  let called = false;
  await expectCode(login.authenticateWithGoogle("", async () => { called = true; }), "missing-credential");
  assert.equal(called, false, "missing Google credentials must not reach the API");

  let request;
  const success = await login.authenticateWithGoogle("signed-google-id-token", async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ authenticated: true }) };
  }, "classroom.html?id=faculty-pilot-2569&action=enroll");
  assert.equal(request.url, "/api/ai-for-research/classrooms/auth/google");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "same-origin");
  assert.deepEqual(JSON.parse(request.options.body), {
    credential: "signed-google-id-token",
    next: "classroom.html?id=faculty-pilot-2569&action=enroll",
  });
  assert.equal(success.authenticated, true);
  assert.equal(success.next, "classroom.html?id=faculty-pilot-2569&action=enroll");

  let previewRequest;
  const preview = await login.authenticatePreview(async (url, options) => {
    previewRequest = { url, options };
    return { ok: true, status: 200, json: async () => ({ preview: true }) };
  });
  assert.equal(previewRequest.url, "/api/ai-for-research/classrooms/auth/preview");
  assert.deepEqual(JSON.parse(previewRequest.options.body), {});
  assert.equal(preview.preview, true);
  assert.equal(preview.next, login.defaultNext);

  await expectCode(login.authenticateWithGoogle("token", async () => ({ ok: false, status: 401 })), "not-eligible");
  await expectCode(login.authenticateWithGoogle("token", async () => ({ ok: false, status: 403 })), "not-eligible");
  await expectCode(login.authenticateWithGoogle("token", async () => ({ ok: false, status: 429 })), "rate-limit");
  await expectCode(login.authenticateWithGoogle("token", async () => ({ ok: false, status: 500 })), "server");
  await expectCode(login.authenticateWithGoogle("token", async () => { throw new Error("offline"); }), "network");

  console.log("Google login request tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
