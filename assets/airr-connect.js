(() => {
  "use strict";

  // AIRR Key without a separate step: copying the install command creates a key
  // (once per page load) and puts it into the command. Learners never handle the
  // key; the collapsed "จัดการ AIRR Key" list only lets them revoke old ones.
  const root = document.querySelector("[data-airr-connect]");
  const listNode = document.querySelector("[data-airr-key-list]");
  const statusNode = document.querySelector("[data-airr-connect-status]");
  let classroomId = "";
  let pending = null;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `AIRR ตอบ HTTP ${response.status}`);
    return payload;
  }

  function text(tag, value) {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  }

  function setStatus(message) {
    if (statusNode) statusNode.textContent = message;
  }

  function renderKeys(keys) {
    if (!listNode) return;
    listNode.replaceChildren();
    const active = keys.filter((item) => item.classroom_id === classroomId && !item.revoked_at);
    if (!active.length) {
      listNode.append(text("p", "ยังไม่มี AIRR Key ที่ใช้งานอยู่"));
      return;
    }
    const list = document.createElement("ul");
    list.className = "airr-key-list";
    active.forEach((item) => {
      const entry = document.createElement("li");
      const created = item.created_at ? `สร้าง ${new Date(item.created_at).toLocaleDateString("th-TH")} · ` : "";
      const label = text("span", `${item.label} · ${item.token_prefix}… · ${created}หมดอายุ ${new Date(item.expires_at).toLocaleDateString("th-TH")}`);
      const revoke = text("button", "เพิกถอน");
      revoke.type = "button";
      revoke.className = "button secondary";
      revoke.addEventListener("click", async () => {
        revoke.disabled = true;
        try {
          await api(`/api/ai-for-research/airr/v1/keys/${encodeURIComponent(item.key_id)}`, { method: "DELETE" });
          await loadKeys();
        } catch (error) {
          revoke.disabled = false;
          entry.append(text("small", ` เพิกถอนไม่สำเร็จ: ${error.message}`));
        }
      });
      entry.append(label, revoke);
      list.append(entry);
    });
    listNode.append(list);
  }

  async function loadKeys() {
    const payload = await api("/api/ai-for-research/airr/v1/keys");
    renderKeys(Array.isArray(payload.keys) ? payload.keys : []);
  }

  async function findClassroom() {
    const me = await api("/api/ai-for-research/classrooms/me");
    const params = new URL(window.location.href).searchParams;
    const requested = params.get("classroom_id") || params.get("id");
    const classrooms = Array.isArray(me.classrooms) ? me.classrooms : [];
    const selected = classrooms.find((item) => item.classroom_id === requested && item.status === "active")
      || classrooms.find((item) => item.status === "active" && item.classroom_type !== "template");
    if (!selected) throw new Error("เข้าสู่ระบบเว็บคลาสด้วยบัญชีที่ลงทะเบียนก่อน แล้วกดคัดลอกใหม่");
    classroomId = selected.classroom_id;
    return selected;
  }

  const ready = findClassroom().then(() => (root ? loadKeys() : null)).catch((error) => {
    classroomId = "";
    return error;
  });

  // Called by the install-command copy button. Resolves to the key, or throws.
  window.airrEnsureInstallKey = async () => {
    if (window.airrInstallKey) return window.airrInstallKey;
    if (!pending) {
      pending = (async () => {
        await ready;
        if (!classroomId) await findClassroom();
        const payload = await api("/api/ai-for-research/airr/v1/keys", {
          method: "POST",
          body: JSON.stringify({ classroom_id: classroomId, label: "VS Code" }),
        });
        window.airrInstallKey = payload.api_key;
        document.dispatchEvent(new CustomEvent("airr:key-created"));
        setStatus("ใส่รหัสเชื่อมคลาส (AIRR Key) ในคำสั่งติดตั้งแล้ว");
        if (root) loadKeys().catch(() => {});
        return payload.api_key;
      })().catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
})();
