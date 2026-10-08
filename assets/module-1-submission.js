(function module1Submission(globalObject) {
  "use strict";

  const schemaVersion = "ai-for-research.module-1-progress.v1";
  const endpoint = "/api/ai-for-research/module-1/submissions";
  const checkNames = [
    "workspace_opened",
    "ai_connected",
    "folder_boundary_understood",
    "pdf_created_and_opened",
  ];
  const completionStatuses = ["completed", "completed_with_help", "could_not_complete"];
  const aiTools = ["codex", "claude", "openrouter", "other", "unknown"];
  const tokenSources = ["provider_reported", "learner_estimate", "not_available"];

  function integer(value, minimum, maximum, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < minimum || number > maximum) {
      throw new Error(`${label} ต้องเป็นจำนวนเต็ม ${minimum}–${maximum}`);
    }
    return number;
  }

  function buildEnvelope(input) {
    const classroomId = String(input.classroomId || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(classroomId)) throw new Error("เลือกคลาสก่อนส่ง");
    if (!completionStatuses.includes(input.completionStatus)) throw new Error("เลือกสถานะการทำ Module 1");
    if (!aiTools.includes(input.aiTool)) throw new Error("เลือก AI ที่ใช้");
    if (!tokenSources.includes(input.tokenSource)) throw new Error("เลือกแหล่งข้อมูล Token");
    const checks = Object.fromEntries(checkNames.map((name) => [name, input.checks?.[name] === true]));
    if (input.completionStatus !== "could_not_complete" && !Object.values(checks).every(Boolean)) {
      throw new Error("ติ๊ก Checkpoint ให้ครบ หรือเลือกว่ายังทำไม่สำเร็จ");
    }
    const totalTokens = input.tokenSource === "not_available"
      ? null
      : integer(input.totalTokens, 0, 20000000, "Total tokens");
    return {
      event_type: "ai_for_research_module_1_progress",
      submission_id: globalObject.crypto.randomUUID(),
      classroom_id: classroomId,
      client_submitted_at: new Date().toISOString(),
      progress: {
        schema_version: schemaVersion,
        module_id: "module-1",
        checks,
        completion_status: input.completionStatus,
        ai_tool: input.aiTool,
        completion_minutes: integer(input.completionMinutes, 1, 600, "เวลาที่ใช้"),
        token_source: input.tokenSource,
        total_tokens: totalTokens,
      },
    };
  }

  const testApi = { schemaVersion, endpoint, checkNames, buildEnvelope };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.module1SubmissionTestApi = testApi;
  if (typeof document === "undefined") return;

  const form = document.querySelector("[data-module-1-submission-form]");
  if (!form) return;
  const statusNode = document.querySelector("[data-module-1-submission-status]");
  const receipt = document.querySelector("[data-module-1-receipt]");
  const classroomSelect = form.elements.classroom_id;
  const sendButton = form.querySelector('button[type="submit"]');

  function showStatus(message, isError = false) {
    statusNode.textContent = message;
    statusNode.classList.toggle("is-error", isError);
  }

  function loginUrl() {
    const requestedClassroom = new URLSearchParams(globalObject.location.search).get("classroom");
    const next = requestedClassroom ? `prepare.html?classroom=${encodeURIComponent(requestedClassroom)}` : "prepare.html";
    return `login.html?next=${encodeURIComponent(next)}`;
  }

  async function loadClassrooms() {
    sendButton.disabled = true;
    try {
      const response = await fetch("/api/ai-for-research/classrooms/me", { credentials: "same-origin" });
      if (response.status === 401) {
        statusNode.replaceChildren(document.createTextNode("เข้าสู่ระบบก่อนส่งสถานะ "));
        const link = document.createElement("a");
        link.href = loginUrl();
        link.textContent = "เข้าสู่ระบบ";
        statusNode.append(link);
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "โหลดรายชื่อคลาสไม่ได้");
      const classrooms = (payload.classrooms || []).filter((item) => item.status === "active");
      classroomSelect.replaceChildren(new Option("เลือกคลาส", ""));
      classrooms.forEach((item) => classroomSelect.add(new Option(item.classroom_id, item.classroom_id)));
      const requested = new URLSearchParams(globalObject.location.search).get("classroom");
      if (requested && classrooms.some((item) => item.classroom_id === requested)) classroomSelect.value = requested;
      else if (classrooms.length === 1) classroomSelect.value = classrooms[0].classroom_id;
      if (!classrooms.length) throw new Error("ยังไม่มีคลาสที่อนุมัติให้คุณส่งงาน");
      sendButton.disabled = false;
      showStatus("พร้อมส่งสถานะให้ผู้สอน");
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  form.elements.token_source.addEventListener("change", () => {
    const unavailable = form.elements.token_source.value === "not_available";
    form.elements.total_tokens.disabled = unavailable;
    form.elements.total_tokens.required = !unavailable;
    if (unavailable) form.elements.total_tokens.value = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    receipt.hidden = true;
    try {
      if (!form.reportValidity()) throw new Error("กรอกข้อมูลให้ครบ");
      const checks = Object.fromEntries(checkNames.map((name) => [
        name,
        document.querySelector(`[data-module-1-check="${name}"]`)?.checked === true,
      ]));
      const selectedAgent = document.querySelector('input[name="agent"]:checked')?.value || "unknown";
      const envelope = buildEnvelope({
        classroomId: classroomSelect.value,
        completionStatus: form.elements.completion_status.value,
        aiTool: selectedAgent,
        completionMinutes: form.elements.completion_minutes.value,
        tokenSource: form.elements.token_source.value,
        totalTokens: form.elements.total_tokens.value,
        checks,
      });
      sendButton.disabled = true;
      showStatus("กำลังส่ง…");
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        globalObject.location.assign(loginUrl());
        return;
      }
      if (!response.ok || result.status !== "accepted") throw new Error(result.detail || "Server ไม่รับสถานะ");
      receipt.textContent = `ส่งแล้ว · ครั้งที่ ${result.attempt_count} · ${new Date(result.received_at).toLocaleString("th-TH")}`;
      receipt.hidden = false;
      showStatus("ผู้สอนเห็นสถานะ Module 1 แล้ว");
    } catch (error) {
      showStatus(`ยังส่งไม่ได้: ${error.message}`, true);
    } finally {
      sendButton.disabled = false;
    }
  });

  loadClassrooms();
})(typeof window !== "undefined" ? window : globalThis);
