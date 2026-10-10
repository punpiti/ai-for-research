(function module1Steps(globalObject) {
  "use strict";

  const storageKey = "ai-for-research.module-1.steps.v1";
  const steps = [
    { id: "start", title: "ก่อนเริ่ม", short: "เตรียมตัว", sections: ["prerequisites", "outcomes"] },
    { id: "choose", title: "เลือก AI", short: "เลือก AI", sections: ["choose-ai"] },
    { id: "install", title: "ติดตั้งเครื่องมือ", short: "ติดตั้ง", sections: ["install"], needsAgent: true },
    { id: "practice", title: "ทดลองใช้งาน", short: "ทดลองใช้", sections: ["practice"], needsAgent: true },
    { id: "finish", title: "ตรวจความพร้อม", short: "พร้อมใช้", sections: ["homework"], needsAgent: true },
  ];

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        active: steps.some((step) => step.id === saved.active) ? saved.active : "start",
        completed: saved.completed && typeof saved.completed === "object" ? saved.completed : {},
      };
    } catch (_error) {
      return { active: "start", completed: {} };
    }
  }

  function writeState(state) {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_error) { /* Navigation still works when storage is unavailable. */ }
  }

  function selectedAgent() {
    return document.querySelector('input[name="agent"]:checked')?.value || "";
  }

  function init() {
    const firstSection = document.getElementById("prerequisites");
    if (!firstSection || document.querySelector("[data-module-1-steps]")) return;

    const state = readState();
    document.body.classList.add("module-progress-page");
    const topProgress = document.createElement("nav");
    topProgress.className = "module-top-progress module-1-top-progress";
    topProgress.setAttribute("aria-label", "ความก้าวหน้า Module 1");
    topProgress.innerHTML = `<div class="module-top-tabs" role="tablist" aria-label="5 ขั้นของ Module 1"></div>
      <span class="module-top-count" data-module-1-progress-label aria-live="polite">0/5</span>
      <div class="module-top-track" aria-hidden="true"><i data-module-1-progress-bar></i></div>`;
    const siteHeader = document.querySelector(".site-header");
    if (siteHeader) siteHeader.append(topProgress);
    else document.querySelector("site-header")?.after(topProgress);

    const shell = document.createElement("section");
    shell.id = "module-1-steps";
    shell.className = "module-step-shell module-content-step-shell module-1-step-shell";
    shell.dataset.module1Steps = "";
    shell.setAttribute("aria-label", "กิจกรรม Module 1");
    shell.innerHTML = `<p class="module-step-live module-compact-step-live" role="status" aria-live="polite"></p>`;
    firstSection.before(shell);

    const tablist = topProgress.querySelector("[role=tablist]");
    const live = shell.querySelector(".module-step-live");
    const progressLabel = topProgress.querySelector("[data-module-1-progress-label]");
    const progressBar = topProgress.querySelector("[data-module-1-progress-bar]");
    const tabs = [];
    const panels = [];

    steps.forEach((step, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `module-1-tab-${step.id}`;
      tab.className = "module-step-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `module-1-panel-${step.id}`);
      tab.innerHTML = `<span>${index + 1}</span><strong>${step.short}</strong>`;
      tablist.append(tab);
      tabs.push(tab);

      const panel = document.createElement("div");
      panel.id = `module-1-panel-${step.id}`;
      panel.className = "module-step-panel module-1-step-panel";
      panel.dataset.module1Panel = step.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      for (const sectionId of step.sections) {
        const section = document.getElementById(sectionId);
        if (section) panel.append(section);
      }

      const navigation = document.createElement("nav");
      navigation.className = "module-step-navigation";
      navigation.setAttribute("aria-label", `เปลี่ยนช่วงจาก ${step.title}`);
      if (index > 0) {
        const previous = document.createElement("button");
        previous.type = "button";
        previous.className = "button secondary";
        previous.textContent = `← ${steps[index - 1].short}`;
        previous.addEventListener("click", () => activate(index - 1, true));
        navigation.append(previous);
      }
      if (index < steps.length - 1) {
        const next = document.createElement("button");
        next.type = "button";
        next.className = "button primary";
        next.dataset.module1Next = step.id;
        next.textContent = `${steps[index + 1].short} →`;
        next.addEventListener("click", () => {
          if (step.id === "choose" && !selectedAgent()) {
            live.textContent = "เลือก AI หนึ่งรายการก่อนเข้าสู่ขั้นติดตั้ง";
            document.querySelector("#choose-ai input")?.focus();
            return;
          }
          state.completed[step.id] = true;
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

    function stepAvailable(step) {
      return !step.needsAgent || Boolean(selectedAgent());
    }

    function syncCompletionFromPage() {
      if (selectedAgent()) state.completed.choose = true;
      else delete state.completed.choose;
      const readinessBoxes = [...document.querySelectorAll("[data-module-1-check]")];
      if (readinessBoxes.length && readinessBoxes.every((box) => box.checked)) state.completed.finish = true;
      else delete state.completed.finish;
      writeState(state);
    }

    function render() {
      syncCompletionFromPage();
      const done = steps.filter((step) => state.completed[step.id]).length;
      progressLabel.textContent = `${done}/${steps.length}`;
      progressBar.style.width = `${done / steps.length * 100}%`;
      tabs.forEach((tab, index) => {
        const available = stepAvailable(steps[index]);
        const completed = Boolean(state.completed[steps[index].id]);
        tab.disabled = !available;
        tab.setAttribute("aria-disabled", String(!available));
        tab.classList.toggle("is-complete", completed);
        const status = completed ? "เสร็จแล้ว" : available ? "เปิดได้" : "เลือก AI ก่อน";
        tab.setAttribute("aria-label", `ขั้น ${index + 1} ${steps[index].short}: ${status}`);
        tab.title = status;
      });
    }

    function activate(index, focusTab = false) {
      if (index < 0 || index >= steps.length || !stepAvailable(steps[index])) {
        index = 1;
      }
      state.active = steps[index].id;
      writeState(state);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[tabIndex].hidden = !selected;
      });
      live.textContent = `ขั้น ${index + 1} จาก ${steps.length}: ${steps[index].title}`;
      if (focusTab) {
        tabs[index].focus({ preventScroll: true });
        shell.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function activateHashTarget() {
      if (!location.hash) return false;
      const target = document.querySelector(location.hash);
      const panel = target?.closest("[data-module1-panel]");
      const index = steps.findIndex((step) => step.id === panel?.dataset.module1Panel);
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
        const available = steps.map((step, stepIndex) => stepAvailable(step) ? stepIndex : -1).filter((stepIndex) => stepIndex >= 0);
        const current = available.indexOf(index);
        const target = event.key === "Home" ? available[0]
          : event.key === "End" ? available.at(-1)
            : available[(current + (event.key === "ArrowRight" ? 1 : -1) + available.length) % available.length];
        activate(target, true);
      });
    });

    document.querySelectorAll('input[name="agent"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.completed.choose = true;
        writeState(state);
        render();
      });
    });
    document.querySelectorAll("[data-module-1-check]").forEach((box) => box.addEventListener("change", render));
    window.addEventListener("hashchange", activateHashTarget);

    render();
    let activeIndex = steps.findIndex((step) => step.id === state.active && stepAvailable(step));
    if (activeIndex < 0) activeIndex = 0;
    activate(activeIndex, false);
    activateHashTarget();
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : globalThis);
