const submissionForm = document.querySelector("[data-module-2-submission-form]");
const previewSection = document.querySelector("[data-module-2-submission-preview]");
const previewCode = document.querySelector("[data-module-2-submission-json]");
const submissionStatus = document.querySelector("[data-module-2-submission-status]");
const sendButton = document.querySelector("[data-module-2-submit]");
const receiptSection = document.querySelector("[data-module-2-receipt]");
const receiptCode = document.querySelector("[data-module-2-receipt-json]");
const receiptDownload = document.querySelector("[data-module-2-receipt-download]");

const submissionEndpoint = "/api/ai-for-research/module-2/submissions";
const classStatusBase = "/api/ai-for-research/module-2/classes";
const schemaVersion = "ai-for-research.module-2-submission.v4";
const eventType = "ai_for_research_module_2_submission";
const formats = ["pdf", "xlsx", "docx", "image", "web"];
const levels = ["L1", "L2", "L3", "L4"];
const maxMarkdownBytes = 32000;
const maxJsonBytes = 64000;
let checkedPayload = null;
let latestReceipt = null;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value, minimum, maximum, label) {
  const normalized = text(value);
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${label} ต้องยาว ${minimum}–${maximum} ตัวอักษร`);
  }
  return normalized;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("JSON ต้องเป็น object หนึ่งชุด");
  requireExactKeys(payload, ["schema_version", "module_id", "artifact", "result", "declaration"], "JSON ระดับบนสุด");
  if (payload.schema_version !== schemaVersion || payload.module_id !== "module-2") throw new Error("schema_version หรือ module_id ไม่ตรงกับ Module 2");
  const artifact = payload.artifact || {};
  requireExactKeys(artifact, ["filename", "sha256"], "artifact");
  if (artifact.filename !== "module-2-conclusion.md") throw new Error("artifact.filename ต้องเป็น module-2-conclusion.md");
  if (!/^[a-f0-9]{64}$/.test(text(artifact.sha256))) throw new Error("artifact.sha256 ต้องเป็น SHA-256 ตัวพิมพ์เล็ก 64 ตัว");

  const result = payload.result || {};
  requireExactKeys(result, ["decision", "reason", "claims", "open_questions", "learner_additions", "formats_checked", "web_retrieval", "prompt_test", "human_decision"], "result");
  if (!["conditional_yes", "conditional_no", "insufficient_evidence"].includes(result.decision)) throw new Error("result.decision ไม่อยู่ในตัวเลือกที่กำหนด");
  requireText(result.reason, 40, 800, "result.reason");
  if (!["live", "fallback"].includes(result.web_retrieval)) throw new Error("result.web_retrieval ต้องเป็น live หรือ fallback");
  if (!["accept_with_conditions", "reject", "need_more_evidence"].includes(result.human_decision)) throw new Error("result.human_decision ไม่อยู่ในตัวเลือกที่กำหนด");
  validateClaims(result.claims);
  validateOpenQuestions(result.open_questions);
  validateLearnerAdditions(result.learner_additions, result.open_questions);
  if (!Array.isArray(result.formats_checked) || result.formats_checked.length !== formats.length || !formats.every((format) => result.formats_checked.includes(format)) || new Set(result.formats_checked).size !== formats.length) {
    throw new Error("formats_checked ต้องมี pdf, xlsx, docx, image และ web อย่างละหนึ่งครั้ง");
  }
  validatePromptTest(result.prompt_test, result.claims.length);

  const declaration = payload.declaration || {};
  requireExactKeys(declaration, ["originals_preserved", "claims_checked_by_learner", "learner_additions_written_by_learner", "no_personal_data"], "declaration");
  for (const key of ["originals_preserved", "claims_checked_by_learner", "learner_additions_written_by_learner", "no_personal_data"]) {
    if (declaration[key] !== true) throw new Error(`declaration.${key} ต้องเป็น true`);
  }
}

function validateLearnerAdditions(additions, openQuestions) {
  if (!Array.isArray(additions) || additions.length !== openQuestions.length) throw new Error("result.learner_additions ต้องตอบ open_questions ครบทุกข้อ");
  const ids = new Set();
  const questionIds = new Set(openQuestions.map((item) => item.id));
  const answeredQuestionIds = new Set();
  for (const item of additions) {
    requireExactKeys(item, ["id", "open_question_id", "answer_type", "learner_answer", "basis", "sources"], "learner_addition");
    if (!/^A[1-3]$/.test(text(item.id)) || ids.has(item.id)) throw new Error("learner_addition.id ต้องเป็น A1–A3 และห้ามซ้ำ");
    ids.add(item.id);
    if (!questionIds.has(item.open_question_id) || answeredQuestionIds.has(item.open_question_id)) throw new Error(`${item.id}.open_question_id ต้องอ้างถึง open_question ที่มีอยู่และห้ามซ้ำ`);
    answeredQuestionIds.add(item.open_question_id);
    if (!["evidence_based", "reasoned_judgment", "still_unknown"].includes(item.answer_type)) throw new Error(`${item.id}.answer_type ไม่อยู่ในตัวเลือกที่กำหนด`);
    requireText(item.learner_answer, 20, 500, `${item.id}.learner_answer`);
    requireText(item.basis, 20, 500, `${item.id}.basis`);
    if (!Array.isArray(item.sources) || item.sources.some((source) => !formats.includes(source)) || new Set(item.sources).size !== item.sources.length) throw new Error(`${item.id}.sources มีค่าที่ไม่รองรับหรือซ้ำกัน`);
    if (item.answer_type === "evidence_based" && !item.sources.length) throw new Error(`${item.id} แบบ evidence_based ต้องมี source อย่างน้อยหนึ่งรายการ`);
  }
}

function validateOpenQuestions(openQuestions) {
  if (!Array.isArray(openQuestions) || openQuestions.length < 1 || openQuestions.length > 3) throw new Error("result.open_questions ต้องมี 1–3 ข้อ");
  const ids = new Set();
  for (const item of openQuestions) {
    requireExactKeys(item, ["id", "question", "missing_evidence", "next_prompt"], "open_question");
    if (!/^U[1-3]$/.test(text(item.id)) || ids.has(item.id)) throw new Error("open_question.id ต้องเป็น U1–U3 และห้ามซ้ำ");
    ids.add(item.id);
    requireText(item.question, 15, 300, `${item.id}.question`);
    requireText(item.missing_evidence, 15, 500, `${item.id}.missing_evidence`);
    requireText(item.next_prompt, 30, 1000, `${item.id}.next_prompt`);
  }
}

function validateClaims(claims) {
  if (!Array.isArray(claims) || claims.length < 8 || claims.length > 10) throw new Error("result.claims ต้องมี 8–10 ข้อ");
  const ids = new Set();
  for (const claim of claims) {
    requireExactKeys(claim, ["id", "text", "level", "sources", "location"], "claim");
    if (!/^C(10|[1-9])$/.test(text(claim.id)) || ids.has(claim.id)) throw new Error("claim.id ต้องเป็น C1–C10 และห้ามซ้ำ");
    ids.add(claim.id);
    requireText(claim.text, 10, 500, `${claim.id}.text`);
    if (!levels.includes(claim.level)) throw new Error(`${claim.id}.level ต้องเป็น L1–L4`);
    if (!Array.isArray(claim.sources) || claim.sources.some((source) => !formats.includes(source)) || new Set(claim.sources).size !== claim.sources.length) throw new Error(`${claim.id}.sources มีค่าที่ไม่รองรับหรือซ้ำกัน`);
    if (claim.level === "L4") {
      if (claim.sources.length || text(claim.location)) throw new Error(`${claim.id} ระดับ L4 ต้องไม่มี source และ location`);
    } else {
      if (!claim.sources.length || text(claim.location).length < 3) throw new Error(`${claim.id} ระดับ L1–L3 ต้องมี source และ location`);
      if (claim.level === "L3" && claim.sources.length < 2) throw new Error(`${claim.id} ระดับ L3 ต้องเชื่อมอย่างน้อยสองแหล่ง`);
    }
  }
  if (!levels.every((level) => claims.some((claim) => claim.level === level))) throw new Error("claims ต้องมีตัวอย่าง L1, L2, L3 และ L4 อย่างน้อยระดับละหนึ่งข้อ");
}

function validatePromptTest(promptTest, claimCount) {
  requireExactKeys(promptTest, ["round_1_traceable", "round_1_unsupported", "round_2_traceable", "round_2_unsupported"], "prompt_test");
  for (const [key, value] of Object.entries(promptTest)) {
    if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error(`prompt_test.${key} ต้องเป็นจำนวนเต็ม 0–10`);
  }
  if (promptTest.round_1_traceable + promptTest.round_1_unsupported !== claimCount || promptTest.round_2_traceable + promptTest.round_2_unsupported !== claimCount) throw new Error("จำนวน traceable + unsupported ของแต่ละรอบต้องเท่ากับจำนวน claims");
  const didNotRegress = promptTest.round_2_traceable >= promptTest.round_1_traceable && promptTest.round_2_unsupported <= promptTest.round_1_unsupported;
  const improved = promptTest.round_2_traceable > promptTest.round_1_traceable && promptTest.round_2_unsupported < promptTest.round_1_unsupported;
  const perfectFirstRound = promptTest.round_1_traceable === claimCount && promptTest.round_1_unsupported === 0;
  if (!didNotRegress || (!improved && !perfectFirstRound)) throw new Error("Prompt รอบสองต้องดีขึ้น หรือรักษาผลเดิมเมื่อรอบแรกตรวจย้อนกลับได้ครบแล้ว");
}

function buildMachineCheck(payload) {
  const levelCounts = Object.fromEntries(levels.map((level) => [level, payload.result.claims.filter((claim) => claim.level === level).length]));
  return {
    passed: true,
    claim_count: payload.result.claims.length,
    open_question_count: payload.result.open_questions.length,
    learner_addition_count: payload.result.learner_additions.length,
    level_counts: levelCounts,
    formats_complete: true,
    source_rules_pass: true,
    prompt_rule_passed: true,
    follow_up_prompts_present: true,
    unanswered_questions_completed_by_learner: true,
    learner_authorship_declared: true,
    declaration_complete: true,
    markdown_hash_match: true,
  };
}

function buildProgressSummary(payload) {
  return {
    schema_version: payload.schema_version,
    artifact_sha256: payload.artifact.sha256,
    decision: payload.result.decision,
    human_decision: payload.result.human_decision,
    web_retrieval: payload.result.web_retrieval,
    prompt_test: { ...payload.result.prompt_test },
    learner_answer_types: payload.result.learner_additions.map((item) => item.answer_type),
  };
}

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} ต้องเป็น object`);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !(key in value));
  if (unknown.length) throw new Error(`${label} มี field ที่ schema ไม่รองรับ: ${unknown.join(", ")}`);
  if (missing.length) throw new Error(`${label} ขาด field: ${missing.join(", ")}`);
}

