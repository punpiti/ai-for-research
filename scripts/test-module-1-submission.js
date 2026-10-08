const assert = require("node:assert/strict");
const module1 = require("../assets/module-1-submission.js");

const completeChecks = Object.fromEntries(module1.checkNames.map((name) => [name, true]));
const envelope = module1.buildEnvelope({
  classroomId: "faculty-pilot-2569",
  completionStatus: "completed",
  aiTool: "openrouter",
  completionMinutes: "35",
  tokenSource: "provider_reported",
  totalTokens: "12000",
  checks: completeChecks,
});

assert.equal(envelope.event_type, "ai_for_research_module_1_progress");
assert.equal(envelope.progress.schema_version, "ai-for-research.module-1-progress.v1");
assert.equal(envelope.progress.module_id, "module-1");
assert.equal(envelope.progress.total_tokens, 12000);
assert.deepEqual(envelope.progress.checks, completeChecks);
assert.equal("api_key" in envelope, false);
assert.throws(() => module1.buildEnvelope({
  classroomId: "faculty-pilot-2569",
  completionStatus: "completed",
  aiTool: "openrouter",
  completionMinutes: "35",
  tokenSource: "not_available",
  totalTokens: "",
  checks: { ...completeChecks, pdf_created_and_opened: false },
}), /Checkpoint/);

const incomplete = module1.buildEnvelope({
  classroomId: "faculty-pilot-2569",
  completionStatus: "could_not_complete",
  aiTool: "openrouter",
  completionMinutes: "35",
  tokenSource: "not_available",
  totalTokens: "",
  checks: { ...completeChecks, pdf_created_and_opened: false },
});
assert.equal(incomplete.progress.total_tokens, null);
assert.equal(incomplete.progress.checks.pdf_created_and_opened, false);

console.log("Module 1 progress submission tests passed.");
