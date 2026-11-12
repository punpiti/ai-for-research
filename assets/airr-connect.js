(() => {
  "use strict";

  const root = document.querySelector("[data-airr-connect]");
  if (!root) return;

  const createButton = root.querySelector("[data-airr-create-key]");
  const oneTime = root.querySelector("[data-airr-key-once]");
  const keyNode = root.querySelector("[data-airr-key]");
  const copyButton = root.querySelector("[data-airr-copy-key]");
  const listNode = root.querySelector("[data-airr-key-list]");
  const statusNode = root.querySelector("[data-airr-connect-status]");
  let classroomId = "";

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

  function renderKeys(keys) {
    listNode.replaceChildren();
    const active = keys.filter((item) => item.classroom_id === classroomId && !item.revoked_at);
    if (!active.length) {
      listNode.append(text("p", "คลาสนี้ยังไม่มี AIRR Key ที่ใช้งานอยู่"));
      return;
    }
    const heading = text("h4", "AIRR Key ที่ใช้งานอยู่");
    const list = document.createElement("ul");
    list.className = "airr-key-list";
    active.forEach((item) => {
      const entry = document.createElement("li");
      const label = text("span", `${item.label} · ${item.token_prefix}… · หมดอายุ ${new Date(item.expires_at).toLocaleDateString("th-TH")}`);
      const revoke = text("button", "เพิกถอน");
      revoke.type = "button";
      revoke.className = "button secondary";
      revoke.addEventListener("click", async () => {
        revoke.disabled = true;
        try {
          await api(`/api/ai-for-research/airr/v1/keys/${encodeURIComponent(item.key_id)}`, { method: "DELETE" });
          statusNode.textContent = "AIRR เพิกถอน key แล้ว";
          await loadKeys();
        } catch (error) {
          statusNode.textContent = `เพิกถอนไม่สำเร็จ: ${error.message}`;
          revoke.disabled = false;
        }
      });
      entry.append(label, revoke);
      list.append(entry);
    });
    listNode.append(heading, list);
  }

  async function loadKeys() {
    const payload = await api("/api/ai-for-research/airr/v1/keys");
    renderKeys(Array.isArray(payload.keys) ? payload.keys : []);
  }

  async function initialize() {
    try {
      const me = await api("/api/ai-for-research/classrooms/me");
      const requested = new URL(window.location.href).searchParams.get("classroom_id")
        || new URL(window.location.href).searchParams.get("id");
      const classrooms = Array.isArray(me.classrooms) ? me.classrooms : [];
      const selected = classrooms.find((item) => item.classroom_id === requested && item.status === "active")
        || classrooms.find((item) => item.status === "active" && item.classroom_type !== "template");
      if (!selected) throw new Error("ไม่พบบัญชีผู้เรียนที่ active สำหรับคลาสนี้");
      classroomId = selected.classroom_id;
      await loadKeys();
      statusNode.textContent = `AIRR พร้อมเชื่อมกับคลาส ${selected.title}`;
      createButton.disabled = false;
    } catch (error) {
      createButton.disabled = true;
      statusNode.textContent = `ยังเชื่อม AIRR ไม่ได้: ${error.message}`;
    }
  }

  // One copy, one paste: a ready-made login command that already carries the key.
  function showLoginCommands(apiKey) {
    let box = oneTime.querySelector("[data-airr-login-commands]");
    if (!box) {
      box = document.createElement("div");
      box.dataset.airrLoginCommands = "";
      oneTime.append(box);
    }
    box.replaceChildren(text("p", "หรือคัดลอกคำสั่งนี้ไปวางใน Terminal ของ VS Code (ที่โฟลเดอร์ ai-for-research-workspace) ได้เลย ไม่ต้องวาง key เอง:"));
    const isWindows = /Windows/i.test(navigator.userAgent);
    const commands = [
      ["Windows PowerShell", `& .\\tools\\airr.ps1 login --key ${apiKey}`],
      ["macOS / Linux", `bash tools/airr.sh login --key ${apiKey}`],
    ];
    if (!isWindows) commands.reverse();
    commands.forEach(([label, command]) => {
      box.append(text("p", label));
      const row = document.createElement("div");
      row.className = "command terminal-command";
      const button = text("button", "คัดลอกคำสั่ง login");
      button.type = "button";
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(command);
          button.textContent = "คัดลอกแล้ว";
        } catch (_error) {
          statusNode.textContent = "เบราว์เซอร์คัดลอกไม่ได้ กรุณาเลือกคำสั่งแล้วคัดลอกเอง";
        }
      });
      row.append(text("code", command), button);
      box.append(row);
    });
  }

  createButton.disabled = true;
  createButton.addEventListener("click", async () => {
    createButton.disabled = true;
    oneTime.hidden = true;
    try {
      const payload = await api("/api/ai-for-research/airr/v1/keys", {
        method: "POST",
        body: JSON.stringify({ classroom_id: classroomId, label: "VS Code" }),
      });
      keyNode.textContent = payload.api_key;
      showLoginCommands(payload.api_key);
      window.airrInstallKey = payload.api_key;
      document.dispatchEvent(new CustomEvent("airr:key-created"));
      oneTime.hidden = false;
      statusNode.textContent = "AIRR สร้าง key แล้ว คัดลอกคำสั่ง login ด้านบนไปวางใน Terminal ของ VS Code ได้ทันที";
      await loadKeys();
    } catch (error) {
      statusNode.textContent = `สร้าง AIRR Key ไม่สำเร็จ: ${error.message}`;
    } finally {
      createButton.disabled = false;
    }
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(keyNode.textContent || "");
      copyButton.textContent = "คัดลอกแล้ว";
    } catch (_error) {
      statusNode.textContent = "เบราว์เซอร์คัดลอกไม่ได้ กรุณาเลือก AIRR Key แล้วคัดลอกเอง";
    }
  });

  initialize();
})();
