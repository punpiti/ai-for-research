(function module1Submission(globalObject) {
  "use strict";

  const schemaVersion = "ai-for-research.module-1-progress.v1";
  const endpoint = "/api/ai-for-research/module-1/submissions";
  const checkNames = [
    "workspace_opened",
    "ai_connected",
    "folder_boundary_understood",
    "text_file_created_and_opened",
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

  // Self-review: ticking all checkpoints shows "ผ่าน" at once. Nobody grades it; no AI needed.
  const passNode = document.querySelector("[data-module-1-pass]");
  const checkBoxes = checkNames.map((name) => document.querySelector(`[data-module-1-check="${name}"]`)).filter(Boolean);
  const allTicked = () => checkBoxes.length === checkNames.length && checkBoxes.every((box) => box.checked);

  const form = document.querySelector("[data-module-1-submission-form]");
  const doneButton = form?.querySelector("[data-module-1-done]");
  const notDoneButton = form?.querySelector("[data-module-1-not-done]");
  let classroomsReady = false;
  let sending = false;
  function refresh() {
    if (passNode) passNode.hidden = !allTicked();
    if (doneButton) doneButton.disabled = sending || !classroomsReady || !allTicked();
    if (notDoneButton) notDoneButton.disabled = sending || !classroomsReady;
  }
  checkBoxes.forEach((box) => box.addEventListener("change", refresh));
  // app.js restores saved ticks on load; check again once it has run.
  globalObject.addEventListener("load", refresh);
  refresh();
  if (!form) return;

  const statusNode = document.querySelector("[data-module-1-submission-status]");
  const receipt = document.querySelector("[data-module-1-receipt]");
  const classroomSelect = form.elements.classroom_id;
  const classroomField = form.querySelector("[data-module-1-classroom-field]");

  function showStatus(message, isError = false) {
    statusNode.textContent = message;
    statusNode.classList.toggle("is-error", isError);
  }

  function loginUrl() {
    const requestedClassroom = new URLSearchParams(globalObject.location.search).get("classroom_id")
      || new URLSearchParams(globalObject.location.search).get("classroom");
    const next = requestedClassroom ? `prepare.html?classroom=${encodeURIComponent(requestedClassroom)}` : "prepare.html";
    return `login.html?next=${encodeURIComponent(next)}`;
  }

  async function loadClassrooms() {
    try {
      const response = await fetch("/api/ai-for-research/classrooms/me", { credentials: "same-origin" });
      if (response.status === 401) {
        statusNode.replaceChildren(document.createTextNode("เข้าสู่ระบบก่อนแจ้งผู้สอน "));
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
      const requested = new URLSearchParams(globalObject.location.search).get("classroom_id")
        || new URLSearchParams(globalObject.location.search).get("classroom");
      if (requested && classrooms.some((item) => item.classroom_id === requested)) classroomSelect.value = requested;
      else if (classrooms.length === 1) classroomSelect.value = classrooms[0].classroom_id;
      if (!classrooms.length) throw new Error("ยังไม่มีคลาสที่อนุมัติให้คุณส่งงาน");
      // Ask for the class only when it cannot be chosen automatically.
      if (classroomField) classroomField.hidden = Boolean(classroomSelect.value);
      classroomsReady = true;
      showStatus(allTicked() ? "พร้อมแจ้งผู้สอน" : "ติ๊กให้ครบ 4 ข้อก่อน หรือแจ้งว่ายังทำไม่สำเร็จ");
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      refresh();
    }
  }

  // Rough minutes since the first visit to this page; the server needs 1–600.
  const startedKey = "ai-for-research.module-1.started-at";
  let startedAt = 0;
  try {
    startedAt = Number(globalObject.localStorage.getItem(startedKey)) || 0;
    if (!startedAt) {
      startedAt = Date.now();
      globalObject.localStorage.setItem(startedKey, String(startedAt));
    }
  } catch (_error) { startedAt = 0; }
  function estimatedMinutes() {
    if (!startedAt) return 1;
    return Math.max(1, Math.min(600, Math.round((Date.now() - startedAt) / 60000)));
  }

  checkBoxes.forEach((box) => box.addEventListener("change", () => {
    if (classroomsReady) showStatus(allTicked() ? "พร้อมแจ้งผู้สอน" : "ติ๊กให้ครบ 4 ข้อก่อน หรือแจ้งว่ายังทำไม่สำเร็จ");
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    receipt.hidden = true;
    const completionStatus = event.submitter?.value === "could_not_complete" ? "could_not_complete" : "completed";
    try {
      if (!classroomSelect.value) {
        if (classroomField) classroomField.hidden = false;
        throw new Error("เลือกคลาสก่อน");
      }
      const checks = Object.fromEntries(checkNames.map((name) => [
        name,
        document.querySelector(`[data-module-1-check="${name}"]`)?.checked === true,
      ]));
      const selectedAgent = document.querySelector('input[name="agent"]:checked')?.value || "unknown";
      const envelope = buildEnvelope({
        classroomId: classroomSelect.value,
        completionStatus,
        aiTool: aiTools.includes(selectedAgent) ? selectedAgent : "unknown",
        completionMinutes: estimatedMinutes(),
        tokenSource: "not_available",
        checks,
      });
      sending = true;
      refresh();
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
      sending = false;
      refresh();
    }
  });

  loadClassrooms();
})(typeof window !== "undefined" ? window : globalThis);