async function sha256Hex(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeCode(value, label) {
  const normalized = text(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(normalized)) {
    throw new Error(`${label} ใช้ A–Z, a–z, 0–9, จุด ขีดกลาง หรือขีดล่าง รวม 3–40 ตัว`);
  }
  return normalized;
}

function callsignStorageKey(classCode, callsign) {
  return `ai-research-module-2-callsign-key:${classCode}:${callsign}`;
}

function requiredInteger(name, minimum, maximum, label) {
  const raw = text(submissionForm.elements[name]?.value);
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} ต้องเป็นจำนวนเต็ม ${minimum}–${maximum}`);
  }
  return value;
}

function optionalInteger(name, maximum, label) {
  const raw = text(submissionForm.elements[name]?.value);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new Error(`${label} ต้องเป็นจำนวนเต็ม 0–${maximum}`);
  return value;
}

function buildModuleEvaluation() {
  const tokenSource = text(submissionForm.elements.token_source?.value);
  const inputTokens = optionalInteger("input_tokens", 10000000, "Input tokens");
  const outputTokens = optionalInteger("output_tokens", 10000000, "Output tokens");
  const totalTokens = optionalInteger("total_tokens", 20000000, "Total tokens");
  if (tokenSource === "not_available" && [inputTokens, outputTokens, totalTokens].some((value) => value !== null)) throw new Error("เลือกไม่มีข้อมูล Token แล้วต้องเว้นจำนวน Token ว่าง");
  if (tokenSource !== "not_available" && totalTokens === null) throw new Error("กรอก Total tokens เมื่อเลือกค่าจากผู้ให้บริการหรือค่าประมาณ");
  if (inputTokens !== null && outputTokens !== null && totalTokens !== inputTokens + outputTokens) throw new Error("Total tokens ต้องเท่ากับ Input + Output tokens");
  return {
    ai_tool: text(submissionForm.elements.ai_tool?.value),
    ai_turns: requiredInteger("ai_turns", 1, 40, "จำนวนรอบที่ใช้ AI"),
    retry_count: requiredInteger("retry_count", 0, 20, "จำนวนครั้งที่ถามซ้ำ"),
    completion_minutes: requiredInteger("completion_minutes", 1, 600, "เวลาที่ใช้ทำ Module"),
    token_source: tokenSource,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    completion_status: text(submissionForm.elements.completion_status?.value),
    difficulty_rating: requiredInteger("difficulty_rating", 1, 5, "ระดับความยาก"),
    usefulness_rating: requiredInteger("usefulness_rating", 1, 5, "ระดับประโยชน์"),
    hardest_step: text(submissionForm.elements.hardest_step?.value),
  };
}

async function requireOpenClass(classCode) {
  const response = await fetch(`${classStatusBase}/${encodeURIComponent(classCode)}/status`, { credentials: "same-origin" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "ตรวจสถานะคลาสไม่ได้");
  if (!payload.is_open) throw new Error("คลาสนี้ยังไม่เปิดรับงานหรือปิดรับงานแล้ว โปรดตรวจรหัสคลาสกับผู้สอน");
  return payload;
}

submissionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  checkedPayload = null;
  sendButton.disabled = true;
  previewSection.hidden = true;
  receiptSection.hidden = true;
  submissionStatus.textContent = "กำลังตรวจไฟล์…";
  try {
    if (!submissionForm.reportValidity()) {
      submissionStatus.textContent = "กรอกข้อมูลและยืนยันความยินยอมให้ครบ";
      return;
    }
    const classCode = safeCode(submissionForm.elements.class_code.value, "รหัสคลาส");
    await requireOpenClass(classCode);
    const markdownFile = submissionForm.elements.markdown_file.files[0];
    const jsonFile = submissionForm.elements.json_file.files[0];
    if (!markdownFile || !jsonFile) throw new Error("เลือกไฟล์ Markdown และ JSON ให้ครบ");
    if (markdownFile.size > maxMarkdownBytes || jsonFile.size > maxJsonBytes) throw new Error("ไฟล์ใหญ่เกินขอบเขตของกิจกรรม");
    if (markdownFile.name !== "module-2-conclusion.md") throw new Error("เลือกไฟล์ module-2-conclusion.md");
    if (jsonFile.name !== "module-2-submission.json") throw new Error("เลือกไฟล์ module-2-submission.json");

    const rawJson = await jsonFile.text();
    const payload = JSON.parse(rawJson);
    validatePayload(payload);
    const markdownText = await markdownFile.text();
    const markdownHash = await sha256Hex(markdownFile);
    if (markdownHash !== payload.artifact.sha256) throw new Error("SHA-256 ใน JSON ไม่ตรงกับไฟล์ Markdown ที่เลือก");
    if (markdownText.trim().length < 200) throw new Error("ไฟล์ Markdown ต้องมีเนื้อหาอย่างน้อย 200 ตัวอักษร");

    const callsign = safeCode(submissionForm.elements.callsign.value, "Call sign");
    const enteredCallsignKey = text(submissionForm.elements.callsign_key?.value);
    checkedPayload = {
      event_type: eventType,
      submission_id: crypto.randomUUID(),
      class_code: classCode,
      callsign,
      callsign_key: enteredCallsignKey || localStorage.getItem(callsignStorageKey(classCode, callsign)) || null,
      client_submitted_at: new Date().toISOString(),
      module_evaluation: buildModuleEvaluation(),
      machine_check: buildMachineCheck(payload),
      progress: buildProgressSummary(payload),
    };
    previewCode.textContent = JSON.stringify(checkedPayload, null, 2);
    previewSection.hidden = false;
    sendButton.disabled = false;
    submissionStatus.textContent = "ตรวจไฟล์และ SHA-256 ผ่านแล้ว กรุณาตรวจ preview ก่อนส่ง";
    previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    submissionStatus.textContent = `ยังส่งไม่ได้: ${error.message || "ตรวจไฟล์ไม่ผ่าน"}`;
  }
});

sendButton?.addEventListener("click", async () => {
  if (!checkedPayload) return;
  sendButton.disabled = true;
  submissionStatus.textContent = "กำลังส่ง JSON ไปยังเซิร์ฟเวอร์…";
  try {
    const response = await fetch(submissionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkedPayload),
      credentials: "same-origin",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== "accepted") throw new Error(result.detail || `เซิร์ฟเวอร์ไม่รับข้อมูล (${response.status})`);
    localStorage.setItem(callsignStorageKey(checkedPayload.class_code, checkedPayload.callsign), result.callsign_key);
    latestReceipt = {
      status: "accepted",
      module_id: "module-2",
      submission_id: checkedPayload.submission_id,
      class_code: checkedPayload.class_code,
      callsign: checkedPayload.callsign,
      callsign_key: result.callsign_key,
      markdown_sha256: checkedPayload.progress.artifact_sha256,
      machine_check_passed: checkedPayload.machine_check.passed,
      attempt_count: result.attempt_count,
      submitted_at: result.received_at || new Date().toISOString(),
    };
    localStorage.setItem("ai-research-module-2-last-receipt", JSON.stringify(latestReceipt));
    receiptCode.textContent = JSON.stringify(latestReceipt, null, 2);
    receiptSection.hidden = false;
    submissionStatus.textContent = "ส่งสำเร็จแล้ว เก็บ receipt ไว้เป็นหลักฐาน";
    receiptSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    sendButton.disabled = false;
    submissionStatus.textContent = `ส่งไม่สำเร็จ: ${error.message || "ตรวจการเชื่อมต่อแล้วลองใหม่"}`;
  }
});

function syncTokenInputs() {
  const unavailable = submissionForm?.elements.token_source?.value === "not_available";
  for (const name of ["input_tokens", "output_tokens", "total_tokens"]) {
    const input = submissionForm?.elements[name];
    if (!input) continue;
    input.disabled = unavailable;
    if (unavailable) input.value = "";
  }
}

submissionForm?.elements.token_source?.addEventListener("change", syncTokenInputs);
syncTokenInputs();

receiptDownload?.addEventListener("click", () => {
  if (!latestReceipt) return;
  const blob = new Blob([`${JSON.stringify(latestReceipt, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `module-2-receipt-${latestReceipt.submission_id}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
