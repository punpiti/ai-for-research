(function instructorAdminModule(globalObject) {
  "use strict";

  const apiBase = "/api/ai-for-research/classrooms";
  const classroomListEndpoint = `${apiBase}/instructor/classes`;

  function classroomIdFromSearch(search, fallback = "") {
    const value = new URLSearchParams(String(search || "")).get("id") || fallback;
    return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(value) ? value : "";
  }

  function loginPath(classroomId) {
    const next = classroomId ? `admin/?id=${encodeURIComponent(classroomId)}` : "admin/";
    return `../login.html?next=${encodeURIComponent(next)}`;
  }

  function dashboardEndpoint(classroomId) {
    return `${apiBase}/${encodeURIComponent(classroomId)}/instructor`;
  }

  function formatTokens(value) {
    return Number.isInteger(value) ? new Intl.NumberFormat("th-TH").format(value) : "—";
  }

  function submissionLabel(status) {
    return ({
      completed: "เสร็จแล้ว",
      completed_with_help: "เสร็จโดยมีผู้ช่วย",
      could_not_complete: "ยังทำไม่สำเร็จ",
      not_submitted: "ยังไม่ส่ง",
    })[status] || status || "ยังไม่ส่ง";
  }

  function enrollmentLabel(status) {
    return ({ active: "อนุมัติแล้ว", pending: "รออนุมัติ", rejected: "ไม่อนุมัติ" })[status] || status;
  }

  const testApi = { apiBase, classroomListEndpoint, classroomIdFromSearch, loginPath, dashboardEndpoint, formatTokens, submissionLabel, enrollmentLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.instructorAdminTestApi = testApi;

  if (typeof document === "undefined") return;
  let classroomId = classroomIdFromSearch(globalObject.location.search);
  const pageStatus = document.querySelector("[data-page-status]");
  const classroomSelector = document.querySelector("[data-classroom-selector]");
  const sourceClassroom = document.querySelector("[data-source-classroom]");
  const publicClassLink = document.querySelector("[data-public-class-link]");
  const createDialog = document.querySelector("[data-create-class-dialog]");
  const createForm = document.querySelector("[data-create-class-form]");
  const createStatus = document.querySelector("[data-create-class-status]");
  const enrollmentRows = document.querySelector("[data-enrollment-rows]");
  const submissionRows = document.querySelector("[data-submission-rows]");
  const moduleList = document.querySelector("[data-module-list]");
  const syllabusForm = document.querySelector("[data-syllabus-form]");
  const syllabusStatus = document.querySelector("[data-syllabus-status]");

  function node(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  async function request(path, options = {}) {
    const response = await globalObject.fetch(path, {
      credentials: "same-origin",
      headers: { "Accept": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      globalObject.location.assign(loginPath(classroomId));
      throw new Error("authentication-required");
    }
    if (!response.ok) throw new Error(payload.detail || "โหลดข้อมูลไม่สำเร็จ");
    return payload;
  }

  function classOption(item) {
    const kind = item.classroom_type === "template" ? "ต้นแบบ · " : "";
    const code = item.course_code ? `${item.course_code} · ` : "";
    const option = node("option", "", `${kind}${code}${item.title} — ${item.classroom_id}`);
    option.value = item.classroom_id;
    return option;
  }

  function renderClassroomChoices(classes) {
    classroomSelector.replaceChildren(...classes.map(classOption));
    sourceClassroom.replaceChildren(...classes.map(classOption));
    const selected = classes.some((item) => item.classroom_id === classroomId)
      ? classroomId
      : classes[0]?.classroom_id || "";
    if (!selected) throw new Error("ยังไม่มีคลาสที่คุณเป็นผู้สอน");
    classroomId = selected;
    const selectedClass = classes.find((item) => item.classroom_id === classroomId);
    classroomSelector.value = classroomId;
    sourceClassroom.value = classroomId;
    publicClassLink.href = `../classroom.html?id=${encodeURIComponent(classroomId)}`;
    publicClassLink.hidden = selectedClass?.classroom_type === "template";
    const canonicalSearch = `?id=${encodeURIComponent(classroomId)}`;
    if (globalObject.location.search !== canonicalSearch) {
      globalObject.history.replaceState(null, "", canonicalSearch);
    }
  }

  function renderSummary(data) {
    const code = data.classroom.course_code ? `${data.classroom.course_code} · ` : "";
    const english = data.classroom.title_en ? ` / ${data.classroom.title_en}` : "";
    document.querySelector("[data-class-title]").textContent = `${code}${data.classroom.title}${english}`;
    document.querySelector("[data-summary-enrolled]").textContent = data.enrollments.filter((item) => item.status === "active").length;
    document.querySelector("[data-summary-pending]").textContent = data.enrollments.filter((item) => item.status === "pending").length;
    document.querySelector("[data-summary-module]").textContent = data.classroom.active_module_id?.replace("module-", "M") || "—";
    document.querySelector("[data-active-module]").textContent = data.classroom.active_module_title
      ? `${data.classroom.active_module_id.replace("module-", "M")} · ${data.classroom.active_module_title}`
      : "ยังไม่ได้เลือก";
  }

  function renderEnrollments(data) {
    enrollmentRows.replaceChildren();
    data.enrollments.forEach((item) => {
      const row = node("tr");
      const person = node("td");
      person.append(node("strong", "", item.display_name || item.email), node("small", "", item.email));
      row.append(person, node("td", "", item.role === "teacher" ? "ผู้สอน" : "ผู้เรียน"));

      const statusCell = node("td");
      const statusSelect = node("select");
      statusSelect.setAttribute("aria-label", `สถานะของ ${item.display_name || item.email}`);
      [["pending", "รออนุมัติ"], ["active", "อนุมัติแล้ว"], ["rejected", "ไม่อนุมัติ"]].forEach(([value, label]) => {
        const option = node("option", "", label);
        option.value = value;
        option.selected = item.status === value;
        statusSelect.append(option);
      });
      if (item.role === "teacher") statusSelect.disabled = true;
      statusCell.append(statusSelect);

      const quotaCell = node("td");
      const quotaInput = node("input");
      quotaInput.type = "number";
      quotaInput.min = "0";
      quotaInput.max = "1000000000";
      quotaInput.step = "1000";
      quotaInput.value = item.token_quota ?? "";
      quotaInput.placeholder = "ไม่จำกัด";
      quotaInput.setAttribute("aria-label", `Token quota ของ ${item.display_name || item.email}`);
      quotaCell.append(quotaInput);

      const usageCell = node("td", "", formatTokens(item.token_usage));
      usageCell.append(node("small", "", item.token_records ? `${item.token_records} records` : "ยังไม่มีข้อมูล"));

      const actionCell = node("td");
      const saveButton = node("button", "button secondary instructor-row-save", "บันทึก");
      saveButton.type = "button";
      saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        saveButton.textContent = "กำลังบันทึก…";
        try {
          const rawQuota = quotaInput.value.trim();
          await request(`${dashboardEndpoint(classroomId)}/enrollments/${encodeURIComponent(item.user_id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: statusSelect.value, token_quota: rawQuota === "" ? null : Number(rawQuota) }),
          });
          saveButton.textContent = "บันทึกแล้ว";
        } catch (error) {
          saveButton.textContent = error.message === "authentication-required" ? "เข้าสู่ระบบใหม่" : "ลองอีกครั้ง";
        } finally {
          saveButton.disabled = false;
        }
      });
      actionCell.append(saveButton);
      row.append(statusCell, quotaCell, usageCell, actionCell);
      enrollmentRows.append(row);
    });
  }

  function renderSyllabus(data) {
    moduleList.replaceChildren();
    data.syllabus.forEach((module) => {
      const card = node("article", `instructor-module${module.active ? " is-active" : ""}`);
      const includeLabel = node("label", "instructor-module-include");
      const checkbox = node("input");
      checkbox.type = "checkbox";
      checkbox.name = "included_module";
      checkbox.value = module.id;
      checkbox.checked = module.included;
      includeLabel.append(checkbox, node("span", "", "อยู่ใน Syllabus"));
      const activeLabel = node("label", "instructor-module-active");
      const radio = node("input");
      radio.type = "radio";
      radio.name = "active_module";
      radio.value = module.id;
      radio.checked = module.active;
      activeLabel.append(radio, node("span", "", "Active"));
      card.append(node("strong", "", `${module.id.replace("module-", "M")} · ${module.title}`), includeLabel, activeLabel);
      moduleList.append(card);
    });
  }

  function renderSubmissions(data) {
    submissionRows.replaceChildren();
    data.submissions.forEach((item) => {
      const row = node("tr");
      const person = node("td");
      person.append(node("strong", "", item.display_name || item.email), node("small", "", item.email));
      row.append(
        person,
        node("td", "", enrollmentLabel(item.enrollment_status)),
        node("td", `submission-status is-${item.status}`, submissionLabel(item.status)),
        node("td", "", item.submitted_at ? new Date(item.submitted_at).toLocaleString("th-TH") : "—"),
        node("td", "", formatTokens(item.total_tokens)),
        node("td", "", String(item.attempt_count || 0)),
      );
      submissionRows.append(row);
    });
  }

  async function loadDashboard() {
    try {
      const data = await request(dashboardEndpoint(classroomId));
      renderSummary(data);
      renderEnrollments(data);
      renderSyllabus(data);
      renderSubmissions(data);
      pageStatus.textContent = `อัปเดตล่าสุด ${new Date(data.refreshed_at).toLocaleString("th-TH")}`;
    } catch (error) {
      if (error.message !== "authentication-required") {
        pageStatus.textContent = error.message === "Instructor access is required for this classroom."
          ? "หน้านี้เปิดสำหรับผู้สอนของคลาสเท่านั้น"
          : error.message;
        pageStatus.classList.add("is-error");
      }
    }
  }

  syllabusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const moduleIds = [...syllabusForm.querySelectorAll('input[name="included_module"]:checked')].map((item) => item.value);
    const activeModuleId = syllabusForm.querySelector('input[name="active_module"]:checked')?.value || null;
    if (!moduleIds.length || (activeModuleId && !moduleIds.includes(activeModuleId))) {
      syllabusStatus.textContent = "Active module ต้องอยู่ใน Syllabus และต้องมีอย่างน้อยหนึ่งโมดูล";
      return;
    }
    syllabusStatus.textContent = "กำลังบันทึก…";
    try {
      await request(`${dashboardEndpoint(classroomId)}/syllabus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_ids: moduleIds, active_module_id: activeModuleId }),
      });
      syllabusStatus.textContent = "บันทึกแล้ว";
      await loadDashboard();
    } catch (error) {
      if (error.message !== "authentication-required") syllabusStatus.textContent = error.message;
    }
  });

  classroomSelector.addEventListener("change", () => {
    const selected = classroomIdFromSearch(`?id=${encodeURIComponent(classroomSelector.value)}`);
    if (selected) globalObject.location.assign(`?id=${encodeURIComponent(selected)}`);
  });

  document.querySelector("[data-open-create-class]").addEventListener("click", () => {
    createStatus.textContent = "";
    createForm.elements.title.value = "";
    sourceClassroom.value = classroomId;
    if (typeof createDialog.showModal === "function") createDialog.showModal();
    else createDialog.setAttribute("open", "");
  });

  document.querySelector("[data-close-create-class]").addEventListener("click", () => {
    if (typeof createDialog.close === "function") createDialog.close();
    else createDialog.removeAttribute("open");
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!createForm.reportValidity()) return;
    const submitButton = createForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    createStatus.textContent = "กำลังสร้างคลาส…";
    try {
      const result = await request(classroomListEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.elements.title.value.trim(),
          source_classroom_id: sourceClassroom.value,
        }),
      });
      globalObject.location.assign(`?id=${encodeURIComponent(result.classroom.classroom_id)}`);
    } catch (error) {
      if (error.message !== "authentication-required") createStatus.textContent = error.message;
      submitButton.disabled = false;
    }
  });

  document.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await request(`${apiBase}/auth/logout`, { method: "POST" });
    } finally {
      globalObject.location.assign("../index.html");
    }
  });

  async function initialize() {
    try {
      const result = await request(classroomListEndpoint);
      renderClassroomChoices(result.classes || []);
      await loadDashboard();
    } catch (error) {
      if (error.message !== "authentication-required") {
        pageStatus.textContent = error.message;
        pageStatus.classList.add("is-error");
      }
    }
  }

  initialize();
})(typeof window !== "undefined" ? window : globalThis);
