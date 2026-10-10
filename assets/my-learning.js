(function myLearningModule(globalObject) {
  "use strict";

  const endpoint = "/api/ai-for-research/classrooms/me";
  const roleLabel = (role) => role === "teacher" ? "ผู้สอน" : "ผู้เรียน";
  const statusLabel = (status) => ({
    active: "เข้าใช้งานได้",
    pending: "รออนุมัติ",
    rejected: "ไม่อนุมัติ",
  })[status] || status;
  const classroomPath = (item) => item.role === "teacher" && item.status === "active"
    ? `admin/?id=${encodeURIComponent(item.classroom_id)}`
    : `classroom.html?id=${encodeURIComponent(item.classroom_id)}`;

  const testApi = { endpoint, roleLabel, statusLabel, classroomPath };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.myLearningTestApi = testApi;
  if (typeof document === "undefined") return;

  const section = document.querySelector("[data-my-learning]");
  const status = document.querySelector("[data-my-learning-status]");
  const list = document.querySelector("[data-my-learning-list]");
  if (!section || !status || !list) return;

  function node(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  async function load() {
    const response = await globalObject.fetch(endpoint, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
    });
    if (response.status === 401) return;
    if (!response.ok) throw new Error("โหลดรายการคลาสไม่สำเร็จ");
    const payload = await response.json();
    const classrooms = (payload.classrooms || []).filter((item) => item.classroom_type !== "template");
    section.hidden = false;
    status.textContent = classrooms.length ? "" : "ยังไม่มีวิชาหรือคลาสในบัญชีนี้";
    classrooms.forEach((item) => {
      const card = node("article", "my-learning-card");
      const meta = node("p", "my-learning-meta", `${roleLabel(item.role)} · ${statusLabel(item.status)}`);
      const title = node("h3", "", item.title || item.course_title || item.classroom_id);
      const course = node("p", "", [item.course_code, item.course_title].filter(Boolean).join(" · "));
      const link = node("a", "button secondary", item.status === "active" ? "เปิดคลาส" : "ดูสถานะ");
      link.href = classroomPath(item);
      card.append(meta, title);
      if (course.textContent) card.append(course);
      card.append(link);
      list.append(card);
    });
  }

  load().catch((error) => {
    section.hidden = false;
    status.textContent = error.message;
  });
})(typeof window !== "undefined" ? window : globalThis);
