// Fill what the page already knows on Module 2/3 progress forms so learners only
// answer what they can: class code from the classroom URL, a reserved call sign,
// the AI chosen in Module 1, and an elapsed-time suggestion they can edit.
(function submissionDefaults(globalObject) {
  "use strict";

  const forms = [...document.querySelectorAll("[data-module-2-submission-form], [data-module-3-submission-form]")];
  if (!forms.length) return;

  const codePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/;
  const store = {
    get(key) { try { return globalObject.localStorage.getItem(key) || ""; } catch (_error) { return ""; } },
    set(key, value) { try { globalObject.localStorage.setItem(key, value); } catch (_error) { /* Defaults still apply to this view. */ } },
  };

  function classroomId() {
    const query = new URLSearchParams(globalObject.location.search).get("classroom_id") || "";
    const path = globalObject.location.pathname.match(/\/classrooms\/([A-Za-z0-9][A-Za-z0-9._-]{2,63})\/content\//)?.[1] || "";
    const value = query || path;
    return codePattern.test(value) ? value : "";
  }

  function reservedCallsign(classCode) {
    const key = `ai-for-research.callsign:${classCode}`;
    let callsign = store.get(key);
    if (!codePattern.test(callsign)) {
      const colors = ["green", "blue", "amber", "silver", "violet", "teal", "coral", "indigo"];
      const things = ["orbit", "river", "hill", "leaf", "spark", "wave", "stone", "cloud"];
      const random = globalObject.crypto.getRandomValues(new Uint32Array(3));
      callsign = `${colors[random[0] % colors.length]}-${things[random[1] % things.length]}-${(random[2] % 90) + 10}`;
      store.set(key, callsign);
    }
    return callsign;
  }

  function moveIntoDetails(form, names, summaryText) {
    const labels = names.map((name) => form.elements[name]?.closest("label")).filter(Boolean);
    if (!labels.length) return;
    const details = document.createElement("details");
    details.className = "fallback-details submission-identity";
    const summary = document.createElement("summary");
    summary.textContent = summaryText;
    details.append(summary);
    labels[0].before(details);
    labels.forEach((label) => details.append(label));
  }

  const classCode = classroomId();
  forms.forEach((form) => {
    const moduleNumber = form.matches("[data-module-2-submission-form]") ? 2 : 3;

    if (classCode && form.elements.class_code) {
      form.elements.class_code.value = classCode;
      form.elements.class_code.closest("label").hidden = true;
      if (form.elements.callsign && !form.elements.callsign.value) form.elements.callsign.value = reservedCallsign(classCode);
      moveIntoDetails(form, ["callsign", "callsign_key"], "ส่งจากเครื่องอื่น หรือใช้ call sign เดิม");
    }

    const aiTool = form.elements.ai_tool;
    const preferred = store.get("ai-research-agent");
    if (aiTool && !aiTool.value && [...aiTool.options].some((option) => option.value === preferred)) aiTool.value = preferred;

    const startedKey = `ai-for-research.module-${moduleNumber}.started-at`;
    let startedAt = Number(store.get(startedKey)) || 0;
    if (!startedAt) {
      startedAt = Date.now();
      store.set(startedKey, String(startedAt));
    }
    form.addEventListener("focusin", () => {
      const input = form.elements.completion_minutes;
      if (!input || input.value) return;
      const minutes = Math.round((Date.now() - startedAt) / 60000);
      if (minutes >= 1 && minutes <= Number(input.max || 600)) input.value = String(minutes);
    }, { once: true });
  });
})(window);
