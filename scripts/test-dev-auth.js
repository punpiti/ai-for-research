const assert = require("node:assert/strict");

const stored = new Map();
global.location = { hostname: "127.0.0.1", origin: "http://127.0.0.1:8000", href: "http://127.0.0.1:8000/classroom.html" };
global.sessionStorage = {
  getItem: (key) => stored.get(key) || null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
const calls = [];
global.fetch = async (input, init = {}) => { calls.push({ input, init }); return { ok: true }; };

require("../assets/dev-auth.js");

assert.equal(global.aiResearchDevAuth.enabled, true);
global.aiResearchDevAuth.store("dev-token-1");
assert.equal(global.aiResearchDevAuth.read(), "dev-token-1");

(async () => {
  await global.fetch("/api/ai-for-research/classrooms/me", { headers: { Accept: "application/json" } });
  assert.equal(calls[0].init.headers.get("X-AI-Research-Dev-Session"), "dev-token-1");
  assert.equal(calls[0].init.headers.get("Accept"), "application/json");

  await global.fetch("https://example.org/api/ai-for-research/classrooms/me");
  assert.equal(new Headers(calls[1].init.headers).has("X-AI-Research-Dev-Session"), false);

  global.aiResearchDevAuth.clear();
  assert.equal(global.aiResearchDevAuth.read(), "");
  console.log("Development auth fallback tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
