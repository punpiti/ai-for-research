// Class page: topic test status, visible only to the listed testers (owner + 5 testers).
// Viewers are matched by sha256 of the signed-in email; learners see nothing.
(() => {
  const LABELS = {
    "not-ready": ["ยังไม่พร้อมทดสอบ", "#9aa3ad"],
    ready: ["รอทดสอบ", "#e3b341"],
    issue: ["มีปัญหา", "#ef7d55"],
    passed: ["ผ่านแล้ว", "#3fb950"],
  };
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function badge(status, note) {
    const [label, color] = LABELS[status] || LABELS["not-ready"];
    const el = document.createElement("span");
    el.className = "test-status";
    el.textContent = label;
    el.title = note ? `${label} — ${note}` : label;
    el.style.cssText = `display:inline-block;margin-left:.4rem;padding:0 .45rem;border:1px solid ${color};border-radius:99px;color:${color};font-size:.72rem;line-height:1.5;white-space:nowrap;vertical-align:middle`;
    return el;
  }
  async function run() {
    if (!window.crypto?.subtle) return;
    const me = await fetch("/api/ai-for-research/classrooms/me", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const email = me?.user?.email;
    if (!email) return;
    const data = await fetch("assets/topic-test-status.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!data || !(data.viewers || []).includes(await sha256(email.trim().toLowerCase()))) return;
    const topics = data.topics || {};
    const pri = data.priority || {};
    const priSet = new Set(pri.topics || []);
    const priBadge = () => {
      const el = document.createElement("span");
      el.className = "test-priority";
      el.textContent = pri.label || "ตรวจก่อน";
      el.title = pri.note || "";
      el.style.cssText = "display:inline-block;margin-left:.3rem;padding:0 .45rem;border-radius:99px;background:#d9534f;color:#fff;font-size:.72rem;line-height:1.5;white-space:nowrap;vertical-align:middle";
      return el;
    };
    const testerRows = [...document.querySelectorAll("li[data-tester-only]")];
    // modules not yet open to learners: testers can still open the topic pages
    const unlocked = [...document.querySelectorAll("span.locked[data-href]")].map((span) => {
      const a = document.createElement("a");
      a.href = span.dataset.href;
      a.textContent = span.textContent;
      return [span, a];
    });
    document.querySelectorAll("details.syllabus-module").forEach((mod) => {
      let passed = 0, total = 0, priCount = 0;
      mod.querySelectorAll("li[data-topic]").forEach((li) => {
        const t = topics[li.dataset.topic] || { status: "not-ready" };
        total += 1; if (t.status === "passed") passed += 1;
        const small = li.querySelector("br");
        li.insertBefore(badge(t.status, t.note), small || null);
        if (priSet.has(li.dataset.topic)) { priCount += 1; li.dataset.priority = "1"; li.insertBefore(priBadge(), small || null); }
      });
      const name = mod.querySelector("summary .name small");
      if (name && total) {
        const s = document.createElement("span");
        s.className = "test-status-count";
        s.textContent = ` · ทดสอบผ่าน ${passed}/${total}` + (priCount ? ` · ${pri.label || "ตรวจก่อน"} ${priCount} หัวข้อ` : "");
        name.append(s);
      }
    });
    const syllabus = document.querySelector(".syllabus");
    if (syllabus) {
      const legend = document.createElement("p");
      legend.className = "test-status-legend";
      legend.style.cssText = "font-size:.8rem;margin:.4rem 0 .8rem";
      legend.append("สถานะทดสอบ (เห็นเฉพาะทีมทดสอบ · อัปเดต " + (data.updated || "") + "): ");
      Object.keys(LABELS).forEach((k) => legend.append(badge(k)));
      if (priSet.size) {
        legend.append(" · ", priBadge(), ` ${pri.note || ""} `);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "แสดงเฉพาะที่ใช้วันศุกร์";
        btn.style.cssText = "margin-left:.4rem;font-size:.75rem;padding:.1rem .6rem;border-radius:99px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer";
        let only = false;
        btn.addEventListener("click", () => {
          only = !only;
          btn.textContent = only ? "แสดงทุกหัวข้อ" : "แสดงเฉพาะที่ใช้วันศุกร์";
          document.querySelectorAll("details.syllabus-module").forEach((mod) => {
            const rows = mod.querySelectorAll("li[data-topic]");
            let any = false;
            rows.forEach((li) => { const keep = !only || li.dataset.priority === "1"; li.style.display = keep ? "" : "none"; if (keep) any = true; });
            mod.style.display = only && !any ? "none" : "";
            if (only && any) mod.open = true;
          });
        });
        legend.append(btn);
      }
      syllabus.before(legend);
    }
    // switch: off = see the page exactly as a learner does (remembered in this browser)
    const KEY = "airr-test-status-off";
    const sw = document.createElement("p");
    sw.className = "test-status-switch";
    sw.style.cssText = "font-size:.8rem;margin:.4rem 0";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.style.cssText = "font-size:.75rem;padding:.1rem .6rem;border-radius:99px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer";
    sw.append(toggle);
    (document.querySelector(".test-status-legend") || syllabus)?.before(sw);
    const apply = (show) => {
      toggle.textContent = show ? "สถานะทดสอบ: เปิด · กดเพื่อดูแบบผู้เรียน" : "มุมมองผู้เรียน · กดเพื่อแสดงสถานะทดสอบ";
      toggle.setAttribute("aria-pressed", String(show));
      document.querySelectorAll(".test-status, .test-priority, .test-status-count, .test-status-legend")
        .forEach((el) => { if (!sw.contains(el)) el.style.display = show ? "" : "none"; });
      testerRows.forEach((li) => { li.hidden = !show; });
      unlocked.forEach(([span, a]) => { (show ? span : a).replaceWith(show ? a : span); });
      if (!show) document.querySelectorAll("details.syllabus-module, li[data-topic]").forEach((el) => { el.style.display = ""; });
    };
    let show = true;
    try { show = localStorage.getItem(KEY) !== "1"; } catch (e) { /* storage blocked: default on */ }
    toggle.addEventListener("click", () => {
      show = !show;
      try { show ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, "1"); } catch (e) { /* ignore */ }
      apply(show);
    });
    apply(show);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
