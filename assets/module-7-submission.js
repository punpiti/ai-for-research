(() => {
  "use strict";

  const form = document.querySelector("[data-module-7-submission-form]");
  const endpoint = "/api/ai-for-research/module-7/submissions";
  const classStatusBase = "/api/ai-for-research/module-7/classes";
  const expectedFilename = "module-07-highlights.md";
  const maxFileBytes = 64 * 1024;
  let checkedEnvelope = null;
  let latestReceipt = null;

  const text = (value) => String(value ?? "").trim();
  const safeCode = (value, label) => {
    const clean = text(value);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(clean)) throw new Error(`${label} ต้องมี 3–40 ตัวอักษรที่ปลอดภัย`);
    return clean;
  };
  const integer = (value, min, max, label) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} ต้องอยู่ระหว่าง ${min}–${max}`);
    return number;
  };
  const storageKey = (classCode, callsign) => `ai-for-research:module-7:${classCode}:${callsign}:callsign-key`;

  function section(markdown, heading) {
    const match = markdown.match(new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, "mi"));
    return match ? match[1].trim() : "";
  }

  function validateMarkdown(markdown) {
    const source = text(markdown);
    const size = new TextEncoder().encode(source).length;
    if (size > maxFileBytes) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 64 KB");
    if (size < 400) throw new Error("ไฟล์สั้นเกินไปสำหรับ highlights พร้อมหลักฐานและข้อสรุป");
    const headings = ["คำถามที่สำรวจ", "Highlights", "กราฟที่เลือก", "ข้อสรุป", "ข้อจำกัดและสิ่งที่ยังสรุปไม่ได้"];
    const missing = headings.filter((heading) => !new RegExp(`^##\\s+${heading}\\s*$`, "mi").test(source));
    if (missing.length) throw new Error(`ขาดหัวข้อ: ${missing.join(", ")}`);
    const highlightSection = section(source, "Highlights");
    const highlightCount = (highlightSection.match(/^\s*(?:[-*]|\d+[.)])\s+\S+/gm) || []).length;
    if (highlightCount < 3 || highlightCount > 5) throw new Error("หัวข้อ Highlights ต้องมี 3–5 ข้อ");
    const conclusion = section(source, "ข้อสรุป");
    if (conclusion.length < 40) throw new Error("ข้อสรุปต้องเป็นข้อความที่ชัดเจนอย่างน้อย 40 ตัวอักษร");
    return { highlightCount, conclusionCharacters: conclusion.length };
  }

  async function sha256(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function requireOpenClass(classCode) {
    const response = await fetch(`${classStatusBase}/${encodeURIComponent(classCode)}/status`, { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || "ตรวจสถานะคลาสไม่ได้");
    if (!payload.is_open) throw new Error("Module 7 ของคลาสนี้ยังไม่เปิดรับงาน");
  }

  globalThis.module7SubmissionTestApi = { validateMarkdown, safeCode, integer };
  if (!form) return;
  const checkButton = form.querySelector("[data-module-7-check]");
  const submitButton = form.querySelector("[data-module-7-submit]");
  const receiptButton = form.querySelector("[data-module-7-receipt]");
  const statusNode = form.querySelector("[data-module-7-submission-status]");
  const preview = form.querySelector("[data-module-7-submission-preview]");

  checkButton?.addEventListener("click", async () => {
    checkedEnvelope = null;
    latestReceipt = null;
    submitButton.disabled = true;
    receiptButton.disabled = true;
    preview.hidden = true;
    try {
      if (!form.reportValidity()) throw new Error("กรอกข้อมูลและยืนยันรายการให้ครบ");
      const classCode = safeCode(form.elements.class_code.value, "รหัสคลาส");
      const callsign = safeCode(form.elements.callsign.value, "Call sign");
      const file = form.elements.markdown_file.files[0];
      if (!file || file.name !== expectedFilename) throw new Error(`เลือกไฟล์ชื่อ ${expectedFilename}`);
      if (file.size > maxFileBytes) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 64 KB");
      const markdown = await file.text();
      const inspection = validateMarkdown(markdown);
      const highlightCount = integer(form.elements.highlight_count.value, 3, 5, "จำนวน highlights");
      const chartCount = integer(form.elements.chart_count.value, 1, 10, "จำนวนกราฟ");
      if (highlightCount !== inspection.highlightCount) throw new Error("จำนวน highlights ที่กรอกไม่ตรงกับรายการในไฟล์");
      await requireOpenClass(classCode);
      checkedEnvelope = {
        event_type: "ai_for_research_module_7_highlights",
        submission_id: crypto.randomUUID(),
        class_code: classCode,
        callsign,
        callsign_key: text(form.elements.callsign_key.value) || localStorage.getItem(storageKey(classCode, callsign)) || null,
        client_submitted_at: new Date().toISOString(),
        artifact: {
          filename: expectedFilename,
          sha256: await sha256(markdown),
          markdown,
          highlight_count: highlightCount,
          chart_count: chartCount,
          ai_used: form.elements.ai_used.value,
          evidence_confirmed: form.elements.evidence_confirmed.checked,
          conclusion_confirmed: form.elements.conclusion_confirmed.checked,
          no_sensitive_data_confirmed: form.elements.no_sensitive_data_confirmed.checked,
        },
      };
      preview.textContent = JSON.stringify({ ...checkedEnvelope, artifact: { ...checkedEnvelope.artifact, markdown: `[Markdown ${file.size} bytes]` } }, null, 2);
      preview.hidden = false;
      submitButton.disabled = false;
      statusNode.textContent = "ตรวจไฟล์ผ่านแล้ว กรุณาอ่านสรุปก่อนส่ง";
    } catch (error) {
      statusNode.textContent = `ยังส่งไม่ได้: ${error.message}`;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!checkedEnvelope) return;
    submitButton.disabled = true;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(checkedEnvelope) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.review_status !== "pending_review") throw new Error(result.detail || "Server ไม่รับงาน");
      localStorage.setItem(storageKey(checkedEnvelope.class_code, checkedEnvelope.callsign), result.callsign_key);
      latestReceipt = { module_id: "module-7", submission_id: checkedEnvelope.submission_id, class_code: checkedEnvelope.class_code, callsign: checkedEnvelope.callsign, callsign_key: result.callsign_key, review_status: result.review_status, attempt_count: result.attempt_count, received_at: result.received_at };
      receiptButton.disabled = false;
      statusNode.textContent = "ระบบรับ highlights แล้ว สถานะ pending_review; งานยังไม่ผ่านจนกว่าผู้สอนจะอนุมัติ";
    } catch (error) {
      submitButton.disabled = false;
      statusNode.textContent = `ส่งไม่สำเร็จ: ${error.message}`;
    }
  });

  receiptButton?.addEventListener("click", () => {
    if (!latestReceipt) return;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(latestReceipt, null, 2)}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `module-7-receipt-${latestReceipt.submission_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
})();
