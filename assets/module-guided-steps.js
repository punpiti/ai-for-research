(function moduleGuidedSteps() {
  "use strict";

  const configs = {
    "4": {
      stages: [
        { id: "prepare", short: "เตรียม", title: "เตรียม Claim และเอกสาร", selectors: ["main > .profile-context", "#prepare", "#outcomes"] },
        { id: "concepts", short: "หลักฐาน", title: "รู้จักแหล่งและสถานะหลักฐาน", selectors: ["#source-types", "#citation-anatomy", "#verification", "#example"] },
        { id: "search", short: "ค้น", title: "ค้นวรรณกรรมอย่างมีขอบเขต", selectors: ["#openalex"] },
        { id: "verify", short: "ตรวจอ้างอิง", title: "ตรวจ Citation กับแหล่งต้นทาง", selectors: ["#paths", "#path-a", "#path-b"] },
        { id: "finish", short: "สรุป", title: "สรุปหลักฐานและตรวจงาน", selectors: ["#shared", "#finish"] },
      ],
      checklist: "#finish",
    },
    "5": {
      stages: [
        { id: "prepare", short: "เตรียม", title: "เตรียมโจทย์และเลือกทางเริ่ม", selectors: ["main > .profile-context", "#start", "#ai-start", "#outcomes"] },
        { id: "start", short: "เริ่ม", title: "ตั้งค่า AI และเริ่มบทเรียน", selectors: ["#guided-concepts", "#activity"] },
        { id: "venue", short: "แหล่งเผยแพร่", title: "เลือกแหล่งเผยแพร่และประเมินความพร้อม", selectors: ["#activity-venue"] },
        { id: "logic", short: "สายเหตุผล", title: "ตารางจุดตัดและสายเหตุผล", selectors: ["#activity-logic"] },
        { id: "ideas", short: "คัดแนวคิด", title: "หาจุดขาดและคัดแนวคิด", selectors: ["#activity-ideas"] },
        { id: "design", short: "แบบวิจัย", title: "ร่างแบบวิจัยและด่านท้าทาย", selectors: ["#activity-design"] },
        { id: "review", short: "ทบทวน", title: "ทบทวนและวางงานต่อ", selectors: ["#การบ้าน", "#review"] },
        { id: "finish", short: "ตรวจจบ", title: "ตรวจชิ้นงานและไปโมดูลถัดไป", selectors: ["#finish", ".final-cta"] },
      ],
      checklist: "#finish",
    },
  };

  function readState(storageKey, stages) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        active: stages.some((stage) => stage.id === saved.active) ? saved.active : stages[0].id,
        completed: saved.completed && typeof saved.completed === "object" ? saved.completed : {},
      };
    } catch (_error) {
      return { active: stages[0].id, completed: {} };
    }
  }

  function writeState(storageKey, state) {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_error) { /* The lesson remains navigable without storage. */ }
  }

  async function init() {
    if (window.classroomContentRouteReady) await window.classroomContentRouteReady;
    const moduleNumber = document.querySelector("site-header")?.getAttribute("current") || "";
    const config = configs[moduleNumber];
    if (!config || document.querySelector("[data-guided-module-steps]")) return;
    if (moduleNumber === "5") {
      const aiStart = [...document.querySelectorAll("main section")]
        .find((section) => section.querySelector("h2")?.textContent.trim() === "เริ่มทำงานกับ AI");
      if (aiStart) aiStart.id = "ai-start";
    }

    const firstSection = document.querySelector(config.stages[0].selectors[0]);
    if (!firstSection) return;

    const storageKey = `ai-for-research.module-${moduleNumber}.steps.v1`;
    const { stages } = config;
    const state = readState(storageKey, stages);
    document.body.classList.add("module-progress-page");

    const topProgress = document.createElement("nav");
    topProgress.className = `module-top-progress module-${moduleNumber}-top-progress`;
    topProgress.setAttribute("aria-label", `ความก้าวหน้า Module ${moduleNumber}`);
    topProgress.innerHTML = `<div class="module-top-tabs" role="tablist" aria-label="${stages.length} ขั้นของ Module ${moduleNumber}"></div>
      <span class="module-top-count" data-guided-progress-label aria-live="polite">0/${stages.length}</span>
      <div class="module-top-track" aria-hidden="true"><i data-guided-progress-bar></i></div>`;
    const siteHeader = document.querySelector(".site-header");
    if (siteHeader) siteHeader.append(topProgress);
    else document.querySelector("site-header")?.after(topProgress);

    const shell = document.createElement("section");
    shell.className = `module-step-shell module-content-step-shell module-${moduleNumber}-step-shell`;
    shell.dataset.guidedModuleSteps = moduleNumber;
    shell.setAttribute("aria-label", `ลำดับกิจกรรม Module ${moduleNumber}`);
    shell.innerHTML = `<p class="module-step-live module-compact-step-live" role="status" aria-live="polite"></p>`;
    firstSection.before(shell);

    const tablist = topProgress.querySelector("[role=tablist]");
    const live = shell.querySelector(".module-step-live");
    const progressLabel = topProgress.querySelector("[data-guided-progress-label]");
    const progressBar = topProgress.querySelector("[data-guided-progress-bar]");
    const tabs = [];
    const panels = [];

    stages.forEach((stage, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `module-${moduleNumber}-tab-${stage.id}`;
      tab.className = "module-step-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `module-${moduleNumber}-panel-${stage.id}`);
      tab.innerHTML = `<span>${index + 1}</span><strong>${stage.short}</strong>`;
      tablist.append(tab);
      tabs.push(tab);

      const panel = document.createElement("div");
      panel.id = `module-${moduleNumber}-panel-${stage.id}`;
      panel.className = `module-step-panel module-${moduleNumber}-step-panel`;
      panel.dataset.guidedStepPanel = stage.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      stage.selectors.forEach((selector) => {
        const section = document.querySelector(selector);
        if (section) panel.append(section);
      });

      const navigation = document.createElement("nav");
      navigation.className = "module-step-navigation";
      navigation.setAttribute("aria-label", `เปลี่ยนช่วงจาก ${stage.title}`);
      if (index > 0) {
        const previous = document.createElement("button");
        previous.type = "button";
        previous.className = "button secondary";
        previous.textContent = `← ${stages[index - 1].short}`;
        previous.addEventListener("click", () => activate(index - 1, true));
        navigation.append(previous);
      }
      if (index < stages.length - 1) {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "button primary";
        next.textContent = `${stages[index + 1].short} →`;
        next.addEventListener("click", () => {
          state.completed[stage.id] = true;
          writeState(storageKey, state);
          render();
          activate(index + 1, true);
        });
        navigation.append(next);
      }
      panel.append(navigation);
      shell.append(panel);
      panels.push(panel);
    });

    function syncFinalCompletion() {
      const boxes = [...document.querySelectorAll(`${config.checklist} input[type="checkbox"]`)];
      const finalId = stages.at(-1).id;
      if (boxes.length && boxes.every((box) => box.checked)) state.completed[finalId] = true;
      else delete state.completed[finalId];
      writeState(storageKey, state);
    }

    function render() {
      syncFinalCompletion();
      const done = stages.filter((stage) => state.completed[stage.id]).length;
      progressLabel.textContent = `${done}/${stages.length}`;
      progressBar.style.width = `${done / stages.length * 100}%`;
      tabs.forEach((tab, index) => {
        const completed = Boolean(state.completed[stages[index].id]);
        const status = completed ? "เสร็จแล้ว" : "เปิดได้";
        tab.classList.toggle("is-complete", completed);
        tab.setAttribute("aria-label", `ขั้น ${index + 1} ${stages[index].short}: ${status}`);
        tab.title = status;
      });
    }

    function activate(index, focusTab = false) {
      if (index < 0 || index >= stages.length) index = 0;
      state.active = stages[index].id;
      writeState(storageKey, state);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[tabIndex].hidden = !selected;
      });
      live.textContent = `ขั้น ${index + 1} จาก ${stages.length}: ${stages[index].title}`;
      if (focusTab) {
        tabs[index].focus({ preventScroll: true });
        shell.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function activateHashTarget() {
      if (!location.hash) return false;
      const target = document.querySelector(location.hash);
      const panel = target?.closest("[data-guided-step-panel]");
      const index = stages.findIndex((stage) => stage.id === panel?.dataset.guidedStepPanel);
      if (index < 0) return false;
      activate(index, false);
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      return true;
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(index, true));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const target = event.key === "Home" ? 0
          : event.key === "End" ? stages.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + stages.length) % stages.length;
        activate(target, true);
      });
    });

    document.querySelectorAll(`${config.checklist} input[type="checkbox"]`).forEach((box) => box.addEventListener("change", render));
    window.addEventListener("hashchange", activateHashTarget);
    render();
    const activeIndex = stages.findIndex((stage) => stage.id === state.active);
    activate(activeIndex >= 0 ? activeIndex : 0, false);
    activateHashTarget();
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})();
