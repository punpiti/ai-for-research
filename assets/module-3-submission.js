const form = document.querySelector("[data-module-3-submission-form]");
const statusNode = document.querySelector("[data-module-3-status]");
const preview = document.querySelector("[data-module-3-preview]");
const previewCode = document.querySelector("[data-module-3-json]");
const sendButton = document.querySelector("[data-module-3-send]");
const receipt = document.querySelector("[data-module-3-receipt]");
const receiptCode = document.querySelector("[data-module-3-receipt-json]");
const receiptDownload = document.querySelector("[data-module-3-receipt-download]");
const endpoint = "/api/ai-for-research/module-3/submissions";
const classStatusBase = "/api/ai-for-research/module-3/classes";
const schemaVersion = "ai-for-research.module-3-completion.v1";
let checkedEnvelope = null;
let latestReceipt = null;

const text = (value) => typeof value === "string" ? value.trim() : "";
const exact = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} ต้องเป็น object`);
  const actual = Object.keys(value);
  const missing = keys.filter((key) => !(key in value));
  const unknown = actual.filter((key) => !keys.includes(key));
  if (missing.length || unknown.length) throw new Error(`${label} มี field ไม่ตรง schema`);
};
const integer = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} ต้องเป็นจำนวนเต็ม ${min}–${max}`);
  return value;
};
const safeCode = (value, label) => {
  const normalized = text(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(normalized)) throw new Error(`${label} ไม่ถูกต้อง`);
  return normalized;
};
const storageKey = (classCode, callsign) => `ai-research-module-3-callsign-key:${classCode}:${callsign}`;

