(function () {
  "use strict";

  const storageKey = "ai-for-research.module-2.steps.v1";
  const stages = [
    { id: "prepare", short: "ลองถาม", title: "ใช้ Prompt สั้นแล้วดูคำตอบ" },
    { id: "concepts", short: "เพิ่มกติกา", title: "เพิ่มกติกาแล้วเทียบคำตอบ" },
    { id: "practice", short: "ดูผลงาน", title: "สร้างและปรับผลงานด้วย Prompt" },
    { id: "submit", short: "ทำต่อเอง", title: "เตรียมเรื่องของคุณแล้วทำซ้ำ" },
  ];

  function applyEvidenceSetChoice() {
    document.documentElement.dataset.module2EvidenceSet = "sample";
  }

  function facultyRoute() { return false; }

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        completed: saved.completed && typeof saved.completed === "object" ? saved.completed : {},
        answers: saved.answers && typeof saved.answers === "object" ? saved.answers : {},
        active: stages.some((stage) => stage.id === saved.active) ? saved.active : "prepare",
      };
    } catch (_) {
      return { completed: {}, answers: {}, active: "prepare" };
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {
      // The lesson still works when private browsing blocks local storage.
    }
  }

  function stageUnlocked(index, state) {
    return true; // All stages can be viewed during the demonstration; completion stays explicit.
  }

  function validateCheckpoint(stageId, values) {
    if (stageId === "prepare") {
      return values.evidence_ready === true
        ? { ok: true, message: "บันทึกแล้ว: ชุดหลักฐานพร้อมใช้งาน" }
        : { ok: false, message: facultyRoute() ? "เตรียมหลักฐานจากงานของคุณใน module-02-work/input/original/ แล้วติ๊กยืนยันก่อน" : "วางไฟล์ ZIP ใน module-02-work/input/original/ แล้วติ๊กยืนยันก่อน" };
    }
    if (stageId === "concepts") {
      return values.level === "L4"
        ? { ok: true, message: "ถูกต้อง — ข้อสรุปที่หลักฐานยังยืนยันไม่ได้คือ L4" }
        : { ok: false, message: facultyRoute() ? "ยังไม่ถูก ข้อความที่หลักฐานยังยืนยันไม่ได้ต้องอยู่ L4" : "ยังไม่ถูก ลองดูว่าหลักฐานยืนยันคำว่า “ทุกคน” ได้หรือไม่" };
    }
    if (stageId === "practice") {
      const names = ["round1_traceable", "round1_unsupported", "round2_traceable", "round2_unsupported"];
      const counts = Object.fromEntries(names.map((name) => [name, Number(values[name])]));
      if (names.some((name) => !Number.isInteger(counts[name]) || counts[name] < 0 || counts[name] > 10)) {
        return { ok: false, message: "กรอกทุกช่องเป็นจำนวนเต็ม 0–10" };
      }
      const firstTotal = counts.round1_traceable + counts.round1_unsupported;
      const secondTotal = counts.round2_traceable + counts.round2_unsupported;
      if (firstTotal < 8 || firstTotal > 10 || secondTotal < 8 || secondTotal > 10) {
        return { ok: false, message: "แต่ละรอบต้องนับ Claims รวม 8–10 ข้อ" };
      }
      const delta = counts.round2_traceable - counts.round1_traceable;
      const comparison = delta > 0 ? `รอบสองตรวจย้อนกลับได้เพิ่ม ${delta} ข้อ` : delta < 0 ? `รอบสองตรวจย้อนกลับได้น้อยลง ${Math.abs(delta)} ข้อ` : "ทั้งสองรอบตรวจย้อนกลับได้เท่ากัน";
      return { ok: true, message: `บันทึกแล้ว: ${comparison}` };
    }
    return { ok: true, message: "" };
  }

  function checkpointMarkup(stageId, saved) {
    if (stageId === "prepare") {
      const label = facultyRoute()
        ? "เตรียมหลักฐานห้ารูปแบบจากงานของฉันใน <code>module-02-work/input/original/module-02-own-evidence/</code> แล้ว"
        : "วาง <code>module-02-food-evidence.zip</code> ใน <code>module-02-work/input/original/</code> แล้ว";
      return `<label class="module-step-confirm"><input type="checkbox" name="evidence_ready" ${saved.evidence_ready ? "checked" : ""}> <span>${label}</span></label>`;
    }
    if (stageId === "concepts") {
      const options = ["L1", "L2", "L3", "L4"].map((level) => `<label><input type="radio" name="level" value="${level}" ${saved.level === level ? "checked" : ""}> ${level}</label>`).join("");
      const question = facultyRoute()
        ? "ข้อความที่ดูสมเหตุสมผล แต่เอกสารชุดนี้ยังยืนยันไม่ได้ ควรจัดระดับใด?"
        : "“ทุกคนจะอิ่มถึง 16:00” เมื่อหลักฐานยังยืนยันไม่ได้ ควรจัดระดับใด?";
      return `<fieldset><legend>${question}</legend><div class="module-step-options">${options}</div></fieldset>`;
    }
    if (stageId === "practice") {
      const input = (name, label) => `<label><span>${label}</span><input type="number" name="${name}" min="0" max="10" required value="${saved[name] ?? ""}"></label>`;
      return `<p>ใช้ผลจากขั้นเปรียบเทียบสองรอบ: เปิดคำตอบรอบแรกและรอบสอง แล้วนับว่าแต่ละรอบมีกี่ข้อที่ระบุไฟล์และตำแหน่งได้ (ตรวจย้อนกลับได้) และกี่ข้อที่ไม่มีหลักฐาน</p><div class="module-step-counts">${input("round1_traceable", "รอบแรก · ตรวจย้อนกลับได้")}${input("round1_unsupported", "รอบแรก · ไม่มีหลักฐาน")}${input("round2_traceable", "รอบสอง · ตรวจย้อนกลับได้")}${input("round2_unsupported", "รอบสอง · ไม่มีหลักฐาน")}</div>`;
    }
    return "";
  }

  function formValues(form, stageId) {
    if (stageId === "prepare") return { evidence_ready: Boolean(form.elements.evidence_ready?.checked) };
    if (stageId === "concepts") return { level: form.elements.level?.value || "" };
    return {
      round1_traceable: form.elements.round1_traceable?.value || "",
      round1_unsupported: form.elements.round1_unsupported?.value || "",
      round2_traceable: form.elements.round2_traceable?.value || "",
      round2_unsupported: form.elements.round2_unsupported?.value || "",
    };
  }

  async function init() {
    if (window.classroomContentRouteReady) await window.classroomContentRouteReady;
    applyEvidenceSetChoice();
    const content = document.querySelectorAll("[data-module-2-step]");
    if (!content.length) return;

    const state = readState();
    document.body.classList.add("module-progress-page");
    const topProgress = document.createElement("nav");
    topProgress.className = "module-top-progress module-2-top-progress";
    topProgress.setAttribute("aria-label", "ความก้าวหน้า Module 2");
    topProgress.innerHTML = `<div class="module-top-tabs" role="tablist" aria-label="4 ขั้นของ Module 2"></div>
      <span class="module-top-count" data-module-2-progress-label aria-live="polite">0/4</span>
      <div class="module-top-track" aria-hidden="true"><i data-module-2-progress-bar></i></div>`;
    const siteHeader = document.querySelector(".site-header");
    if (siteHeader) siteHeader.append(topProgress);
    else document.querySelector("site-header")?.after(topProgress);

    const shell = document.createElement("section");
    shell.className = "module-step-shell module-content-step-shell module-2-step-shell";
    shell.setAttribute("aria-label", "ลำดับกิจกรรม Module 2");
    shell.innerHTML = `<p class="module-step-live module-compact-step-live" role="status" aria-live="polite"></p>`;
    content[0].before(shell);

    const tablist = topProgress.querySelector("[role=tablist]");
    const live = shell.querySelector(".module-step-live");
    const progressLabel = topProgress.querySelector("[data-module-2-progress-label]");
    const progressBar = topProgress.querySelector("[data-module-2-progress-bar]");
    const tabs = [];
    const panels = [];

    stages.forEach((stage, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `module-2-tab-${stage.id}`;
      tab.className = "module-step-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `module-2-panel-${stage.id}`);
      tab.innerHTML = `<span>${index + 1}</span><strong>${stage.short}</strong>`;
      tablist.append(tab);
      tabs.push(tab);

      const panel = document.createElement("div");
      panel.id = `module-2-panel-${stage.id}`;
      panel.className = "module-step-panel";
      panel.dataset.module2Panel = stage.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      shell.append(panel);
      panels.push(panel);
      if (stage.id === "prepare") {
        const review = document.querySelector(".hunger-review");
        if (review) {
          const reviewDetails = document.createElement("details");
          reviewDetails.className = "fallback-details";
          reviewDetails.innerHTML = "<summary>ทบทวนเคส หิว → กิน → อิ่ม</summary>";
          reviewDetails.append(review);
          panel.append(reviewDetails);
        }
      }
      document.querySelectorAll(`[data-module-2-step="${stage.id}"]`).forEach((section) => panel.append(section));

      if (stage.id !== "submit") {
        const checkpoint = document.createElement("form");
        checkpoint.className = "module-step-checkpoint";
        checkpoint.dataset.module2Checkpoint = stage.id;
        checkpoint.noValidate = true;
        checkpoint.innerHTML = `<div><p class="eyebrow">จุดตรวจสำหรับช่วงฝึกภายหลัง · ข้ามไปดูแท็บอื่นได้</p><h3>${stage.id === "prepare" ? "ยืนยันว่าหลักฐานพร้อม" : stage.id === "concepts" ? "ลองจัดระดับหนึ่งข้อ" : "บันทึกผลเปรียบเทียบสองรอบ"}</h3></div>${checkpointMarkup(stage.id, state.answers[stage.id] || {})}<div class="module-step-checkpoint-actions"><button class="button primary" type="submit">บันทึกผลและไปต่อ</button><small role="status" aria-live="polite"></small></div>`;
        const checkpointDetails = document.createElement("details");
        checkpointDetails.className = "fallback-details";
        checkpointDetails.innerHTML = "<summary>แบบตรวจเพิ่มเติม · ทำเมื่อฝึกละเอียด</summary>";
        checkpointDetails.append(checkpoint);
        panel.append(checkpointDetails);
        checkpoint.addEventListener("submit", (event) => {
          event.preventDefault();
          const values = formValues(checkpoint, stage.id);
          const result = validateCheckpoint(stage.id, values);
          const status = checkpoint.querySelector("[role=status]");
          status.textContent = result.message;
          status.classList.toggle("is-error", !result.ok);
          if (!result.ok) return;
          state.answers[stage.id] = values;
          state.completed[stage.id] = true;
          writeState(state);
          render();
          window.setTimeout(() => activate(index + 1, true), 350);
        });
      } else {
        const note = document.createElement("p");
        note.className = "module-step-final-note";
        note.textContent = "เมื่อเข้าใจตัวอย่างแล้ว ให้เตรียมเอกสารเรื่องของคุณตามกิจกรรมในแท็บนี้ ส่วนตรวจไฟล์และส่งความคืบหน้าด้านล่างใช้กับแบบฝึกชุดอาหารเมื่อทำครบแล้ว";
        panel.prepend(note);
      }
    });

    function render() {
      const done = stages.filter((stage) => state.completed[stage.id]).length;
      progressLabel.textContent = `${done}/${stages.length}`;
      progressBar.style.width = `${done / stages.length * 100}%`;
      stages.forEach((stage, index) => {
        const unlocked = stageUnlocked(index, state);
        const completed = Boolean(state.completed[stage.id]);
        tabs[index].disabled = !unlocked;
        tabs[index].setAttribute("aria-disabled", String(!unlocked));
        tabs[index].classList.toggle("is-complete", completed);
        const status = completed ? "เสร็จแล้ว" : unlocked ? "เปิดได้" : "ยังล็อก";
        tabs[index].setAttribute("aria-label", `ขั้น ${index + 1} ${stage.short}: ${status}`);
        tabs[index].title = status;
      });
    }

    function activate(index, focusTab) {
      if (index < 0 || index >= stages.length || !stageUnlocked(index, state)) return;
      state.active = stages[index].id;
      writeState(state);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[tabIndex].hidden = !selected;
      });
      live.textContent = `ช่วงที่ ${index + 1} จาก ${stages.length}: ${stages[index].title}`;
      if (focusTab) {
        tabs[index].focus({ preventScroll: true });
        shell.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(index, true));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const unlocked = stages.map((_, stageIndex) => stageIndex).filter((stageIndex) => stageUnlocked(stageIndex, state));
        const current = unlocked.indexOf(index);
        const target = event.key === "Home" ? unlocked[0] : event.key === "End" ? unlocked.at(-1) : unlocked[(current + (event.key === "ArrowRight" ? 1 : -1) + unlocked.length) % unlocked.length];
        activate(target, true);
      });
    });

    function activateHashTarget() {
      if (!location.hash) return false;
      const target = document.querySelector(location.hash);
      const panel = target?.closest("[data-module2-panel]");
      const index = stages.findIndex((stage) => stage.id === panel?.dataset.module2Panel);
      if (index < 0) return false;
      if (stageUnlocked(index, state)) activate(index, false);
      else live.textContent = `ทำจุดส่งผลย่อยของช่วงก่อนหน้าเพื่อเปิด “${stages[index].short}”`;
      return true;
    }

    render();
    const finalChecks = [...document.querySelectorAll('#finish input[type="checkbox"]')];
    const syncFinalCompletion = () => {
      if (finalChecks.length && finalChecks.every((box) => box.checked)) state.completed.submit = true;
      else delete state.completed.submit;
      writeState(state);
      render();
    };
    finalChecks.forEach((box) => box.addEventListener("change", syncFinalCompletion));
    syncFinalCompletion();
    const activeIndex = stages.findIndex((stage, index) => stage.id === state.active && stageUnlocked(index, state));
    activate(activeIndex >= 0 ? activeIndex : 0, false);
    activateHashTarget();
    window.addEventListener("hashchange", activateHashTarget);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { validateCheckpoint };
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})();
