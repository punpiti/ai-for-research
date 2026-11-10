(() => {
  "use strict";

  const form = document.querySelector("[data-module-7-submission-form]");
  const endpoint = "/api/ai-for-research/module-7/submissions";
  const classStatusBase = "/api/ai-for-research/module-7/classes";
  const expectedFilename = "module-07-figure-audit.md";
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

  function validateMarkdown(markdown) {
    const source = text(markdown);
    if (new TextEncoder().encode(source).length > maxFileBytes) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 64 KB");
    if (source.length < 800) throw new Error("คำตอบสั้นเกินไปสำหรับการตรวจหลักฐานข้ามรูป");
    const headings = [
      "Executive diagnosis", "Cross-figure issue ledger", "Required reconciliation checks",
      "Minimum corrected claim", "Revision plan", "Human–AI comparison", "Final declaration",
    ];
    const missing = headings.filter((heading) => !new RegExp(`^##\\s+${heading}\\s*$`, "mi").test(source));
    if (missing.length) throw new Error(`ขาดหัวข้อ: ${missing.join(", ")}`);
    const ids = [...source.matchAll(/^\|\s*(C\d{2})\s*\|/gmi)].map((match) => match[1].toUpperCase());
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length < 6) throw new Error("Issue ledger ต้องมีประเด็น C01 เป็นต้นไปอย่างน้อย 6 ประเด็น");
    const completedDeclarations = (source.match(/^\s*-\s*\[[xX]\]\s+/gm) || []).length;
    if (completedDeclarations < 5) throw new Error("ทำ Final declaration ให้ครบทั้ง 5 ข้อ");
    return { issueRows: uniqueIds.length, completedDeclarations };
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
      const issueCount = integer(form.elements.issue_count.value, 6, 20, "จำนวนประเด็น");
      const crossFigureCount = integer(form.elements.cross_figure_count.value, 4, issueCount, "ประเด็นข้ามตำแหน่ง");
      const dataCheckCount = integer(form.elements.data_check_count.value, 3, 20, "ค่าที่ตรวจจาก CSV");
      if (issueCount > inspection.issueRows) throw new Error("จำนวนประเด็นที่กรอกมากกว่าแถว Cxx ที่พบในไฟล์");
      await requireOpenClass(classCode);
      checkedEnvelope = {
        event_type: "ai_for_research_module_7_figure_audit",
        submission_id: crypto.randomUUID(),
        class_code: classCode,
        callsign,
        callsign_key: text(form.elements.callsign_key.value) || localStorage.getItem(storageKey(classCode, callsign)) || null,
        client_submitted_at: new Date().toISOString(),
        artifact: {
          filename: expectedFilename,
          sha256: await sha256(markdown),
          markdown,
          issue_count: issueCount,
          cross_figure_count: crossFigureCount,
          data_check_count: dataCheckCount,
          ai_used: form.elements.ai_used.value,
          human_first_confirmed: form.elements.human_first_confirmed.checked,
          mock_only_confirmed: form.elements.mock_only_confirmed.checked,
          final_declaration_confirmed: form.elements.final_declaration_confirmed.checked,
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
      statusNode.textContent = "ระบบรับงานแล้ว สถานะ pending_review; งานยังไม่ผ่านจนกว่าผู้สอนจะอนุมัติ";
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
