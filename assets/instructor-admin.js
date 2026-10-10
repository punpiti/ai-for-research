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

  const testApi = { apiBase, classroomListEndpoint, classroomIdFromSearch, loginPath, dashboardEndpoint, moduleContentPath, formatTokens, submissionLabel, enrollmentLabel, parseBulkEmails };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.instructorAdminTestApi = testApi;

  if (typeof document === "undefined") return;
  let classroomId = classroomIdFromSearch(globalObject.location.search);
  let classroomType = "class";
  const pageStatus = document.querySelector("[data-page-status]");
  const classroomSelector = document.querySelector("[data-classroom-selector]");
  const sourceClassroom = document.querySelector("[data-source-classroom]");
  const publicClassLink = document.querySelector("[data-public-class-link]");
  const openCreateClass = document.querySelector("[data-open-create-class]");
  const createDialog = document.querySelector("[data-create-class-dialog]");
  const createDialogTitle = document.querySelector("#create-class-title");
  const createForm = document.querySelector("[data-create-class-form]");
  const createStatus = document.querySelector("[data-create-class-status]");
  const enrollmentRows = document.querySelector("[data-enrollment-rows]");
  const memberManagementForm = document.querySelector("[data-member-management-form]");
  const memberManagementTitle = document.querySelector("[data-member-management-title]");
  const memberManagementLabel = document.querySelector("[data-member-management-label]");
  const memberSingle = document.querySelector("[data-member-single]");
  const memberBulk = document.querySelector("[data-member-bulk]");
  const memberAccount = document.querySelector("[data-member-account]");
  const memberEmails = document.querySelector("[data-member-emails]");
  const memberAdd = document.querySelector("[data-member-add]");
  const memberManagementStatus = document.querySelector("[data-member-management-status]");
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
  let memberManagementMode = "";
  let currentContentRoute = "";

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
      ? ["template-details", "syllabus"]
      : ["details", "enrollment", "syllabus", "submissions", "status"];
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
    const knownTabs = ["template-details", "details", "enrollment", "syllabus", "submissions", "status"];
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
    const canonicalSearch = `?id=${encodeURIComponent(classroomId)}`;
    if (globalObject.location.search !== canonicalSearch) {
      globalObject.history.replaceState(null, "", `${canonicalSearch}${globalObject.location.hash || ""}`);
    }
  }

  function renderSummary(data) {
    const code = data.classroom.course_code ? `${data.classroom.course_code} · ` : "";
    const english = data.classroom.title_en ? ` / ${data.classroom.title_en}` : "";
    document.querySelector("[data-class-title]").textContent = `${code}${data.classroom.title}${english}`;
    document.querySelector("[data-summary-enrolled]").textContent = data.enrollments.filter((item) => item.role === "student" && item.status === "active").length;
    document.querySelector("[data-summary-pending]").textContent = data.enrollments.filter((item) => item.status === "pending").length;
    document.querySelector("[data-summary-module]").textContent = data.classroom.active_module_id?.replace("module-", "M") || "—";
    document.querySelector("[data-active-module]").textContent = data.classroom.active_module_title
      ? `${data.classroom.active_module_id.replace("module-", "M")} · ${data.classroom.active_module_title}`
      : "ยังไม่ได้เลือก";
    const isAdmin = data.member_management?.can_manage_instructors === true;
    document.querySelector("[data-admin-role-eyebrow]").textContent = isAdmin ? "Administrator · instructor access" : "Instructor classroom";
    document.querySelector("[data-admin-role-title]").innerHTML = isAdmin ? "หน้าของ<br><span>ผู้ดูแลระบบ</span>" : "หน้าของ<br><span>อาจารย์</span>";
  }

  function renderClassDetails(data) {
    if (data.classroom.classroom_type === "template") return;
    const details = data.classroom.public_details || {};
    classDetailsForm.elements.enrollment_status.value = data.classroom.enrollment_status || "draft";
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
    return { enrollment_status: classDetailsForm.elements.enrollment_status.value, details };
  }

  function renderEnrollments(data) {
    enrollmentRows.replaceChildren();
    if (data.classroom.classroom_type === "template") return;
    const management = data.member_management || {};
    memberManagementMode = management.mode || "";
    const managesInstructors = management.can_manage_instructors === true;
    const managesStudents = management.can_manage_students === true;
    const managedRole = managesInstructors ? "teacher" : managesStudents ? "student" : "";
    memberManagementForm.hidden = !managedRole;
    if (managedRole) {
      memberManagementTitle.textContent = managesInstructors ? "ผู้สอนของคลาส" : "ผู้เรียนของคลาส";
      memberManagementLabel.textContent = managesInstructors ? "เพิ่มผู้สอน" : "เพิ่มผู้เรียน";
      memberAdd.textContent = managesInstructors ? "เพิ่ม Instructor" : "เพิ่มผู้เรียนเป็นชุด";
      memberSingle.hidden = !managesInstructors;
      memberBulk.hidden = !managesStudents;
      const accounts = Array.isArray(management.available_accounts) ? management.available_accounts : [];
      memberAccount.replaceChildren(...accounts.map((account) => {
        const option = node("option", "", `${account.display_name || account.email} · ${account.email}`);
        option.value = account.email;
        return option;
      }));
      memberAccount.disabled = !managesInstructors || accounts.length === 0;
      memberAdd.disabled = managesInstructors && accounts.length === 0;
      if (managesInstructors && !accounts.length) memberManagementStatus.textContent = "ไม่มีบัญชีที่เพิ่มได้ในขณะนี้";
    }
    data.enrollments.filter((item) => !managedRole || item.role === managedRole).forEach((item) => {
      const row = node("tr");
      const displayParts = (item.display_name || "").trim().split(/\s+/).filter(Boolean);
      const givenName = item.given_name || displayParts[0] || "—";
      const familyName = item.family_name || displayParts.slice(1).join(" ") || "—";
      const accountCell = node("td");
      accountCell.append(node("strong", "", item.email));
      if (item.owner) accountCell.append(node("small", "", "เจ้าของวิชา"));
      row.append(
        accountCell,
        node("td", "", givenName),
        node("td", "", familyName),
        node("td", "", item.role === "teacher" ? "ผู้สอน" : "ผู้เรียน"),
      );

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
      if (managesInstructors) quotaInput.disabled = true;
      quotaCell.append(quotaInput);

      const usageCell = node("td", "", formatTokens(item.token_usage));
      usageCell.append(node("small", "", item.token_records ? `${item.token_records} records` : "ยังไม่มีข้อมูล"));

      const actionCell = node("td");
      if (!managesInstructors) {
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
            await loadDashboard({ silent: true });
          } catch (error) {
            saveButton.textContent = error.message === "authentication-required" ? "เข้าสู่ระบบใหม่" : "ลองอีกครั้ง";
          } finally {
            saveButton.disabled = false;
          }
        });
        actionCell.append(saveButton);
      }
      if (managedRole) {
        const removeButton = node("button", "button secondary instructor-row-save", item.owner ? "Owner" : "นำออก");
        removeButton.type = "button";
        removeButton.disabled = item.owner === true;
        removeButton.addEventListener("click", async () => {
          removeButton.disabled = true;
          removeButton.textContent = "กำลังนำออก…";
          try {
            const collection = managesInstructors ? "instructors" : "students";
            await request(`${dashboardEndpoint(classroomId)}/${collection}/${encodeURIComponent(item.email)}`, { method: "DELETE" });
            memberManagementStatus.textContent = `นำ ${item.email} ออกจากคลาสแล้ว`;
            await loadDashboard({ silent: true });
          } catch (error) {
            memberManagementStatus.textContent = error.message;
            removeButton.disabled = false;
            removeButton.textContent = "ลองอีกครั้ง";
          }
        });
        actionCell.append(removeButton);
      }
      row.append(statusCell, quotaCell, usageCell, actionCell);
      enrollmentRows.append(row);
    });
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
        card.append(content);
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

      card.append(includeLabel, activeLabel);
      syncCard();
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

  memberManagementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!memberManagementMode) return;
    const bulkEmails = parseBulkEmails(memberEmails.value);
    const managesStudents = memberManagementMode === "students";
    if ((!managesStudents && !memberAccount.value) || (managesStudents && !bulkEmails.length)) {
      memberManagementStatus.textContent = managesStudents ? "กรอกอีเมลอย่างน้อย 1 บัญชี" : "เลือกบัญชีที่ต้องการเพิ่ม";
      return;
    }
    memberAdd.disabled = true;
    memberManagementStatus.textContent = "กำลังเพิ่ม…";
    try {
      const endpoint = managesStudents ? `${memberManagementMode}/bulk` : memberManagementMode;
      const result = await request(`${dashboardEndpoint(classroomId)}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(managesStudents ? { emails: bulkEmails } : { email: memberAccount.value }),
      });
      memberManagementStatus.textContent = managesStudents
        ? `เพิ่ม/อนุมัติผู้เรียน ${result.active_count} บัญชีแล้ว`
        : `เพิ่ม ${memberAccount.value} แล้ว`;
      if (managesStudents) memberEmails.value = "";
      await loadDashboard({ silent: true });
    } catch (error) {
      if (error.message !== "authentication-required") memberManagementStatus.textContent = error.message;
    } finally {
      memberAdd.disabled = managesStudents ? false : memberAccount.options.length === 0;
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

  document.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await request(`${apiBase}/auth/logout`, { method: "POST" });
    } finally {
      globalObject.aiResearchDevAuth?.clear();
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
