(function classroomModule(globalObject) {
  "use strict";

  const apiBase = "/api/ai-for-research/classrooms";

  function classroomIdFromPage(documentObject, search = globalObject.location?.search || "") {
    const queryId = new URLSearchParams(search).get("id") || "";
    if (/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(queryId)) return queryId;
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
    if (response.status === 409) return { authenticated: true, enrolled: false, closed: true };
    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      const pending = payload.status === "pending";
      return { authenticated: true, enrolled: !pending, pending, ...payload };
    }
    throw new Error("enrollment-unavailable");
  }

  async function publicDetails(classroomId, fetchImpl = globalObject.fetch) {
    const response = await fetchImpl(`${apiBase}/${encodeURIComponent(classroomId)}/public`, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) throw new Error("classroom-details-unavailable");
    return response.json();
  }

  function structuredItem(value) {
    const [title, ...descriptionParts] = String(value || "").split("|");
    return { title: title.trim(), description: descriptionParts.join("|").trim() };
  }

  function membershipFor(session, classroomId) {
    if (!Array.isArray(session?.classrooms)) return null;
    return session.classrooms.find((item) => item.classroom_id === classroomId) || null;
  }

  const testApi = { apiBase, classroomIdFromPage, loginUrl, sessionState, enroll, publicDetails, structuredItem, membershipFor };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.classroomTestApi = testApi;

  if (typeof document === "undefined") return;
  const classroomId = classroomIdFromPage(document);
  const button = document.querySelector("[data-enroll-button]");
  const status = document.querySelector("[data-enroll-status]");
  if (!classroomId || !button || !status) return;

  let authenticated = false;
  let instructor = false;
  let enrollmentStatus = "open";

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value || "";
  }

  function renderCards(selector, items) {
    const container = document.querySelector(selector);
    if (!container || !Array.isArray(items)) return;
    container.replaceChildren(...items.map((item, index) => {
      const parsed = structuredItem(item);
      const article = document.createElement("article");
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const heading = document.createElement("h3");
      heading.textContent = parsed.title;
      const paragraph = document.createElement("p");
      paragraph.textContent = parsed.description;
      article.append(number, heading);
      if (parsed.description) article.append(paragraph);
      return article;
    }));
  }

  function renderPublicDetails(payload) {
    const details = payload.details || {};
    enrollmentStatus = payload.enrollment_status || "draft";
    const statusLabels = { open: "เปิดรับลงทะเบียน", closed: "ปิดรับลงทะเบียน", draft: "ยังไม่เปิดลงทะเบียน" };
    setText("[data-public-eyebrow]", `${enrollmentStatus === "open" ? "Open classroom" : "Classroom"} · ${details.class_date}`);
    setText("[data-public-status]", statusLabels[enrollmentStatus] || statusLabels.draft);
    const statusBadge = document.querySelector("[data-public-status]");
    statusBadge?.classList.toggle("is-open", enrollmentStatus === "open");
    statusBadge?.classList.toggle("is-closed", enrollmentStatus !== "open");
    setText("[data-public-status-meta]", `${details.audience} · ${details.class_date}`);
    setText("[data-public-title]", details.public_title);
    setText("[data-public-cohort]", details.cohort_title);
    setText("[data-public-summary]", details.summary);
    setText("[data-public-no-code]", details.no_code_method);
    setText("[data-public-date]", details.class_date);
    setText("[data-public-audience]", details.audience);
    setText("[data-public-overview-audience]", details.audience);
    setText("[data-public-mode]", details.delivery_mode);
    setText("[data-public-fee]", details.fee);
    setText("[data-public-admission]", details.admission_note);
    setText("[data-public-overview]", details.overview);
    setText("[data-public-scope]", details.scope);
    setText("[data-public-language]", details.language);
    setText("[data-public-prerequisites]", details.prerequisites);
    setText("[data-public-audience-notice-title]", details.audience_notice_title);
    setText("[data-public-audience-notice-body]", details.audience_notice_body);
    setText("[data-public-preparation-intro]", details.preparation_intro);
    setText("[data-public-device-note]", details.device_note);
    setText("[data-public-fallback-note]", details.fallback_note);
    const tags = document.querySelector("[data-public-tags]");
    if (tags && Array.isArray(details.tags)) {
      tags.replaceChildren(...details.tags.map((tag) => {
        const item = document.createElement("li");
        item.textContent = tag;
        return item;
      }));
    }
    renderCards("[data-public-preparation-items]", details.preparation_items);
    renderCards("[data-public-takeaways]", details.takeaways);
    renderCards("[data-public-learning-outcomes]", details.learning_outcomes);
    const syllabus = document.querySelector("[data-public-syllabus]");
    if (syllabus && Array.isArray(payload.syllabus)) {
      syllabus.replaceChildren(...payload.syllabus.map((module, index) => {
        const item = document.createElement("li");
        const number = document.createElement("span");
        number.textContent = String(index + 1).padStart(2, "0");
        const content = document.createElement("div");
        const titleRow = document.createElement("div");
        titleRow.className = "syllabus-title-row";
        const heading = document.createElement("h3");
        heading.textContent = module.title;
        const duration = document.createElement("span");
        duration.textContent = module.duration || "";
        const paragraph = document.createElement("p");
        paragraph.textContent = module.description;
        titleRow.append(heading);
        if (module.duration) titleRow.append(duration);
        content.append(titleRow, paragraph);
        item.append(number, content);
        return item;
      }));
    }
    document.title = `${details.public_title} · AI for Research`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = details.summary;
  }

  function renderUnavailableEnrollment() {
    button.disabled = true;
    button.textContent = enrollmentStatus === "closed" ? "ปิดรับลงทะเบียน" : "ยังไม่เปิดลงทะเบียน";
    status.textContent = enrollmentStatus === "closed"
      ? "คลาสนี้ปิดรับคำขอลงทะเบียนแล้ว"
      : "รายละเอียดคลาสอยู่ระหว่างเตรียมการ";
  }
  function renderGuest(unavailable = false) {
    authenticated = false;
    if (enrollmentStatus !== "open") {
      renderUnavailableEnrollment();
      return;
    }
    button.disabled = false;
    button.textContent = "เข้าสู่ระบบเพื่อลงทะเบียน";
    status.textContent = unavailable
      ? "ยังตรวจ session จากระบบจริงไม่ได้ คุณสามารถเข้าสู่ระบบเพื่อดำเนินการต่อ"
      : "ดูรายละเอียดได้โดยไม่ต้อง login เมื่อพร้อมแล้วจึงเข้าสู่ระบบเพื่อส่งคำขอ";
  }

  function renderSession(state) {
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
    if (enrollmentStatus !== "open") {
      renderUnavailableEnrollment();
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
  }

  async function initialize() {
    try {
      renderPublicDetails(await publicDetails(classroomId));
    } catch (_error) {
      // Keep the server-rendered fallback so the current class remains readable.
    }
    renderSession(await sessionState());
  }

  initialize();

  button.addEventListener("click", async () => {
    if (instructor) {
      globalObject.location.assign(`admin/?id=${encodeURIComponent(classroomId)}`);
      return;
    }
    if (enrollmentStatus !== "open") {
      renderUnavailableEnrollment();
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
      if (result.closed) {
        enrollmentStatus = "closed";
        renderUnavailableEnrollment();
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
