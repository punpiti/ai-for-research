const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const siteRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(siteRoot, "assets/module-2-submission.js"), "utf8");
const context = {
  document: { querySelector: () => null },
  console,
};
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.testApi = { validatePayload, buildMachineCheck, buildProgressSummary };`, context);

const claim = (id, level, sources, location) => ({
  id,
  text: `ข้อความข้ออ้างสำหรับ ${id} ที่มีความยาวเพียงพอ`,
  level,
  sources,
  location,
});

const validPayload = {
  schema_version: "ai-for-research.module-2-submission.v4",
  module_id: "module-2",
  artifact: {
    filename: "module-2-conclusion.md",
    sha256: "a".repeat(64),
  },
  result: {
    decision: "insufficient_evidence",
    reason: "หลักฐานตอบเรื่องราคาและเวลาได้ แต่ยังไม่พอยืนยันความอิ่มของทุกคนถึงเวลา 16:00",
    claims: [
      claim("C1", "L1", ["pdf"], "หน้า 1 ตารางราคา"),
      claim("C2", "L1", ["xlsx"], "Sheet observations แถว 2"),
      claim("C3", "L2", ["web"], "รีวิวภาษาไทยย่อหน้า 1"),
      claim("C4", "L2", ["web"], "English review paragraph 1"),
      claim("C5", "L3", ["pdf", "xlsx"], "เปรียบเทียบราคาและเวลารอ"),
      claim("C6", "L3", ["docx", "image"], "เปรียบเทียบสูตรกับภาพ"),
      claim("C7", "L4", [], ""),
      claim("C8", "L4", [], ""),
    ],
    open_questions: [
      {
        id: "U1",
        question: "ผู้เรียนทุกคนจะอิ่มถึงเวลา 16:00 หรือไม่",
        missing_evidence: "ยังไม่มีข้อมูลติดตามความอิ่มจากผู้เรียนหลายคนในเงื่อนไขเดียวกัน",
        next_prompt: "ช่วยออกแบบตารางเก็บข้อมูลความอิ่มทุกหนึ่งชั่วโมง โดยยังไม่สรุปผลหรือสร้างข้อมูลขึ้นเอง",
      },
    ],
    learner_additions: [
      {
        id: "A1",
        open_question_id: "U1",
        answer_type: "still_unknown",
        learner_answer: "ฉันยังตอบเรื่องความอิ่มของผู้เรียนทุกคนไม่ได้จากหลักฐานชุดนี้",
        basis: "รีวิวมีเพียงสองรายและให้ผลต่างกัน จึงยังใช้แทนผู้เรียนทั้งหมดไม่ได้",
        sources: [],
      },
    ],
    formats_checked: ["pdf", "xlsx", "docx", "image", "web"],
    web_retrieval: "live",
    prompt_test: {
      round_1_traceable: 4,
      round_1_unsupported: 4,
      round_2_traceable: 7,
      round_2_unsupported: 1,
    },
    human_decision: "need_more_evidence",
  },
  declaration: {
    originals_preserved: true,
    claims_checked_by_learner: true,
    learner_additions_written_by_learner: true,
    no_personal_data: true,
  },
};

assert.doesNotThrow(() => context.testApi.validatePayload(validPayload));
const publicExample = JSON.parse(fs.readFileSync(path.join(siteRoot, "downloads/module-02-submission-example.json"), "utf8"));
assert.doesNotThrow(() => context.testApi.validatePayload(publicExample));
assert.deepEqual(JSON.parse(JSON.stringify(context.testApi.buildMachineCheck(validPayload))), {
  passed: true,
  claim_count: 8,
  open_question_count: 1,
  learner_addition_count: 1,
  level_counts: { L1: 2, L2: 2, L3: 2, L4: 2 },
  formats_complete: true,
  source_rules_pass: true,
  prompt_rule_passed: true,
  follow_up_prompts_present: true,
  unanswered_questions_completed_by_learner: true,
  learner_authorship_declared: true,
  declaration_complete: true,
  markdown_hash_match: true,
});

const badL4 = structuredClone(validPayload);
badL4.result.claims[6].sources = ["pdf"];
assert.throws(() => context.testApi.validatePayload(badL4), /L4/);

const badPrompt = structuredClone(validPayload);
badPrompt.result.prompt_test = {
  round_1_traceable: 4,
  round_1_unsupported: 4,
  round_2_traceable: 4,
  round_2_unsupported: 4,
};
assert.throws(() => context.testApi.validatePayload(badPrompt), /รอบสอง/);

const perfectFirstRound = structuredClone(validPayload);
perfectFirstRound.result.prompt_test = {
  round_1_traceable: 8,
  round_1_unsupported: 0,
  round_2_traceable: 8,
  round_2_unsupported: 0,
};
assert.doesNotThrow(() => context.testApi.validatePayload(perfectFirstRound));

const missingOpenQuestion = structuredClone(validPayload);
missingOpenQuestion.result.open_questions = [];
assert.throws(() => context.testApi.validatePayload(missingOpenQuestion), /open_questions/);

const missingLearnerAddition = structuredClone(validPayload);
missingLearnerAddition.result.learner_additions = [];
assert.throws(() => context.testApi.validatePayload(missingLearnerAddition), /learner_additions/);

const aiAuthoredAddition = structuredClone(validPayload);
aiAuthoredAddition.declaration.learner_additions_written_by_learner = false;
assert.throws(() => context.testApi.validatePayload(aiAuthoredAddition), /learner_additions_written_by_learner/);

const progress = context.testApi.buildProgressSummary(validPayload);
assert.equal(progress.schema_version, validPayload.schema_version);
assert.equal(progress.artifact_sha256, validPayload.artifact.sha256);
assert.deepEqual([...progress.learner_answer_types], ["still_unknown"]);
assert.equal("claims" in progress, false);
assert.equal("open_questions" in progress, false);
assert.equal("learner_additions" in progress, false);
assert.equal(JSON.stringify(progress).includes(validPayload.result.learner_additions[0].learner_answer), false);

console.log("Module 2 machine-checkable submission tests passed.");
