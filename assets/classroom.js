(function classroomModule(globalObject) {
  "use strict";

  const apiBase = "/api/ai-for-research/classrooms";

  function classroomIdFromPage(documentObject) {
    return documentObject?.querySelector("[data-classroom-id]")?.dataset.classroomId || "";
  }

  function loginUrl(classroomId) {
    const next = `classroom.html?id=${encodeURIComponent(classroomId)}&action=enroll`;
    return `login.html?next=${encodeURIComponent(next)}`;
  }

  async function sessionState(fetchImpl = globalObject.fetch) {
    if (typeof fetchImpl !== "function") return { authenticated: false, unavailable: true };
    try {
      const response = await fetchImpl(`${apiBase}/me`, {
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
      });
      if (response.ok) return { authenticated: true, ...(await response.json()) };
      if ([401, 403, 404].includes(response.status)) return { authenticated: false };
      return { authenticated: false, unavailable: true };
    } catch (_error) {
      return { authenticated: false, unavailable: true };
    }
  }

  async function enroll(classroomId, fetchImpl = globalObject.fetch) {
    const response = await fetchImpl(`${apiBase}/${encodeURIComponent(classroomId)}/enroll`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ payment: "not-required" }),
    });
    if (response.status === 401 || response.status === 403) return { authenticated: false };
    if (response.ok || response.status === 409) {
      const payload = await response.json().catch(() => ({}));
      const pending = payload.status === "pending";
      return { authenticated: true, enrolled: !pending, pending, ...payload };
    }
    throw new Error("enrollment-unavailable");
  }

  function membershipFor(session, classroomId) {
    if (!Array.isArray(session?.classrooms)) return null;
    return session.classrooms.find((item) => item.classroom_id === classroomId) || null;
  }

  const testApi = { apiBase, classroomIdFromPage, loginUrl, sessionState, enroll, membershipFor };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.classroomTestApi = testApi;

  if (typeof document === "undefined") return;
  const classroomId = classroomIdFromPage(document);
  const button = document.querySelector("[data-enroll-button]");
  const status = document.querySelector("[data-enroll-status]");
  if (!classroomId || !button || !status) return;

  let authenticated = false;
  let instructor = false;
  function renderGuest(unavailable = false) {
    authenticated = false;
    button.disabled = false;
    button.textContent = "เข้าสู่ระบบเพื่อลงทะเบียน";
    status.textContent = unavailable
      ? "ยังตรวจ session จากระบบจริงไม่ได้ คุณสามารถเข้าสู่ระบบเพื่อดำเนินการต่อ"
      : "ดูรายละเอียดได้โดยไม่ต้อง login เมื่อพร้อมแล้วจึงเข้าสู่ระบบเพื่อส่งคำขอ";
  }

  sessionState().then((state) => {
    if (!state.authenticated) {
      renderGuest(state.unavailable);
      return;
    }
    authenticated = true;
    const membership = membershipFor(state, classroomId);
    if (membership?.status === "active") {
      instructor = membership.role === "teacher";
      button.disabled = !instructor;
      button.textContent = instructor ? "เปิดหน้าของอาจารย์" : "ลงทะเบียนแล้ว";
      status.textContent = instructor ? "ลงทะเบียนแล้วในบทบาทผู้สอน" : "ลงทะเบียนเรียบร้อยแล้ว";
      status.classList.add("is-success");
      return;
    }
    if (membership?.status === "pending") {
      button.disabled = true;
      button.textContent = "รออนุมัติ";
      status.textContent = "ส่งคำขอลงทะเบียนแล้ว อยู่ระหว่างตรวจสอบสถานะอาจารย์หรือนักวิจัย";
      return;
    }
    button.disabled = false;
    button.textContent = "ลงทะเบียนคลาสนี้";
    status.textContent = state.preview ? "เข้าสู่ระบบแล้ว · Preview mode" : "เข้าสู่ระบบแล้ว พร้อมส่งคำขอเข้าร่วม";
  });

  button.addEventListener("click", async () => {
    if (instructor) {
      globalObject.location.assign("admin/");
      return;
    }
    if (!authenticated) {
      globalObject.location.assign(loginUrl(classroomId));
      return;
    }
    button.disabled = true;
    button.textContent = "กำลังส่งคำขอ…";
    try {
      const result = await enroll(classroomId);
      if (!result.authenticated) {
        globalObject.location.assign(loginUrl(classroomId));
        return;
      }
      if (result.pending) {
        button.textContent = "รออนุมัติ";
        status.textContent = "ระบบรับคำขอแล้ว ผู้สอนจะตรวจสถานะอาจารย์หรือนักวิจัยก่อนอนุมัติ";
      } else {
        button.textContent = "ลงทะเบียนแล้ว";
        status.textContent = "ลงทะเบียนเรียบร้อยแล้ว";
      }
      status.classList.add("is-success");
      document.querySelector("site-header")?.updateClassroomCta?.("classroom");
    } catch (_error) {
      button.disabled = false;
      button.textContent = "ลองส่งคำขออีกครั้ง";
      status.textContent = "ระบบลงทะเบียนยังไม่พร้อม กรุณาลองใหม่ภายหลัง";
      status.classList.add("is-error");
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
