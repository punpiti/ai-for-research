(function module7Steps(globalObject) {
  "use strict";

  const storageKey = "ai-for-research.module-7.steps.v1";
  const steps = [
    { id: "start", title: "เตรียมบทเรียน", short: "เตรียม", sections: ["start", "คำถามแกนของโมดูล", "outcomes"] },
    { id: "learn", title: "Workshop และพื้นฐาน", short: "Workshop", sections: ["no-code-ในโมดูลนี้หมายถึงอะไร", "รู้จักแฟ้มข้อมูลก่อนนำเข้า", "python-ทำงานอยู่เบื้องหลังอย่างไร", "จาก-dataframe-ไปเป็น-visualization"] },
    { id: "create", title: "สร้างและปรับกราฟ", short: "สร้างกราฟ", sections: ["your-starting-point", "ตั้งสมมติฐานอย่างไร", "activity"] },
    { id: "audit", title: "ตรวจทั้งภาพและเอกสาร", short: "ตรวจบั๊ก", sections: ["red-team-ก่อนสรุปผล", "figure-consistency-audit"] },
    { id: "finish", title: "ส่งงานและนำไปใช้ต่อ", short: "ส่งงาน", sections: ["finish", "การบ้าน", "review"] },
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

  function init() {
    const firstSection = document.getElementById("start");
    const moduleContent = document.getElementById("module-content");
    if (!firstSection || !moduleContent || document.querySelector("[data-module-7-steps]")) return;

    document.body.classList.add("module-progress-page", "module-7-page");
    document.querySelectorAll("[data-m7-stage-prompt]").forEach((block) => block.classList.add("ai-prompt"));
    const state = readState();
    const topProgress = document.createElement("nav");
    topProgress.className = "module-top-progress module-7-top-progress";
    topProgress.setAttribute("aria-label", "ความก้าวหน้า Module 7");
    topProgress.innerHTML = `<div class="module-top-tabs" role="tablist" aria-label="5 ช่วงของ Module 7"></div>
      <span class="module-top-count" data-module-7-progress-label aria-live="polite">0/5</span>
      <div class="module-top-track" aria-hidden="true"><i data-module-7-progress-bar></i></div>`;
    const siteHeader = document.querySelector(".site-header");
    if (siteHeader) siteHeader.append(topProgress);
    else document.querySelector("site-header")?.after(topProgress);

    const shell = document.createElement("section");
    shell.className = "module-step-shell module-content-step-shell module-7-step-shell";
    shell.dataset.module7Steps = "";
    shell.setAttribute("aria-label", "กิจกรรม Module 7");
    shell.innerHTML = `<p class="module-step-live module-compact-step-live" role="status" aria-live="polite"></p>`;
    moduleContent.before(shell);

    const tablist = topProgress.querySelector("[role=tablist]");
    const live = shell.querySelector(".module-step-live");
    const progressLabel = topProgress.querySelector("[data-module-7-progress-label]");
    const progressBar = topProgress.querySelector("[data-module-7-progress-bar]");
    const tabs = [];
    const panels = [];

    steps.forEach((step, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `module-7-tab-${step.id}`;
      tab.className = "module-step-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `module-7-panel-${step.id}`);
      tab.innerHTML = `<span>${index + 1}</span><strong>${step.short}</strong>`;
      tablist.append(tab);
      tabs.push(tab);

      const panel = document.createElement("div");
      panel.id = `module-7-panel-${step.id}`;
      panel.className = "module-step-panel module-7-step-panel";
      panel.dataset.module7Panel = step.id;
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
        next.textContent = `${steps[index + 1].short} →`;
        next.addEventListener("click", () => {
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

    moduleContent.remove();

    function render() {
      const done = steps.filter((step) => state.completed[step.id]).length;
      progressLabel.textContent = `${done}/${steps.length}`;
      progressBar.style.width = `${done / steps.length * 100}%`;
      tabs.forEach((tab, index) => {
        const completed = Boolean(state.completed[steps[index].id]);
        tab.classList.toggle("is-complete", completed);
        tab.setAttribute("aria-label", `ช่วง ${index + 1} ${steps[index].short}: ${completed ? "เสร็จแล้ว" : "เปิดได้"}`);
      });
    }

    function activate(index, focusTab = false) {
      if (index < 0 || index >= steps.length) index = 0;
      state.active = steps[index].id;
      writeState(state);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[tabIndex].hidden = !selected;
      });
      live.textContent = `ช่วง ${index + 1} จาก ${steps.length}: ${steps[index].title}`;
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
        const target = event.key === "Home" ? 0
          : event.key === "End" ? steps.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + steps.length) % steps.length;
        activate(target, true);
      });
    });

    render();
    activate(Math.max(0, steps.findIndex((step) => step.id === state.active)), false);
  }

  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
})(typeof window !== "undefined" ? window : globalThis);
