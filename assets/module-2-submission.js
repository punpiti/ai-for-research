const submissionForm = document.querySelector("[data-module-2-submission-form]");
const previewSection = document.querySelector("[data-module-2-submission-preview]");
const previewCode = document.querySelector("[data-module-2-submission-json]");
const submissionStatus = document.querySelector("[data-module-2-submission-status]");
const sendButton = document.querySelector("[data-module-2-submit]");
const receiptSection = document.querySelector("[data-module-2-receipt]");
const receiptCode = document.querySelector("[data-module-2-receipt-json]");
const receiptDownload = document.querySelector("[data-module-2-receipt-download]");

const submissionEndpoint = "/api/log";
const schemaVersion = "ai-for-research.module-2-submission.v1";
const eventType = "ai_for_research_module_2_submission";
const maxMarkdownBytes = 32000;
const maxJsonBytes = 64000;
let checkedPayload = null;
let latestReceipt = null;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value, minimum, label) {
  if (!Array.isArray(value) || value.length < minimum || value.length > 10) {
    throw new Error(`${label} ต้องมี ${minimum}–10 รายการ`);
  }
  if (value.some((item) => text(item).length < 10 || text(item).length > 800)) {
    throw new Error(`${label} แต่ละรายการต้องยาว 10–800 ตัวอักษร`);
  }
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
  requireExactKeys(payload, ["schema_version", "module_id", "artifact", "learning", "self_check"], "JSON ระดับบนสุด");
  if (payload.schema_version !== schemaVersion || payload.module_id !== "module-2") throw new Error("schema_version หรือ module_id ไม่ตรงกับ Module 2");
  const artifact = payload.artifact || {};
  requireExactKeys(artifact, ["markdown_filename", "markdown_sha256", "markdown_content"], "artifact");
  if (artifact.markdown_filename !== "module-2-conclusion.md") throw new Error("ชื่อไฟล์ Markdown ต้องเป็น module-2-conclusion.md");
  if (!/^[a-f0-9]{64}$/.test(text(artifact.markdown_sha256))) throw new Error("markdown_sha256 ต้องเป็น SHA-256 ตัวพิมพ์เล็ก 64 ตัว");
  requireText(artifact.markdown_content, 200, 30000, "เนื้อหา Markdown");

  const learning = payload.learning || {};
  requireExactKeys(learning, ["question", "conclusion", "supported_claims", "unsupported_claims", "format_findings", "web_provenance", "prompt_revision", "human_decision"], "learning");
  requireText(learning.question, 20, 500, "คำถาม");
  requireText(learning.conclusion, 80, 3000, "ข้อสรุป");
  stringArray(learning.supported_claims, 2, "ข้ออ้างที่มีหลักฐาน");
  stringArray(learning.unsupported_claims, 1, "ข้ออ้างที่ยังไม่มีหลักฐาน");
  stringArray(learning.format_findings, 2, "ข้อค้นพบจากชนิดไฟล์");
  requireText(learning.web_provenance, 20, 1500, "หลักฐานจากเว็บ");
  requireText(learning.prompt_revision, 40, 3000, "สิ่งที่ปรับใน Prompt");
  requireText(learning.human_decision, 40, 2000, "สิ่งที่มนุษย์ต้องตัดสินใจ");

  const checks = payload.self_check || {};
  requireExactKeys(checks, ["originals_preserved", "cross_format_checked", "web_provenance_recorded", "claims_verified", "no_personal_data"], "self_check");
  for (const key of ["originals_preserved", "cross_format_checked", "web_provenance_recorded", "claims_verified", "no_personal_data"]) {
    if (checks[key] !== true) throw new Error(`self_check.${key} ต้องเป็น true`);
  }
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
    if (markdownHash !== payload.artifact.markdown_sha256) throw new Error("SHA-256 ใน JSON ไม่ตรงกับไฟล์ Markdown ที่เลือก");
    if (markdownText !== payload.artifact.markdown_content) throw new Error("เนื้อหา Markdown ใน JSON ไม่ตรงกับไฟล์ที่เลือก");

    checkedPayload = {
      event_type: eventType,
      submission_id: crypto.randomUUID(),
      class_code: safeCode(submissionForm.elements.class_code.value, "รหัสคลาส"),
      learner_code: safeCode(submissionForm.elements.learner_code.value, "รหัสผู้เรียน"),
      client_submitted_at: new Date().toISOString(),
      submission: payload,
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
    if (!response.ok || result.status !== "ok") throw new Error(`เซิร์ฟเวอร์ไม่รับข้อมูล (${response.status})`);
    latestReceipt = {
      status: "accepted",
      module_id: "module-2",
      submission_id: checkedPayload.submission_id,
      class_code: checkedPayload.class_code,
      learner_code: checkedPayload.learner_code,
      markdown_sha256: checkedPayload.submission.artifact.markdown_sha256,
      submitted_at: new Date().toISOString(),
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

receiptDownload?.addEventListener("click", () => {
  if (!latestReceipt) return;
  const blob = new Blob([`${JSON.stringify(latestReceipt, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `module-2-receipt-${latestReceipt.submission_id}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