function validateCompletion(payload) {
  exact(payload, ["schema_version", "module_id", "route", "checks", "metrics", "artifacts"], "completion JSON");
  if (payload.schema_version !== schemaVersion || payload.module_id !== "module-3") throw new Error("schema/module ไม่ตรงกับ Module 3");
  if (!["student", "faculty"].includes(payload.route)) throw new Error("route ต้องเป็น student หรือ faculty");
  const checkKeys = ["evidence_ready", "problem_statement_reviewed", "candidate_gap_reviewed", "reverse_search_completed", "learner_decision_recorded", "local_validator_passed"];
  exact(payload.checks, checkKeys, "checks");
  if (checkKeys.some((key) => payload.checks[key] !== true)) throw new Error("AI local validator และผู้เรียนต้องยืนยัน checks ทุกข้อ");
  const metricKeys = ["reference_count", "reference_verified_count", "reference_not_found_count", "reference_unresolved_count", "pdf_downloaded_count", "pdf_missing_count", "markdown_reference_count", "citation_count", "citation_without_reference_count", "citation_supported_count", "citation_partial_count", "citation_not_supported_count", "citation_not_checkable_count", "quartile_available_count", "quartile_not_applicable_count", "quartile_unresolved_count", "h_index_available_count", "h_index_not_applicable_count", "h_index_unresolved_count", "integrity_retracted_count", "integrity_expression_of_concern_count", "integrity_withdrawn_count", "integrity_corrected_count", "integrity_no_notice_count", "integrity_unresolved_count", "blind_spot_candidate_count", "blind_spot_already_known_count", "blind_spot_new_to_author_count", "blind_spot_rejected_count", "blind_spot_unresolved_count", "classification_dimension_count", "paper_classified_count", "opportunity_candidate_count", "opportunity_weakened_count", "opportunity_rejected_count", "opportunity_directly_aligned_count", "opportunity_extends_scope_count", "opportunity_tests_boundary_count", "opportunity_adjacent_count", "opportunity_unrelated_count", "opportunity_author_endorsed_count", "rq_candidate_count", "rq_dimension_count", "rq_ai_strong_count", "rq_ai_develop_count", "rq_ai_weak_count", "rq_review_agree_count", "rq_review_partly_agree_count", "rq_review_disagree_count", "rq_revised_rating_count", "rq_new_to_author_count", "rq_keep_count", "rq_revise_count", "rq_drop_count"];
  exact(payload.metrics, metricKeys, "metrics");
  metricKeys.forEach((key) => {
    const maximum = key.startsWith("opportunity_") ? 4 : key.startsWith("rq_") ? 12 : key.startsWith("blind_spot_") ? 100 : key === "classification_dimension_count" ? 30 : key.includes("citation") ? 5000 : 1000;
    integer(payload.metrics[key], 0, maximum, `metrics.${key}`);
  });
  if (payload.metrics.citation_supported_count + payload.metrics.citation_partial_count + payload.metrics.citation_not_supported_count + payload.metrics.citation_not_checkable_count !== payload.metrics.citation_count) throw new Error("ผลรวมสถานะ citation ไม่ตรง citation_count");
  if (payload.metrics.reference_verified_count + payload.metrics.reference_not_found_count + payload.metrics.reference_unresolved_count !== payload.metrics.reference_count) throw new Error("ผลรวมสถานะ reference ไม่ตรง reference_count");
  if (payload.metrics.quartile_available_count + payload.metrics.quartile_not_applicable_count + payload.metrics.quartile_unresolved_count !== payload.metrics.reference_count) throw new Error("ผลรวมสถานะ quartile ไม่ตรง reference_count");
  if (payload.metrics.h_index_available_count + payload.metrics.h_index_not_applicable_count + payload.metrics.h_index_unresolved_count !== payload.metrics.reference_count) throw new Error("ผลรวมสถานะ h-index ไม่ตรง reference_count");
  if (payload.metrics.integrity_retracted_count + payload.metrics.integrity_expression_of_concern_count + payload.metrics.integrity_withdrawn_count + payload.metrics.integrity_corrected_count + payload.metrics.integrity_no_notice_count + payload.metrics.integrity_unresolved_count !== payload.metrics.reference_count) throw new Error("ผลรวมสถานะ publication integrity ไม่ตรง reference_count");
  if (payload.metrics.blind_spot_already_known_count + payload.metrics.blind_spot_new_to_author_count + payload.metrics.blind_spot_rejected_count + payload.metrics.blind_spot_unresolved_count !== payload.metrics.blind_spot_candidate_count) throw new Error("ผลรวมสถานะ blind spot ไม่ตรง blind_spot_candidate_count");
  if (payload.metrics.citation_without_reference_count > payload.metrics.citation_not_checkable_count) throw new Error("citation_without_reference ต้องรวมอยู่ใน citation_not_checkable");
  if (payload.metrics.markdown_reference_count > payload.metrics.pdf_downloaded_count) throw new Error("จำนวน reference Markdown มากกว่า PDF ที่ดาวน์โหลดได้");
  const opportunityCount = payload.metrics.opportunity_candidate_count + payload.metrics.opportunity_weakened_count + payload.metrics.opportunity_rejected_count;
  if (payload.route === "faculty" && (opportunityCount < 1 || opportunityCount > 4)) throw new Error("เส้นทาง faculty ต้องประเมิน opportunity 1–4 ข้อ");
  const alignmentCount = payload.metrics.opportunity_directly_aligned_count + payload.metrics.opportunity_extends_scope_count + payload.metrics.opportunity_tests_boundary_count + payload.metrics.opportunity_adjacent_count + payload.metrics.opportunity_unrelated_count;
  if (alignmentCount !== opportunityCount) throw new Error("ผลรวม paper-alignment relation ไม่ตรงจำนวน opportunity");
  if (payload.metrics.opportunity_author_endorsed_count > opportunityCount) throw new Error("จำนวน opportunity ที่ผู้เขียนรับรองมากกว่าจำนวน opportunity");
  if (payload.metrics.rq_dimension_count > payload.metrics.rq_candidate_count) throw new Error("จำนวนมิติ RQ มากกว่าจำนวน RQ");
  if (payload.metrics.rq_ai_strong_count + payload.metrics.rq_ai_develop_count + payload.metrics.rq_ai_weak_count !== payload.metrics.rq_candidate_count) throw new Error("ผลรวม band คะแนน AI ไม่ตรงจำนวน RQ");
  if (payload.metrics.rq_review_agree_count + payload.metrics.rq_review_partly_agree_count + payload.metrics.rq_review_disagree_count !== payload.metrics.rq_candidate_count) throw new Error("ผลรวมคำตอบต่อ rating ไม่ตรงจำนวน RQ");
  if (payload.metrics.rq_keep_count + payload.metrics.rq_revise_count + payload.metrics.rq_drop_count !== payload.metrics.rq_candidate_count) throw new Error("ผลรวมคำตัดสิน RQ ไม่ตรงจำนวน RQ");
  if (payload.metrics.rq_revised_rating_count > payload.metrics.rq_review_partly_agree_count + payload.metrics.rq_review_disagree_count) throw new Error("revised rating ต้องมาจาก partly agree หรือ disagree");
  if (payload.metrics.rq_new_to_author_count > payload.metrics.rq_candidate_count) throw new Error("RQ ใหม่ต่อผู้เขียนมากกว่าจำนวน RQ");
  if (payload.route === "faculty" && (payload.metrics.rq_candidate_count < 4 || payload.metrics.rq_candidate_count > 8)) throw new Error("เส้นทาง faculty ต้อง review RQ 4–8 ข้อ");
  if (!Array.isArray(payload.artifacts) || payload.artifacts.length < 2 || payload.artifacts.length > 20) throw new Error("artifacts ต้องมี 2–20 รายการ");
  payload.artifacts.forEach((item) => {
    exact(item, ["path", "sha256"], "artifact");
    if (!/^output\/[A-Za-z0-9._/-]+$/.test(item.path) || item.path.split("/").includes("..") || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error("artifact path/hash ไม่ถูกต้อง");
  });
  return payload;
}

function formInteger(name, min, max, label) {
  const raw = text(form.elements[name]?.value);
  return integer(Number(raw), min, max, label);
}

function evaluation() {
  const tokenSource = text(form.elements.token_source.value);
  const rawTokens = text(form.elements.total_tokens.value);
  const totalTokens = rawTokens ? integer(Number(rawTokens), 0, 50000000, "Total tokens") : null;
  if (tokenSource === "not_available" && totalTokens !== null) throw new Error("เลือกไม่มีข้อมูล Token แล้วต้องเว้น Total tokens");
  if (tokenSource !== "not_available" && totalTokens === null) throw new Error("กรอก Total tokens หรือเลือกไม่มีข้อมูล");
  return {
    ai_tool: text(form.elements.ai_tool.value), ai_turns: formInteger("ai_turns", 1, 100, "AI rounds"), retry_count: formInteger("retry_count", 0, 50, "Retries"), completion_minutes: formInteger("completion_minutes", 1, 2400, "เวลา"), token_source: tokenSource, total_tokens: totalTokens,
    completion_status: text(form.elements.completion_status.value), difficulty_rating: formInteger("difficulty_rating", 1, 5, "ความยาก"), usefulness_rating: formInteger("usefulness_rating", 1, 5, "ประโยชน์"), hardest_step: text(form.elements.hardest_step.value),
  };
}

async function requireOpenClass(classCode) {
  const response = await fetch(`${classStatusBase}/${encodeURIComponent(classCode)}/status`, { credentials: "same-origin" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "ตรวจสถานะคลาสไม่ได้");
  if (!payload.is_open) throw new Error("Module 3 ของคลาสนี้ยังไม่เปิดรับสถานะ");
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault(); checkedEnvelope = null; preview.hidden = true; receipt.hidden = true; sendButton.disabled = true;
  try {
    if (!form.reportValidity()) throw new Error("กรอกข้อมูลให้ครบ");
    const classCode = safeCode(form.elements.class_code.value, "รหัสคลาส");
    const callsign = safeCode(form.elements.callsign.value, "Call sign");
    await requireOpenClass(classCode);
    const file = form.elements.json_file.files[0];
    if (!file || file.name !== "module-3-completion.json" || file.size > 64000) throw new Error("เลือก module-3-completion.json ขนาดไม่เกิน 64 KB");
    const progress = validateCompletion(JSON.parse(await file.text()));
    checkedEnvelope = { event_type: "ai_for_research_module_3_progress", submission_id: crypto.randomUUID(), class_code: classCode, callsign, callsign_key: text(form.elements.callsign_key.value) || localStorage.getItem(storageKey(classCode, callsign)) || null, client_submitted_at: new Date().toISOString(), module_evaluation: evaluation(), progress };
    previewCode.textContent = JSON.stringify(checkedEnvelope, null, 2); preview.hidden = false; sendButton.disabled = false; statusNode.textContent = "ตรวจ Progress JSON ผ่านแล้ว กรุณาอ่าน preview ก่อนส่ง";
  } catch (error) { statusNode.textContent = `ยังส่งไม่ได้: ${error.message}`; }
});

sendButton?.addEventListener("click", async () => {
  if (!checkedEnvelope) return; sendButton.disabled = true;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(checkedEnvelope) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== "accepted") throw new Error(result.detail || "Server ไม่รับสถานะ");
    localStorage.setItem(storageKey(checkedEnvelope.class_code, checkedEnvelope.callsign), result.callsign_key);
    latestReceipt = { status: "accepted", module_id: "module-3", submission_id: checkedEnvelope.submission_id, class_code: checkedEnvelope.class_code, callsign: checkedEnvelope.callsign, callsign_key: result.callsign_key, route: checkedEnvelope.progress.route, attempt_count: result.attempt_count, submitted_at: result.received_at };
    receiptCode.textContent = JSON.stringify(latestReceipt, null, 2); receipt.hidden = false; statusNode.textContent = "ส่งสถานะสำเร็จแล้ว";
  } catch (error) { sendButton.disabled = false; statusNode.textContent = `ส่งไม่สำเร็จ: ${error.message}`; }
});

receiptDownload?.addEventListener("click", () => {
  if (!latestReceipt) return;
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`${JSON.stringify(latestReceipt, null, 2)}\n`], { type: "application/json" })); link.download = `module-3-receipt-${latestReceipt.submission_id}.json`; link.click(); URL.revokeObjectURL(link.href);
});

form?.elements.token_source?.addEventListener("change", () => { const unavailable = form.elements.token_source.value === "not_available"; form.elements.total_tokens.disabled = unavailable; if (unavailable) form.elements.total_tokens.value = ""; });
