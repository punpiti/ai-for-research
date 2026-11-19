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

  function moduleContentPath(moduleId, classroomId = "") {
    const match = /^module-([1-9])$/.exec(String(moduleId || ""));
    if (!match) return "../prepare.html";
    const path = match[1] === "1" ? "prepare.html" : `module-${match[1]}.html`;
    return classroomId
      ? `/api/ai-for-research/classrooms/${encodeURIComponent(classroomId)}/content/${path}?classroom_id=${encodeURIComponent(classroomId)}`
      : `../${path}`;
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

  function parseBulkEmails(value) {
    return [...new Set(String(value || "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  }

  function roleLabel(role) {
    return ({ teacher: "ผู้สอน", ta: "TA", student: "ผู้เรียน" })[role] || "ผู้เรียน";
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  }

  // AI budget in USD: missing/invalid -> 0 (never "unlimited").
  function budgetValue(item) {
    const value = Number(item?.ai_budget_usd);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  // OpenRouter spend of a class key: "$0.25 / $2.00" (used / key limit), or "" when unknown.
  function usageText(key) {
    const used = Number(key?.usage_usd);
    if (key?.usage_usd === null || key?.usage_usd === undefined || !Number.isFinite(used)) return "";
    const limit = Number(key.limit_usd);
    const limitText = key.limit_usd === null || key.limit_usd === undefined || !Number.isFinite(limit) ? "—" : `$${limit.toFixed(2)}`;
    return `$${used.toFixed(2)} / ${limitText}`;
  }

  // Input text -> budget (0-1000, cents precision) or null when invalid. Empty means 0.
  function parseBudget(raw) {
    const text = String(raw ?? "").trim();
    if (text === "") return 0;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 1000) return null;
    return Math.round(value * 100) / 100;
  }

  // PATCH body for one enrollment row: status + legacy token_quota always, role only for non-teachers.
  function enrollmentPatchBody(item, { status, role, budget }) {
    const body = { status, token_quota: item.token_quota ?? null, ai_budget_usd: budget };
    if (item.role !== "teacher" && ["student", "ta"].includes(role)) body.role = role;
    return body;
  }

  function enrollmentName(item) {
    return (item.display_name || "").trim()
      || [item.given_name, item.family_name].filter(Boolean).join(" ")
      || item.email || "—";
  }

  function matchesEnrollmentFilter(item, { query = "", role = "all", status = "all" } = {}) {
    if (role !== "all" && item.role !== role) return false;
    if (status !== "all" && item.status !== status) return false;
    const needle = String(query).trim().toLowerCase();
    if (!needle) return true;
    return [item.display_name, item.given_name, item.family_name, item.email]
      .some((value) => String(value || "").toLowerCase().includes(needle));
  }

  const testApi = { apiBase, classroomListEndpoint, classroomIdFromSearch, loginPath, dashboardEndpoint, moduleContentPath, formatTokens, submissionLabel, enrollmentLabel, parseBulkEmails, roleLabel, formatDateTime, budgetValue, usageText, parseBudget, enrollmentPatchBody, enrollmentName, matchesEnrollmentFilter };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.instructorAdminTestApi = testApi;

  if (typeof document === "undefined") return;
  let classroomId = classroomIdFromSearch(globalObject.location.search);
  let classroomType = "class";
  const pageStatus = document.querySelector("[data-page-status]");
  const classroomSelector = document.querySelector("[data-classroom-selector]");
  const airrAdminLink = document.querySelector("[data-airr-admin-link]");
  const sourceClassroom = document.querySelector("[data-source-classroom]");
  const publicClassLink = document.querySelector("[data-public-class-link]");
  const openCreateClass = document.querySelector("[data-open-create-class]");
  const createDialog = document.querySelector("[data-create-class-dialog]");
  const createDialogTitle = document.querySelector("#create-class-title");
  const createForm = document.querySelector("[data-create-class-form]");
  const createStatus = document.querySelector("[data-create-class-status]");
  const enrollmentRows = document.querySelector("[data-enrollment-rows]");
  const instructorManagementForm = document.querySelector("[data-instructor-management-form]");
  const instructorEmail = document.querySelector("[data-instructor-email]");
  const instructorAdd = document.querySelector("[data-instructor-add]");
  const instructorManagementStatus = document.querySelector("[data-instructor-management-status]");
  const studentManagementForm = document.querySelector("[data-student-management-form]");
  const studentEmails = document.querySelector("[data-student-emails]");
  const studentAdd = document.querySelector("[data-student-add]");
  const studentManagementStatus = document.querySelector("[data-student-management-status]");
  const enrollmentSearch = document.querySelector("[data-enrollment-search]");
  const enrollmentRoleFilter = document.querySelector("[data-enrollment-role-filter]");
  const enrollmentStatusFilter = document.querySelector("[data-enrollment-status-filter]");
  const enrollmentCount = document.querySelector("[data-enrollment-count]");
  const enrollmentFilter = { query: "", role: "all", status: "all" };
  const expandedEnrollments = new Set();
  let enrollmentItems = [];
  const submissionRows = document.querySelector("[data-submission-rows]");
  const submissionModuleRows = document.querySelector("[data-submission-module-rows]");
  const recentSubmissionRows = document.querySelector("[data-recent-submission-rows]");
  const submissionsLive = document.querySelector("[data-submissions-live]");
  const refreshSubmissions = document.querySelector("[data-refresh-submissions]");
  const moduleList = document.querySelector("[data-module-list]");
  const syllabusForm = document.querySelector("[data-syllabus-form]");
  const syllabusStatus = document.querySelector("[data-syllabus-status]");
  const syllabusActions = document.querySelector("[data-syllabus-actions]");
  const templateNotice = document.querySelector("[data-template-notice]");
  const classOnlyElements = [...document.querySelectorAll("[data-class-only]")];
  const templateOnlyElements = [...document.querySelectorAll("[data-template-only]")];
  const classDetailsForm = document.querySelector("[data-class-details-form]");
  const classDetailsStatus = document.querySelector("[data-class-details-status]");
  const classConfigForm = document.querySelector("[data-class-config-form]");
  const classConfigStatus = document.querySelector("[data-class-config-status]");
  const adminOnlyElements = [...document.querySelectorAll("[data-admin-only]")];
  const detailStringFields = [
    "public_title", "cohort_title", "summary", "class_date", "audience", "delivery_mode",
    "fee", "admission_note", "overview", "scope", "language", "prerequisites",
    "audience_notice_title", "audience_notice_body", "no_code_method", "preparation_intro",
    "device_note", "fallback_note",
  ];
  const detailLineFields = ["preparation_items", "takeaways", "learning_outcomes"];
  const adminTabButtons = [...document.querySelectorAll("[data-admin-tab]")];
  const adminPanels = [...document.querySelectorAll("[data-admin-panel]")];
  let activeAdminTab = "details";
  let submissionRefreshTimer = null;
  let canManageInstructors = false;
  let canManageStudents = false;
  let viewerEmail = "";
  let currentContentRoute = "";
  let currentEnrollmentStatus = "draft";
  let canManageClassConfig = false;

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

  function activateAdminTab(tabName) {
    const availableTabs = classroomType === "template"
      ? [...(canManageClassConfig ? ["config"] : []), "template-details", "syllabus"]
      : [...(canManageClassConfig ? ["config"] : []), "details", "enrollment", "syllabus", "submissions", "status"];
    const selectedTab = availableTabs.includes(tabName) ? tabName : availableTabs[0];
    activeAdminTab = selectedTab;
    adminTabButtons.forEach((button) => {
      const selected = button.dataset.adminTab === selectedTab;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
    adminPanels.forEach((panel) => {
      const unavailable = (classroomType === "template" && panel.hasAttribute("data-class-only"))
        || (classroomType !== "template" && panel.hasAttribute("data-template-only"));
      panel.hidden = unavailable || panel.dataset.adminPanel !== selectedTab;
    });
    if (globalObject.history?.replaceState) {
      globalObject.history.replaceState(null, "", `${globalObject.location.search || ""}#${selectedTab}`);
    }
    setSubmissionPolling();
  }

  function applyClassroomMode(classroom) {
    classroomType = classroom?.classroom_type === "template" ? "template" : "class";
    const isTemplate = classroomType === "template";
    templateNotice.hidden = !isTemplate;
    classOnlyElements.forEach((element) => { element.hidden = isTemplate; });
    templateOnlyElements.forEach((element) => { element.hidden = !isTemplate; });
    syllabusActions.hidden = isTemplate;
    openCreateClass.textContent = isTemplate ? "คัดลอกเป็นคลาสใหม่" : "+ สร้างคลาสใหม่";
    publicClassLink.hidden = isTemplate;
    const requestedTab = String(globalObject.location.hash || "").replace(/^#/, "");
    const knownTabs = ["config", "template-details", "details", "enrollment", "syllabus", "submissions", "status"];
    const initialTab = knownTabs.includes(requestedTab)
      ? requestedTab
      : isTemplate ? "template-details" : "details";
    activateAdminTab(initialTab);
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
    applyClassroomMode(selectedClass);
    classroomSelector.value = classroomId;
    sourceClassroom.value = classroomId;
    publicClassLink.href = `../classroom.html?id=${encodeURIComponent(classroomId)}`;
    if (airrAdminLink) airrAdminLink.href = `airr.html?id=${encodeURIComponent(classroomId)}`;
    const canonicalSearch = `?id=${encodeURIComponent(classroomId)}`;
    if (globalObject.location.search !== canonicalSearch) {
      globalObject.history.replaceState(null, "", `${canonicalSearch}${globalObject.location.hash || ""}`);
    }
  }

  function renderSummary(data) {
    const code = data.classroom.course_code ? `${data.classroom.course_code} · ` : "";
    const english = data.classroom.title_en ? ` / ${data.classroom.title_en}` : "";
    document.querySelector("[data-class-title]").textContent = `${code}${data.classroom.title}${english}`;
    // Learners = role "student"; TAs are counted on their own (summary, chips).
    document.querySelector("[data-summary-enrolled]").textContent = data.enrollments.filter((item) => item.role === "student" && item.status === "active").length;
    const taSummary = document.querySelector("[data-summary-ta]");
    if (taSummary) taSummary.textContent = data.enrollments.filter((item) => item.role === "ta" && item.status === "active").length;
    document.querySelector("[data-summary-pending]").textContent = data.enrollments.filter((item) => item.status === "pending").length;
    document.querySelector("[data-summary-module]").textContent = data.classroom.active_module_id?.replace("module-", "M") || "—";
    document.querySelector("[data-active-module]").textContent = data.classroom.active_module_title
      ? `${data.classroom.active_module_id.replace("module-", "M")} · ${data.classroom.active_module_title}`
      : "ยังไม่ได้เลือก";
    const isAdmin = data.permissions?.can_manage_class_config === true;
    canManageClassConfig = isAdmin;
    adminOnlyElements.forEach((element) => { element.hidden = !isAdmin; });
    document.querySelector("[data-admin-role-eyebrow]").textContent = isAdmin ? "Administrator · instructor access" : "Instructor classroom";
    document.querySelector("[data-admin-role-title]").innerHTML = isAdmin ? "หน้าของ<br><span>ผู้ดูแลระบบ</span>" : "หน้าของ<br><span>อาจารย์</span>";
  }

  function renderClassDetails(data) {
    if (data.classroom.classroom_type === "template") return;
    const details = data.classroom.public_details || {};
    currentEnrollmentStatus = data.classroom.enrollment_status || "draft";
    const contentRoutes = Array.isArray(data.classroom.module3_routes) ? data.classroom.module3_routes : [];
    currentContentRoute = contentRoutes.length === 1 && ["student", "faculty"].includes(contentRoutes[0])
      ? contentRoutes[0] : "";
    for (const input of classDetailsForm.elements.content_route) input.checked = input.value === currentContentRoute;
    detailStringFields.forEach((key) => {
      classDetailsForm.elements[key].value = details[key] || "";
    });
    classDetailsForm.elements.tags.value = Array.isArray(details.tags) ? details.tags.join(", ") : "";
    detailLineFields.forEach((key) => {
      classDetailsForm.elements[key].value = Array.isArray(details[key]) ? details[key].join("\n") : "";
    });
  }

  function renderClassConfig(data) {
    if (!canManageClassConfig) return;
    const classroom = data.classroom || {};
    classConfigForm.elements.classroom_id.value = classroom.classroom_id || classroomId;
    classConfigForm.elements.subject.value = [classroom.subject_id, classroom.subject_title].filter(Boolean).join(" · ") || "—";
    classConfigForm.elements.course.value = [classroom.course_code, classroom.course_title || classroom.course_id].filter(Boolean).join(" · ") || "—";
    classConfigForm.elements.classroom_type.value = classroom.classroom_type === "template" ? "ต้นแบบ (อ่านอย่างเดียว)" : "คลาสใช้งาน";
    classConfigForm.elements.title.value = classroom.title || "";
    classConfigForm.elements.enrollment_status.value = classroom.enrollment_status || "draft";
    const locked = classroom.classroom_type === "template";
    classConfigForm.elements.title.disabled = locked;
    classConfigForm.elements.enrollment_status.disabled = locked;
    classConfigForm.querySelector('button[type="submit"]').hidden = locked;
  }

  function renderTemplateDetails(data) {
    if (data.classroom.classroom_type !== "template") return;
    const details = data.classroom.public_details || {};
    const setText = (selector, value, fallback = "—") => {
      document.querySelector(selector).textContent = value || fallback;
    };
    setText("[data-template-course-code]", data.classroom.course_code);
    setText("[data-template-public-title]", details.public_title || data.classroom.title);
    setText("[data-template-cohort]", details.cohort_title, "ต้นแบบรายวิชา");
    setText("[data-template-summary]", details.summary, "ยังไม่ได้กำหนดคำโปรย");
    setText("[data-template-audience]", details.audience);
    setText("[data-template-date]", details.class_date);
    setText("[data-template-delivery]", details.delivery_mode);
    setText("[data-template-fee]", details.fee);
    setText("[data-template-overview]", details.overview);
    const tags = Array.isArray(details.tags) ? details.tags : [];
    document.querySelector("[data-template-tags]").replaceChildren(
      ...tags.map((tag) => node("li", "", tag)),
    );
  }

  function classDetailsPayload() {
    const details = {};
    detailStringFields.forEach((key) => { details[key] = classDetailsForm.elements[key].value.trim(); });
    details.tags = classDetailsForm.elements.tags.value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    detailLineFields.forEach((key) => {
      details[key] = classDetailsForm.elements[key].value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    });
    return { enrollment_status: currentEnrollmentStatus, details };
  }

  const ROLE_FILTERS = [["all", "ทุกบทบาท"], ["teacher", "ผู้สอน"], ["ta", "TA"], ["student", "ผู้เรียน"]];
  const STATUS_FILTERS = [["all", "ทุกสถานะ"], ["pending", "รออนุมัติ"], ["active", "อนุมัติแล้ว"], ["rejected", "ไม่อนุมัติ"]];

  function renderEnrollmentChips() {
    const chip = (group, key, value, label, count) => {
      const button = node("button", "chip");
      button.type = "button";
      button.setAttribute("aria-pressed", String(enrollmentFilter[key] === value));
      button.append(node("span", "", label), node("span", "chip-count", String(count)));
      button.addEventListener("click", () => {
        enrollmentFilter[key] = value;
        renderEnrollmentChips();
        applyEnrollmentFilter();
      });
      group.append(button);
    };
    enrollmentRoleFilter.replaceChildren();
    enrollmentStatusFilter.replaceChildren();
    ROLE_FILTERS.forEach(([value, label]) => chip(enrollmentRoleFilter, "role", value, label,
      enrollmentItems.filter((item) => value === "all" || item.role === value).length));
    STATUS_FILTERS.forEach(([value, label]) => chip(enrollmentStatusFilter, "status", value, label,
      enrollmentItems.filter((item) => value === "all" || item.status === value).length));
  }

  function applyEnrollmentFilter() {
    let shown = 0;
    enrollmentRows.querySelectorAll("tr[data-enrollment-row]").forEach((row) => {
      const item = enrollmentItems[Number(row.dataset.enrollmentRow)];
      const visible = Boolean(item) && matchesEnrollmentFilter(item, enrollmentFilter);
      row.hidden = !visible;
      const detail = row.nextElementSibling;
      if (detail?.classList.contains("data-table-detail")) detail.hidden = !visible || !expandedEnrollments.has(item.user_id);
      if (visible) shown += 1;
    });
    enrollmentCount.textContent = `แสดง ${shown} จาก ${enrollmentItems.length} คน`;
    if (copyEmailsButton) copyEmailsButton.textContent = `คัดลอกอีเมล (${visibleEnrollmentEmails().length})`;
  }

  // emails of the rows the current filter shows, "a@x, b@y" for Gmail's To: field
  function visibleEnrollmentEmails() {
    return [...new Set(enrollmentItems.filter((item) => matchesEnrollmentFilter(item, enrollmentFilter))
      .map((item) => String(item.email || "").trim().toLowerCase()).filter((email) => email.includes("@")))];
  }

  const copyEmailsButton = document.querySelector("[data-enrollment-copy-emails]");
  copyEmailsButton?.addEventListener("click", async () => {
    const emails = visibleEnrollmentEmails();
    if (!emails.length) return;
    const text = emails.join(", ");
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch (error) { copied = false; }
    if (copied) {
      copyEmailsButton.textContent = `คัดลอกแล้ว ${emails.length} อีเมล ✓`;
      setTimeout(() => { copyEmailsButton.textContent = `คัดลอกอีเมล (${visibleEnrollmentEmails().length})`; }, 2500);
    } else {
      window.prompt("คัดลอกข้อความนี้ (Ctrl+C) แล้ววางในช่อง To: ของ Gmail", text);
    }
  });

  function enrollmentDetail(item) {
    const key = item.ai_key || null;
    const keyState = key ? ({ assigned: "ใช้งาน", disabled: "ปิดใช้" })[key.state] || key.state || "—" : "—";
    const tokenText = Number.isInteger(item.token_usage)
      ? `${formatTokens(item.token_usage)} token · ${item.token_records || 0} records`
      : "ยังไม่มีข้อมูล";
    const fields = [
      ["อีเมล", item.email || "—"],
      ["ชื่อ", item.given_name || "—"],
      ["นามสกุล", item.family_name || "—"],
      ["บทบาท", roleLabel(item.role)],
      ["สถานะการลงทะเบียน", enrollmentLabel(item.status) || "—"],
      ["บัญชี", item.account_status === "invited" ? "ได้รับเชิญ · ยังไม่เคยเข้าสู่ระบบ" : item.account_status === "active" ? "ใช้งานแล้ว" : "—"],
      ["ขอเข้าร่วมเมื่อ", formatDateTime(item.requested_at)],
      ["อัปเดตล่าสุด", formatDateTime(item.updated_at)],
      ["เข้าสู่ระบบล่าสุด", formatDateTime(item.last_login_at)],
      ["ใช้ AIRR ล่าสุด", formatDateTime(item.airr_last_used_at)],
      ["งบ AI", `$${budgetValue(item).toFixed(2)}`],
      ["AI key", key ? [key.label, key.tier, key.provider].filter(Boolean).join(" · ") || "—" : "ยังไม่ได้รับ"],
      ["สถานะ key", key?.provider_disabled ? "ปิดใน OpenRouter" : keyState],
      ["ใช้ไป / เพดาน (OpenRouter)", usageText(key) || (key ? "ยังไม่มีข้อมูลจาก OpenRouter" : "—")],
      ["ใช้ AI ล่าสุด", formatDateTime(key?.last_used_at)],
      ["ดึง key แล้ว", key && Number.isInteger(key.fetch_count) ? `${key.fetch_count} ครั้ง` : "—"],
      ["ดึง key ล่าสุด", formatDateTime(key?.last_fetched_at)],
      ["Token ที่ใช้", tokenText],
      ["จำนวนครั้งที่ส่งงาน", Number.isInteger(item.submission_attempts) ? String(item.submission_attempts) : "—"],
    ];
    const list = node("dl", "detail-grid");
    fields.forEach(([label, value]) => {
      const pair = node("div");
      pair.append(node("dt", "", label), node("dd", "", value));
      list.append(pair);
    });
    return list;
  }

  function renderEnrollments(data) {
    enrollmentRows.replaceChildren();
    if (data.classroom.classroom_type === "template") return;
    const management = data.member_management || {};
    canManageInstructors = management.can_manage_instructors === true;
    canManageStudents = management.can_manage_students === true;
    viewerEmail = String(data.viewer?.email || "").toLowerCase();
    (instructorManagementForm.closest("details") || instructorManagementForm).hidden = !canManageInstructors;
    (studentManagementForm.closest("details") || studentManagementForm).hidden = !canManageStudents;
    enrollmentItems = Array.isArray(data.enrollments) ? data.enrollments : [];
    enrollmentItems.forEach((item, index) => {
      const row = node("tr");
      row.dataset.enrollmentRow = String(index);
      const name = enrollmentName(item);
      const isTeacher = item.role === "teacher";
      const editable = !isTeacher && canManageStudents;
      const cell = (className, label) => {
        const td = node("td", className);
        td.dataset.label = label;
        return td;
      };

      const nameCell = cell("col-name", "ชื่อ");
      const nameLine = node("div", "cell-title");
      nameLine.append(node("strong", "truncate", name));
      if (item.owner) nameLine.append(node("span", "badge", "เจ้าของวิชา"));
      if (item.account_status === "invited") {
        const invited = node("span", "badge is-muted", "รอเข้าระบบ");
        invited.title = "ได้รับเชิญแล้ว แต่ยังไม่เคยเข้าสู่ระบบ";
        nameLine.append(invited);
      }
      nameLine.querySelector("strong").title = name;
      const emailLine = node("small", "truncate", item.email || "");
      emailLine.title = item.email || "";
      nameCell.append(nameLine, emailLine);

      const roleCell = cell("col-role", "บทบาท");
      let roleSelect = null;
      if (editable) {
        roleSelect = node("select");
        roleSelect.setAttribute("aria-label", `บทบาทของ ${name}`);
        roleSelect.dataset.enrollmentRole = "";
        [["student", "ผู้เรียน"], ["ta", "TA"]].forEach(([value, label]) => {
          const option = node("option", "", label);
          option.value = value;
          option.selected = (item.role === "ta" ? "ta" : "student") === value;
          roleSelect.append(option);
        });
        roleCell.append(roleSelect);
      } else {
        roleCell.textContent = roleLabel(item.role);
      }

      const statusCell = cell("col-status", "สถานะ");
      const statusSelect = node("select");
      statusSelect.setAttribute("aria-label", `สถานะของ ${name}`);
      [["pending", "รออนุมัติ"], ["active", "อนุมัติแล้ว"], ["rejected", "ไม่อนุมัติ"]].forEach(([value, label]) => {
        const option = node("option", "", label);
        option.value = value;
        option.selected = item.status === value;
        statusSelect.append(option);
      });
      statusSelect.disabled = !editable;
      statusCell.append(statusSelect);

      const budgetCell = cell("col-budget num", "งบ AI ($)");
      const budgetInput = node("input");
      budgetInput.type = "number";
      budgetInput.min = "0";
      budgetInput.max = "1000";
      budgetInput.step = "0.5";
      budgetInput.inputMode = "decimal";
      budgetInput.value = String(budgetValue(item));
      budgetInput.dataset.enrollmentBudget = "";
      budgetInput.setAttribute("aria-label", `งบ AI (ดอลลาร์) ของ ${name}`);
      budgetInput.disabled = !editable;
      budgetCell.append(budgetInput);

      // Module 1 gate: learners ask their AI to run `airr whoami`; show when AIRR was last used.
      const airrCell = cell("col-airr", "AIRR");
      airrCell.append(node("span", item.airr_last_used_at ? "is-ok" : "is-muted", item.airr_last_used_at ? "เชื่อมแล้ว" : (isTeacher ? "—" : "ยังไม่เชื่อม")));
      if (item.airr_last_used_at) airrCell.append(node("small", "", formatDateTime(item.airr_last_used_at)));

      const keyCell = cell("col-key", "AI key");
      if (item.ai_key) {
        const label = node("span", "truncate", item.ai_key.label || item.ai_key.tier || "มี key");
        label.title = [item.ai_key.label, item.ai_key.tier].filter(Boolean).join(" · ");
        keyCell.append(label);
        const used = usageText(item.ai_key);
        if (used) {
          const usage = node("small", "", used);
          usage.title = "ใช้ไป / เพดานของ key ใน OpenRouter";
          keyCell.append(usage);
        }
        if (item.ai_key.state === "disabled") keyCell.append(node("span", "badge is-muted", "ปิดใช้"));
      } else {
        keyCell.textContent = "—";
      }

      const detailId = `enrollment-detail-${index}`;
      const expandCell = cell("col-expand", "");
      const expandButton = node("button", "row-expand");
      expandButton.type = "button";
      expandButton.dataset.rowExpand = "";
      expandButton.setAttribute("aria-controls", detailId);
      expandButton.setAttribute("aria-label", `รายละเอียดของ ${name}`);
      expandButton.title = "ดูรายละเอียด";
      expandButton.innerHTML = '<span aria-hidden="true">▸</span><span class="row-expand-text">รายละเอียด</span>';
      expandCell.append(expandButton);

      const actionCell = cell("col-actions", "");
      if (editable) {
        // Autosave (บันทึกอัตโนมัติ): the state line stays empty until something is saving or saved.
        const saveState = node("small", "instructor-row-save-state");
        saveState.setAttribute("role", "status");
        saveState.setAttribute("aria-live", "polite");
        let savedStatus = item.status;
        let savedRole = item.role === "ta" ? "ta" : "student";
        let savedBudget = budgetValue(item);
        let budgetSaveTimer = null;
        const controls = [statusSelect, roleSelect, budgetInput];
        const saveEnrollment = async () => {
          globalObject.clearTimeout(budgetSaveTimer);
          const nextBudget = parseBudget(budgetInput.value);
          if (nextBudget === null) {
            saveState.textContent = "งบต้องอยู่ระหว่าง 0–1000";
            saveState.classList.add("is-error");
            return;
          }
          if (statusSelect.value === savedStatus && roleSelect.value === savedRole && nextBudget === savedBudget) {
            saveState.textContent = "บันทึกแล้ว";
            saveState.classList.remove("is-error");
            return;
          }
          controls.forEach((control) => { control.disabled = true; });
          saveState.textContent = "กำลังบันทึก…";
          saveState.classList.remove("is-error");
          try {
            const result = await request(`${dashboardEndpoint(classroomId)}/enrollments/${encodeURIComponent(item.user_id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(enrollmentPatchBody(item, { status: statusSelect.value, role: roleSelect.value, budget: nextBudget })),
            });
            const saved = result?.enrollment || {};
            savedStatus = saved.status || statusSelect.value;
            savedRole = ["student", "ta"].includes(saved.role) ? saved.role : roleSelect.value;
            savedBudget = Number.isFinite(Number(saved.ai_budget_usd)) ? Number(saved.ai_budget_usd) : nextBudget;
            Object.assign(item, { status: savedStatus, role: savedRole, ai_budget_usd: savedBudget });
            if (item.ai_key && item.ai_key.limit_usd !== undefined) item.ai_key.limit_usd = savedBudget;
            statusSelect.value = savedStatus;
            roleSelect.value = savedRole;
            budgetInput.value = String(savedBudget);
            saveState.textContent = "บันทึกแล้ว";
            renderSummary(data);
            renderEnrollmentChips();
            applyEnrollmentFilter();
            const detail = row.nextElementSibling;
            if (detail?.classList.contains("data-table-detail")) detail.firstChild.replaceChildren(enrollmentDetail(item));
          } catch (error) {
            statusSelect.value = savedStatus;
            roleSelect.value = savedRole;
            budgetInput.value = String(savedBudget);
            saveState.textContent = error.message === "authentication-required" ? "กรุณาเข้าสู่ระบบใหม่"
              : /OpenRouter/.test(error.message) ? "บันทึกไม่สำเร็จ: ปรับเพดานใน OpenRouter ไม่ได้" : "บันทึกไม่สำเร็จ";
            saveState.title = error.message || "";
            saveState.classList.add("is-error");
          } finally {
            controls.forEach((control) => { control.disabled = false; });
          }
        };
        statusSelect.addEventListener("change", saveEnrollment);
        roleSelect.addEventListener("change", saveEnrollment);
        budgetInput.addEventListener("input", () => {
          globalObject.clearTimeout(budgetSaveTimer);
          saveState.textContent = "รอบันทึก…";
          budgetSaveTimer = globalObject.setTimeout(saveEnrollment, 700);
        });
        budgetInput.addEventListener("change", saveEnrollment);
        actionCell.append(saveState);
      }
      const canRemove = isTeacher ? canManageInstructors : canManageStudents;
      if (canRemove) {
        const removeButton = node("button", "button secondary instructor-row-save", item.owner ? "Owner" : "นำออก");
        removeButton.type = "button";
        removeButton.disabled = item.owner === true || String(item.email || "").toLowerCase() === viewerEmail;
        removeButton.addEventListener("click", async () => {
          removeButton.disabled = true;
          removeButton.textContent = "กำลังนำออก…";
          // TAs leave through the students route (the backend accepts it).
          const collection = isTeacher ? "instructors" : "students";
          const statusNode = isTeacher ? instructorManagementStatus : studentManagementStatus;
          try {
            await request(`${dashboardEndpoint(classroomId)}/${collection}/${encodeURIComponent(item.email)}`, { method: "DELETE" });
            statusNode.textContent = `นำ ${item.email} ออกจากคลาสแล้ว`;
            await loadDashboard({ silent: true });
          } catch (error) {
            statusNode.textContent = error.message;
            removeButton.disabled = false;
            removeButton.textContent = "ลองอีกครั้ง";
          }
        });
        actionCell.append(removeButton);
      }

      row.append(nameCell, roleCell, statusCell, budgetCell, airrCell, keyCell, expandCell, actionCell);

      const detailRow = node("tr", "data-table-detail");
      detailRow.id = detailId;
      const detailCell = node("td");
      detailCell.colSpan = 8;
      detailCell.append(enrollmentDetail(item));
      detailRow.append(detailCell);
      const setExpanded = (open) => {
        expandButton.setAttribute("aria-expanded", String(open));
        row.classList.toggle("is-expanded", open);
        detailRow.hidden = !open;
        if (open) expandedEnrollments.add(item.user_id);
        else expandedEnrollments.delete(item.user_id);
      };
      setExpanded(expandedEnrollments.has(item.user_id));
      expandButton.addEventListener("click", () => setExpanded(expandButton.getAttribute("aria-expanded") !== "true"));

      enrollmentRows.append(row, detailRow);
    });
    renderEnrollmentChips();
    applyEnrollmentFilter();
  }

  function renderSyllabus(data) {
    moduleList.replaceChildren();
    const isTemplate = data.classroom.classroom_type === "template";
    data.syllabus.forEach((module) => {
      const moduleName = `${module.id.replace("module-", "M")} · ${module.title}`;
      const card = node("article", "instructor-module");

      if (isTemplate) {
        const content = node("div", "instructor-module-choice is-read-only");
        content.append(
          node("strong", "instructor-module-title", moduleName),
          node("span", "instructor-module-status", module.included ? "ใน Syllabus" : "ยังไม่รวม"),
        );
        if (module.active) content.append(node("span", "instructor-module-active-label", "โมดูลเริ่มต้น"));
        card.classList.add(module.included ? "is-included" : "is-excluded");
        card.classList.toggle("is-active", module.active);
        card.append(content, topicBox(module.id));
        moduleList.append(card);
        return;
      }

      const includeLabel = node("label", "instructor-module-choice");
      const checkbox = node("input");
      checkbox.type = "checkbox";
      checkbox.name = "included_module";
      checkbox.value = module.id;
      checkbox.checked = module.included;
      checkbox.className = "instructor-module-checkbox";
      checkbox.setAttribute("aria-label", `${moduleName}: รวมใน Syllabus`);
      const title = node("strong", "instructor-module-title", moduleName);
      const inclusionStatus = node("span", "instructor-module-status");
      includeLabel.append(checkbox, title, inclusionStatus);
      const activeLabel = node("label", "instructor-module-active");
      const radio = node("input");
      radio.type = "radio";
      radio.name = "active_module";
      radio.value = module.id;
      radio.checked = module.active;
      activeLabel.append(radio, node("span", "", "Active"));
      const syncCard = () => {
        card.classList.toggle("is-included", checkbox.checked);
        card.classList.toggle("is-excluded", !checkbox.checked);
        card.classList.toggle("is-active", radio.checked);
        inclusionStatus.textContent = checkbox.checked ? "ใน Syllabus" : "ยังไม่รวม";
      };
      checkbox.addEventListener("change", () => {
        if (!checkbox.checked && radio.checked) radio.checked = false;
        syncCard();
      });
      radio.addEventListener("change", () => {
        if (radio.checked) {
          checkbox.checked = true;
          moduleList.querySelectorAll(".instructor-module").forEach((item) => item.classList.remove("is-active"));
        }
        syncCard();
      });

      card.append(includeLabel, activeLabel, topicBox(module.id));
      syncCard();
      moduleList.append(card);
    });
    showClassTopics(data.classroom.classroom_id || classroomId);
  }

  // Topics learners of this class see, read from the class syllabus page that learners open
  // (owner 2026-11-18: show only; topics are not moved between modules here).
  const CLASS_SYLLABUS_PAGES = { "faculty-pilot-2569": "class-2026-11-20-engineering-faculty.html" };

  function topicBox(moduleId) {
    const box = node("div", "instructor-module-topics");
    box.dataset.moduleTopics = moduleId;
    return box;
  }

  function classTopicsFromPage(doc) {
    const byModule = {};
    doc.querySelectorAll("details.syllabus-module").forEach((details) => {
      const number = Number((details.id || "").replace(/^m0?/i, ""));
      if (!number) return;
      const upcoming = !details.querySelector("summary .status.is-open");
      byModule[`module-${number}`] = [...details.querySelectorAll("li[data-topic]")].map((li) => {
        const link = li.querySelector("a[href], span.locked[data-href]");
        return {
          id: li.dataset.topic,
          title: (link?.textContent || li.dataset.topic).trim(),
          href: link?.getAttribute("href") || link?.dataset.href || `topic-${li.dataset.topic}.html`,
          optional: Boolean(li.querySelector(".content-kind")),
          inPlan: !li.hasAttribute("data-tester-only"),
          upcoming,
        };
      });
    });
    return byModule;
  }

  async function showClassTopics(id) {
    const boxes = [...moduleList.querySelectorAll("[data-module-topics]")];
    const page = CLASS_SYLLABUS_PAGES[id];
    if (!page) {
      boxes.forEach((box) => box.replaceChildren(node("small", "instructor-topic-note", "คลาสนี้ยังไม่มีแผนหัวข้อ")));
      return;
    }
    let byModule;
    try {
      const response = await globalObject.fetch(`../${page}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      byModule = classTopicsFromPage(new DOMParser().parseFromString(await response.text(), "text/html"));
    } catch (_error) {
      boxes.forEach((box) => box.replaceChildren(node("small", "instructor-topic-note", "โหลดรายการหัวข้อไม่สำเร็จ")));
      return;
    }
    boxes.forEach((box) => {
      const topics = byModule[box.dataset.moduleTopics] || [];
      const used = topics.filter((topic) => topic.inPlan);
      const ordered = [...used, ...topics.filter((topic) => !topic.inPlan)];
      const upcoming = topics.some((topic) => topic.upcoming);
      const heading = node("p", "instructor-topic-heading", !topics.length ? "ยังไม่มีหัวข้อ"
        : `หัวข้อ · ใช้ในคลาสนี้ ${used.length} จาก ${topics.length}${upcoming ? " · โมดูลยังไม่เปิดให้ผู้เรียน" : ""}`);
      box.replaceChildren(heading);
      if (!ordered.length) return;
      // owner 2026-11-19: a checkbox per topic shows whether the class uses it (display only, not editable yet)
      const ul = node("ul", "instructor-topic-list");
      ordered.forEach((topic) => {
        const li = node("li", topic.inPlan ? "is-used" : "is-unused");
        const check = node("input");
        check.type = "checkbox";
        check.checked = topic.inPlan;
        check.tabIndex = -1;  // status only: keeps the colour of a normal checkbox, ignores clicks
        check.title = "แสดงสถานะเท่านั้น ยังแก้จากหน้านี้ไม่ได้";
        check.addEventListener("click", (event) => event.preventDefault());
        check.setAttribute("aria-label", `${topic.title}: ${topic.inPlan ? "ใช้ในคลาสนี้" : "ไม่ได้ใช้ในคลาสนี้"}`);
        const link = node("a", "", topic.title);
        link.href = `../${topic.href}`;
        link.target = "_blank";
        link.rel = "noopener";
        li.append(check, link);
        if (topic.optional) li.append(node("span", "instructor-topic-tag", "เสริม"));
        ul.append(li);
      });
      box.append(ul);
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

  function renderSubmissionOverview(data) {
    const overview = data.submission_overview || {};
    const summary = overview.summary || {};
    const metricValues = {
      "[data-submission-active-learners]": summary.active_learners,
      "[data-submission-learners]": summary.submitted_learners,
      "[data-submission-missing]": summary.not_submitted_learners,
      "[data-submission-count]": summary.submission_count,
      "[data-submission-completed]": summary.completed_submission_count,
      "[data-submission-tokens]": formatTokens(summary.total_tokens),
    };
    Object.entries(metricValues).forEach(([selector, value]) => {
      document.querySelector(selector).textContent = value ?? "—";
    });

    submissionModuleRows.replaceChildren();
    const modules = Array.isArray(overview.modules) ? overview.modules : [];
    if (!modules.length) {
      const row = node("tr");
      const cell = node("td", "submission-empty", "ยังไม่มีหัวข้อใน Syllabus");
      cell.colSpan = 7;
      row.append(cell);
      submissionModuleRows.append(row);
    }
    modules.forEach((module) => {
      const row = node("tr");
      const moduleCell = node("td");
      const moduleLink = node("a", "submission-module-link", `${module.module_id.replace("module-", "M")} · ${module.module_title}`);
      moduleLink.href = moduleContentPath(module.module_id, classroomId);
      moduleCell.append(
        moduleLink,
        node("small", "", module.tracked ? "รับข้อมูลการส่งงาน" : "ยังไม่มีช่องส่งงาน"),
      );
      if (!module.tracked) {
        row.classList.add("is-untracked");
        row.append(moduleCell, node("td", "", "—"), node("td", "", "ยังไม่เปิดรับงาน"), node("td", "", "—"), node("td", "", "—"), node("td", "", "—"), node("td", "", "—"));
        submissionModuleRows.append(row);
        return;
      }
      const learnerCount = module.learner_count || 0;
      const submitted = module.submitted_learners || 0;
      const percent = learnerCount ? Math.round((submitted / learnerCount) * 100) : 0;
      const progressCell = node("td");
      const progress = node("div", "submission-progress");
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-label", `${module.module_title}: ส่งแล้ว ${percent}%`);
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      progress.setAttribute("aria-valuenow", String(percent));
      const fill = node("span");
      fill.style.width = `${percent}%`;
      progress.append(fill);
      progressCell.append(progress, node("small", "", `${percent}%`));
      row.append(
        moduleCell,
        node("td", "", `${submitted}/${learnerCount}`),
        progressCell,
        node("td", "", String(module.submission_count || 0)),
        node("td", "", String(module.completed_learners || 0)),
        node("td", "", module.latest_at ? new Date(module.latest_at).toLocaleString("th-TH") : "—"),
        node("td", "", formatTokens(module.total_tokens)),
      );
      submissionModuleRows.append(row);
    });

    recentSubmissionRows.replaceChildren();
    const recent = Array.isArray(overview.recent) ? overview.recent : [];
    if (!recent.length) {
      const row = node("tr");
      const cell = node("td", "submission-empty", "ยังไม่มีการส่งงานจากผู้เรียนที่อนุมัติแล้ว");
      cell.colSpan = 6;
      row.append(cell);
      recentSubmissionRows.append(row);
    }
    recent.forEach((item) => {
      const row = node("tr");
      const person = node("td");
      person.append(node("strong", "", item.display_name || item.email), node("small", "", item.email));
      const work = node("td");
      const route = item.route ? ` · ${item.route}` : "";
      const workLink = node("a", "submission-module-link", item.module_title);
      workLink.href = moduleContentPath(item.module_id, classroomId);
      work.append(
        workLink,
        node("small", "", `${item.module_id.replace("module-", "M")}${route} · ${item.ai_tool || "ไม่ระบุ AI"}`),
      );
      row.append(
        person,
        work,
        node("td", `submission-status is-${item.status}`, submissionLabel(item.status)),
        node("td", "", item.submitted_at ? new Date(item.submitted_at).toLocaleString("th-TH") : "—"),
        node("td", "", formatTokens(item.total_tokens)),
        node("td", "", String(item.attempt_count || 1)),
      );
      recentSubmissionRows.append(row);
    });
    submissionsLive.lastChild.textContent = `อัปเดต ${new Date(data.refreshed_at).toLocaleTimeString("th-TH")} · อัตโนมัติทุก 15 วินาที`;
  }

  function setSubmissionPolling() {
    if (submissionRefreshTimer) {
      globalObject.clearInterval(submissionRefreshTimer);
      submissionRefreshTimer = null;
    }
    if (classroomType !== "template" && activeAdminTab === "submissions") {
      submissionRefreshTimer = globalObject.setInterval(() => {
        if (document.visibilityState !== "hidden") loadDashboard({ silent: true });
      }, 15000);
    }
  }

  async function loadDashboard({ silent = false } = {}) {
    try {
      const data = await request(dashboardEndpoint(classroomId));
      renderSummary(data);
      applyClassroomMode(data.classroom);
      renderClassConfig(data);
      renderClassDetails(data);
      renderTemplateDetails(data);
      renderEnrollments(data);
      renderSyllabus(data);
      renderSubmissions(data);
      renderSubmissionOverview(data);
      if (!silent) pageStatus.textContent = `อัปเดตล่าสุด ${new Date(data.refreshed_at).toLocaleString("th-TH")}`;
    } catch (error) {
      if (error.message !== "authentication-required") {
        const message = error.message === "Instructor access is required for this classroom."
          ? "หน้านี้เปิดสำหรับผู้สอนของคลาสเท่านั้น" : error.message;
        if (silent && submissionsLive) submissionsLive.lastChild.textContent = `หยุดอัปเดตชั่วคราว · ${message}`;
        else {
          pageStatus.textContent = message;
          pageStatus.classList.add("is-error");
        }
      }
    }
  }

  syllabusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (classroomType === "template") {
      syllabusStatus.textContent = "คัดลอกต้นแบบเป็นคลาสใหม่ก่อนแก้ไข Syllabus";
      return;
    }
    const moduleIds = [...syllabusForm.querySelectorAll('input[name="included_module"]:checked')].map((item) => item.value);
    const activeModuleId = syllabusForm.querySelector('input[name="active_module"]:checked')?.value || null;
    if (!moduleIds.length || (activeModuleId && !moduleIds.includes(activeModuleId))) {
      syllabusStatus.textContent = "Active module ต้องอยู่ใน Syllabus และต้องมีอย่างน้อยหนึ่งโมดูล";
      return;
    }
    if (!currentContentRoute) {
      syllabusStatus.textContent = "เลือกกลุ่มผู้เรียนในแท็บรายละเอียดคลาสก่อน";
      return;
    }
    syllabusStatus.textContent = "กำลังบันทึก…";
    try {
      await request(`${dashboardEndpoint(classroomId)}/syllabus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_ids: moduleIds, active_module_id: activeModuleId, module3_routes: [currentContentRoute] }),
      });
      syllabusStatus.textContent = "บันทึกแล้ว";
      await loadDashboard();
    } catch (error) {
      if (error.message !== "authentication-required") syllabusStatus.textContent = error.message;
    }
  });

  classDetailsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (classroomType === "template" || !classDetailsForm.reportValidity()) return;
    const submitButton = classDetailsForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    classDetailsStatus.textContent = "กำลังบันทึก…";
    try {
      const selectedContentRoute = classDetailsForm.elements.content_route.value;
      await request(`${dashboardEndpoint(classroomId)}/content-route`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_route: selectedContentRoute }),
      });
      await request(`${dashboardEndpoint(classroomId)}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classDetailsPayload()),
      });
      currentContentRoute = selectedContentRoute;
      classDetailsStatus.textContent = "บันทึกแล้ว";
      await loadDashboard();
    } catch (error) {
      if (error.message !== "authentication-required") classDetailsStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  classConfigForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageClassConfig || classroomType === "template" || !classConfigForm.reportValidity()) return;
    const submitButton = classConfigForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    classConfigStatus.textContent = "กำลังบันทึก…";
    try {
      await request(`${apiBase}/${encodeURIComponent(classroomId)}/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: classConfigForm.elements.title.value.trim(),
          enrollment_status: classConfigForm.elements.enrollment_status.value,
        }),
      });
      classConfigStatus.textContent = "บันทึกแล้ว";
      await loadDashboard();
    } catch (error) {
      if (error.message !== "authentication-required") classConfigStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  instructorManagementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageInstructors || !instructorManagementForm.reportValidity()) return;
    const email = instructorEmail.value.trim().toLowerCase();
    instructorAdd.disabled = true;
    instructorManagementStatus.textContent = "กำลังเพิ่ม…";
    try {
      await request(`${dashboardEndpoint(classroomId)}/instructors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      instructorManagementStatus.textContent = `เพิ่ม ${email} เป็น Instructor แล้ว`;
      instructorEmail.value = "";
      await loadDashboard({ silent: true });
    } catch (error) {
      if (error.message !== "authentication-required") instructorManagementStatus.textContent = error.message;
    } finally {
      instructorAdd.disabled = false;
    }
  });

  studentManagementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emails = parseBulkEmails(studentEmails.value);
    if (!canManageStudents || !emails.length) {
      studentManagementStatus.textContent = "กรอกอีเมลอย่างน้อย 1 บัญชี";
      return;
    }
    studentAdd.disabled = true;
    studentManagementStatus.textContent = "กำลังเพิ่ม…";
    try {
      const result = await request(`${dashboardEndpoint(classroomId)}/students/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      studentManagementStatus.textContent = `เพิ่ม/อนุมัติผู้เรียน ${result.active_count} บัญชีแล้ว`;
      studentEmails.value = "";
      await loadDashboard({ silent: true });
    } catch (error) {
      if (error.message !== "authentication-required") studentManagementStatus.textContent = error.message;
    } finally {
      studentAdd.disabled = false;
    }
  });

  classroomSelector.addEventListener("change", () => {
    const selected = classroomIdFromSearch(`?id=${encodeURIComponent(classroomSelector.value)}`);
    if (selected) globalObject.location.assign(`?id=${encodeURIComponent(selected)}`);
  });

  adminTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateAdminTab(button.dataset.adminTab);
      if (button.dataset.adminTab === "submissions") loadDashboard({ silent: true });
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const available = adminTabButtons.filter((item) => !item.hidden);
      const currentIndex = available.indexOf(button);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? available.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + available.length) % available.length;
      const nextButton = available[nextIndex];
      activateAdminTab(nextButton.dataset.adminTab);
      nextButton.focus();
    });
  });

  refreshSubmissions.addEventListener("click", async () => {
    refreshSubmissions.disabled = true;
    submissionsLive.lastChild.textContent = "กำลังรีเฟรช…";
    try {
      await loadDashboard({ silent: true });
    } finally {
      refreshSubmissions.disabled = false;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && activeAdminTab === "submissions") {
      loadDashboard({ silent: true });
    }
  });

  openCreateClass.addEventListener("click", () => {
    if (!canManageClassConfig) return;
    createStatus.textContent = "";
    createForm.elements.title.value = "";
    sourceClassroom.value = classroomId;
    const isTemplate = classroomType === "template";
    createDialogTitle.textContent = isTemplate ? "คัดลอกเป็นคลาสใหม่" : "สร้างคลาสใหม่";
    createForm.querySelector('button[type="submit"]').textContent = isTemplate ? "คัดลอกเป็นคลาสใหม่" : "สร้างคลาส";
    sourceClassroom.disabled = isTemplate;
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

  enrollmentSearch.addEventListener("input", () => {
    enrollmentFilter.query = enrollmentSearch.value;
    applyEnrollmentFilter();
  });

  // Logout lives in the shared site header user menu (assets/site-shell.js).

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
