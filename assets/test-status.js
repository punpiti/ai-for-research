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
    document.querySelectorAll("li[data-tester-only]").forEach((li) => { li.hidden = false; });
    // modules not yet open to learners: testers can still open the topic pages
    document.querySelectorAll("span.locked[data-href]").forEach((span) => {
      const a = document.createElement("a");
      a.href = span.dataset.href;
      a.textContent = span.textContent;
      span.replaceWith(a);
    });
    document.querySelectorAll("details.syllabus-module").forEach((mod) => {
      let passed = 0, total = 0;
      mod.querySelectorAll("li[data-topic]").forEach((li) => {
        const t = topics[li.dataset.topic] || { status: "not-ready" };
        total += 1; if (t.status === "passed") passed += 1;
        const small = li.querySelector("br");
        li.insertBefore(badge(t.status, t.note), small || null);
      });
      const name = mod.querySelector("summary .name small");
      if (name && total) {
        const s = document.createElement("span");
        s.className = "test-status-count";
        s.textContent = ` · ทดสอบผ่าน ${passed}/${total}`;
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
      syllabus.before(legend);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
