(function module3Steps() {
  "use strict";

  const storageKey = "ai-for-research.module-3.steps.v1";
  const stages = [
    { id: "prepare", short: "เตรียม", title: "เตรียมงานและเลือกเส้นทาง", selectors: ["main > .profile-context", "#learner-level", "#start", "#outcomes"] },
    { id: "concepts", short: "เข้าใจปัญหา", title: "แยกส่วนของปัญหาและ Gap", selectors: ["#concepts", "#example"] },
    { id: "diagnose", short: "วินิจฉัย", title: "วินิจฉัยเปเปอร์หรือหลักฐาน", selectors: ["#student-path", "#faculty-path"] },
    { id: "challenge", short: "ทดสอบ Gap", title: "สร้างและพยายามหักล้าง Gap", selectors: ["#activity"] },
    { id: "finish", short: "ส่งและจบ", title: "ส่งความคืบหน้าและตรวจงาน", selectors: ["#submit-module-3", "#finish"] },
  ];

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        active: stages.some((stage) => stage.id === saved.active) ? saved.active : "prepare",
        completed: saved.completed && typeof saved.completed === "object" ? saved.completed : {},
      };
    } catch (_error) {
      return { active: "prepare", completed: {} };
    }
  }

  function writeState(state) {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_error) { /* The lesson remains navigable without storage. */ }
  }

  async function init() {
    if (window.module3AccessReady) await window.module3AccessReady;
    if (document.querySelector("[data-module-3-steps]") || document.querySelector("[data-module-3-access-status].is-error")) return;

    const firstSection = document.querySelector(stages[0].selectors[0]);
    if (!firstSection) return;

    const state = readState();
    document.body.classList.add("module-progress-page");

    const topProgress = document.createElement("nav");
    topProgress.className = "module-top-progress module-3-top-progress";
    topProgress.setAttribute("aria-label", "ความก้าวหน้า Module 3");
    topProgress.innerHTML = `<div class="module-top-tabs" role="tablist" aria-label="5 ขั้นของ Module 3"></div>
      <span class="module-top-count" data-module-3-progress-label aria-live="polite">0/5</span>
      <div class="module-top-track" aria-hidden="true"><i data-module-3-progress-bar></i></div>`;
    const siteHeader = document.querySelector(".site-header");
    if (siteHeader) siteHeader.append(topProgress);
    else document.querySelector("site-header")?.after(topProgress);

    const shell = document.createElement("section");
    shell.className = "module-step-shell module-content-step-shell module-3-step-shell";
    shell.dataset.module3Steps = "";
    shell.setAttribute("aria-label", "ลำดับกิจกรรม Module 3");
    shell.innerHTML = `<p class="module-step-live module-compact-step-live" role="status" aria-live="polite"></p>`;
    firstSection.before(shell);

    const tablist = topProgress.querySelector("[role=tablist]");
    const live = shell.querySelector(".module-step-live");
    const progressLabel = topProgress.querySelector("[data-module-3-progress-label]");
    const progressBar = topProgress.querySelector("[data-module-3-progress-bar]");
    const tabs = [];
    const panels = [];

    stages.forEach((stage, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `module-3-tab-${stage.id}`;
      tab.className = "module-step-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `module-3-panel-${stage.id}`);
      tab.innerHTML = `<span>${index + 1}</span><strong>${stage.short}</strong>`;
      tablist.append(tab);
      tabs.push(tab);

      const panel = document.createElement("div");
      panel.id = `module-3-panel-${stage.id}`;
      panel.className = "module-step-panel module-3-step-panel";
      panel.dataset.module3Panel = stage.id;
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
          writeState(state);
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
      const checks = [...document.querySelectorAll('#finish input[type="checkbox"]')];
      if (checks.length && checks.every((box) => box.checked)) state.completed.finish = true;
      else delete state.completed.finish;
      writeState(state);
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
      writeState(state);
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
      const panel = target?.closest("[data-module3-panel]");
      const index = stages.findIndex((stage) => stage.id === panel?.dataset.module3Panel);
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

    document.querySelectorAll('#finish input[type="checkbox"]').forEach((box) => box.addEventListener("change", render));
    window.addEventListener("hashchange", activateHashTarget);
    render();
    const activeIndex = stages.findIndex((stage) => stage.id === state.active);
    activate(activeIndex >= 0 ? activeIndex : 0, false);
    activateHashTarget();
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})();
