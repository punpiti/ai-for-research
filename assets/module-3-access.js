(function module3Access(globalObject) {
  "use strict";

  const apiBase = "/api/ai-for-research/classrooms";
  const routeSections = { student: "student-path", faculty: "faculty-path" };

  function classroomIdFromSearch(search = globalObject.location?.search || "") {
    const value = new URLSearchParams(String(search)).get("classroom_id") || "";
    return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(value) ? value : "";
  }

  function accessEndpoint(classroomId) {
    return `${apiBase}/${encodeURIComponent(classroomId)}/modules/module-3/access`;
  }

  function isLocalDevelopment(hostname = globalObject.location?.hostname || "") {
    const host = String(hostname).toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
  }

  function setLessonVisibility(allowedRoutes) {
    const allowed = new Set(allowedRoutes);
    for (const [route, sectionId] of Object.entries(routeSections)) {
      const section = document.getElementById(sectionId);
      if (!section) continue;
      section.hidden = !allowed.has(route);
      const details = section.querySelector(":scope > details.guided-details");
      if (details) details.open = allowed.size === 1 && allowed.has(route);
    }
    document.body.classList.add("module3-access-ready");
  }

  function blockLesson(message) {
    setLessonVisibility([]);
    for (const section of document.querySelectorAll("main > section")) {
      if (!section.classList.contains("module-hero") && section.id !== "learner-level") section.hidden = true;
    }
    const status = document.querySelector("[data-module-3-access-status]");
    if (status) {
      status.textContent = message;
      status.classList.add("is-error");
    }
  }

  async function initialize(fetchImpl = globalObject.fetch) {
    if (isLocalDevelopment()) {
      const allowedRoutes = Object.keys(routeSections);
      setLessonVisibility(allowedRoutes);
      const status = document.querySelector("[data-module-3-access-status]");
      if (status) {
        status.textContent = "โหมดพัฒนา: แสดงเนื้อหาทั้งสองเส้นทางโดยไม่ตรวจสิทธิ์";
        status.classList.add("is-success");
      }
      return;
    }
    const classroomId = classroomIdFromSearch();
    if (!classroomId) {
      blockLesson("เปิด Module 3 จากห้องเรียนของคุณ เพื่อให้ระบบตรวจเส้นทางที่ผู้สอนอนุญาต");
      return;
    }
    try {
      const response = await fetchImpl(accessEndpoint(classroomId), {
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("กรุณาเข้าสู่ระบบด้วยบัญชีที่ลงทะเบียนในคลาสนี้");
        if (response.status === 403) throw new Error("คลาสนี้ยังไม่อนุญาตให้คุณดู Module 3");
        throw new Error("ยังตรวจสิทธิ์ Module 3 ไม่ได้ กรุณาลองใหม่");
      }
      const payload = await response.json();
      const allowedRoutes = Array.isArray(payload.allowed_routes)
        ? payload.allowed_routes.filter((route) => route in routeSections)
        : [];
      if (!allowedRoutes.length) throw new Error("ผู้สอนยังไม่ได้เปิดเส้นทาง Module 3 สำหรับคลาสนี้");
      setLessonVisibility(allowedRoutes);
      const labels = allowedRoutes.map((route) => route === "faculty" ? "อาจารย์ / นักวิจัย" : "นักเรียน / ผู้เริ่มต้น");
      const status = document.querySelector("[data-module-3-access-status]");
      if (status) {
        status.textContent = `เปิดให้เรียน: ${labels.join(" และ ")}`;
        status.classList.add("is-success");
      }
    } catch (error) {
      blockLesson(error.message || "ตรวจสิทธิ์ Module 3 ไม่สำเร็จ");
    }
  }

  const testApi = { apiBase, classroomIdFromSearch, accessEndpoint, isLocalDevelopment };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => {
    globalObject.module3AccessReady = initialize();
  });
})(typeof window !== "undefined" ? window : globalThis);
