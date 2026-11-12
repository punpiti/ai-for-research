(() => {
  "use strict";
  const root = document.querySelector("[data-airr-instructor]");
  if (!root) return;
  const classroomId = new URL(window.location.href).searchParams.get("id") || "";
  const titleNode = root.querySelector("[data-airr-class-title]");
  const statusNode = root.querySelector("[data-airr-page-status]");
  const listNode = root.querySelector("[data-airr-submissions]");
  const refresh = root.querySelector("[data-airr-refresh]");
  const back = document.querySelector("[data-back-link]");
  if (back && classroomId) back.href = `index.html?id=${encodeURIComponent(classroomId)}`;

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.assign(`../login.html?next=${encodeURIComponent(`admin/airr.html?id=${classroomId}`)}`);
      throw new Error("กำลังไปหน้าเข้าสู่ระบบ");
    }
    if (!response.ok) throw new Error(payload.detail || `AIRR ตอบ HTTP ${response.status}`);
    return payload;
  }

  function node(tag, className, value) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined) item.textContent = value;
    return item;
  }

  async function openSubmission(card, item) {
    let detail = card.querySelector("[data-airr-detail]");
    if (detail) {
      detail.hidden = !detail.hidden;
      return;
    }
    detail = node("div", "airr-review-detail");
    detail.dataset.airrDetail = "";
    detail.textContent = "กำลังโหลด highlights…";
    card.append(detail);
    try {
      const payload = await api(item.detail_url);
      const submission = payload.submission || {};
      detail.replaceChildren();
      const markdown = node("pre", "airr-markdown", submission.markdown || "");
      const gallery = node("div", "airr-graph-gallery");
      item.graphs.forEach((graph) => {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = graph.view_url;
        image.alt = graph.filename;
        image.loading = "lazy";
        const caption = node("figcaption", "", `${graph.filename} · ${Math.round(graph.byte_size / 1024)} KB`);
        figure.append(image, caption);
        gallery.append(figure);
      });
      const review = document.createElement("form");
      review.className = "airr-review-form";
      review.innerHTML = '<label>ผลตรวจ<select name="decision" required><option value="approved">approved</option><option value="revision_requested">revision_requested</option><option value="rejected">rejected</option></select></label><label>Feedback<textarea name="comment" rows="4" maxlength="4000"></textarea></label><button class="button primary" type="submit">บันทึกผลตรวจ</button><p role="status" aria-live="polite"></p>';
      review.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = review.querySelector("button");
        const message = review.querySelector("p");
        button.disabled = true;
        try {
          await api(`/api/ai-for-research/airr/v1/instructor/classes/${encodeURIComponent(classroomId)}/module-7/submissions/${encodeURIComponent(item.submission_id)}/review`, {
            method: "PUT",
            body: JSON.stringify({ decision: review.elements.decision.value, comment: review.elements.comment.value.trim() }),
          });
          message.textContent = "AIRR บันทึกผลตรวจแล้ว";
          await load();
        } catch (error) {
          message.textContent = error.message;
          button.disabled = false;
        }
      });
      detail.append(markdown, gallery, review);
    } catch (error) {
      detail.textContent = `เปิดงานไม่ได้: ${error.message}`;
    }
  }

  function render(data) {
    titleNode.textContent = data.class.class_code;
    listNode.replaceChildren();
    if (!data.submissions.length) {
      listNode.append(node("p", "", "ยังไม่มีงาน Module 7 ที่ส่งผ่าน AIRR"));
      return;
    }
    data.submissions.forEach((item) => {
      const card = node("article", "airr-submission-card");
      const heading = node("div", "airr-submission-heading");
      const who = node("div", "");
      who.append(node("h3", "", item.learner.display_name || item.learner.email || "AIRR learner"), node("p", "", `${item.learner.email || ""} · ${new Date(item.received_at).toLocaleString("th-TH")}`));
      const badge = node("span", `airr-review-status ${item.review_status}`, item.review_status);
      heading.append(who, badge);
      const summary = node("p", "", `${item.highlight_count} highlights · ${item.chart_count} graphs`);
      const open = node("button", "button secondary", "เปิด highlights และกราฟ");
      open.type = "button";
      open.addEventListener("click", () => openSubmission(card, item));
      card.append(heading, summary, open);
      listNode.append(card);
    });
  }

  const doneLabels = {
    meal_card: "meal-card", learner_additions: "learner-additions", author_prior: "author-prior",
    diagnosis: "diagnosis", revision_table: "revision-table", citation_for_m4: "citation-for-m4",
  };

  function doneSummary(item) {
    if (item.counts) {
      const c = item.counts;
      const s = item.status_counts;
      return [`${c.references} รายการอ้างอิง · ทะเบียน ${c.register_rows} แถว · ตรวจฉบับเต็ม ${c.checked_full_text} · รอดาวน์โหลดเอง ${c.manual_download_pending}`,
        `verified ${s["verified"]} · partial ${s["partially supported"]} · not supported ${s["not supported"]} · not found ${s["not found"]} · outdated ${s["outdated or superseded"]} · phantom ${s["fabricated / phantom"]}`];
    }
    const lines = Object.entries(item.line_counts || {}).map(([key, value]) => `${doneLabels[key] || key} ${value} บรรทัด`).join(" · ");
    return [lines, item.completion_status ? `สถานะที่ผู้เรียนรายงาน: ${item.completion_status}` : ""].filter(Boolean);
  }

  function renderDone(target, module, data) {
    target.replaceChildren();
    const latest = new Map();
    data.submissions.forEach((item) => {
      const who = item.learner.email || item.learner.display_name;
      if (!latest.has(who)) latest.set(who, item);
    });
    if (!latest.size) {
      target.append(node("p", "", `ยังไม่มีผู้เรียนแจ้งว่า ${module} เสร็จ`));
      return;
    }
    latest.forEach((item) => {
      const card = node("article", "airr-submission-card");
      const heading = node("div", "airr-submission-heading");
      const who = node("div", "");
      who.append(node("h3", "", item.learner.display_name || item.learner.email || "AIRR learner"), node("p", "", `${item.learner.email || ""} · ${new Date(item.received_at).toLocaleString("th-TH")}`));
      const label = item.practice === "short" ? "ทางสั้น" : item.practice === "mock" ? "บทความจำลอง" : "งานจริง";
      heading.append(who, node("span", "airr-review-status approved", label));
      card.append(heading, ...doneSummary(item).map((line) => node("p", "", line)));
      target.append(card);
    });
  }

  async function loadDone() {
    const targets = root.querySelectorAll("[data-airr-done]");
    for (const target of targets) {
      const module = target.dataset.airrDone;
      try {
        renderDone(target, module, await api(`/api/ai-for-research/airr/v1/instructor/classes/${encodeURIComponent(classroomId)}/done/${module}`));
      } catch (error) {
        target.replaceChildren(node("p", "", `โหลด ${module} ไม่สำเร็จ: ${error.message}`));
      }
    }
  }

  async function load() {
    if (!classroomId) {
      statusNode.textContent = "URL นี้ไม่มี classroom id";
      return;
    }
    refresh.disabled = true;
    try {
      const data = await api(`/api/ai-for-research/airr/v1/instructor/classes/${encodeURIComponent(classroomId)}/module-7`);
      render(data);
      statusNode.textContent = `AIRR โหลด ${data.submissions.length} รายการแล้ว`;
      await loadDone();
    } catch (error) {
      statusNode.textContent = `โหลด AIRR ไม่สำเร็จ: ${error.message}`;
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", load);
  load();
})();
