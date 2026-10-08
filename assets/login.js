(function loginModule(globalObject) {
  "use strict";

  const googleEndpoint = "/api/ai-for-research/classrooms/auth/google";
  const previewEndpoint = "/api/ai-for-research/classrooms/auth/preview";
  const defaultNext = "classroom.html?id=faculty-pilot-2569";

  class LoginRequestError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "LoginRequestError";
      this.code = code;
    }
  }

  function safeNextPath(value) {
    const candidate = String(value || "");
    return /^(?:classroom\.html\?id=[a-z0-9][a-z0-9-]{2,63}(?:&action=enroll)?|admin\/)$/.test(candidate)
      ? candidate
      : "";
  }

  function isLocalPreview(hostname) {
    return ["127.0.0.1", "localhost", "::1"].includes(String(hostname || "").toLowerCase());
  }

  async function postAuthentication(endpoint, body, fetchImpl = globalObject.fetch) {
    if (typeof fetchImpl !== "function") {
      throw new LoginRequestError("unavailable", "ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง");
    }
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (_error) {
      throw new LoginRequestError("network", "เชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    }

    if (response.ok) {
      let payload = {};
      try { payload = typeof response.json === "function" ? await response.json() : {}; } catch (_error) { payload = {}; }
      return {
        authenticated: true,
        preview: payload.preview === true,
        next: safeNextPath(payload.next) || safeNextPath(body.next) || defaultNext,
      };
    }
    if (response.status === 401 || response.status === 403) {
      throw new LoginRequestError("not-eligible", "กรุณาใช้บัญชี Google ของมหาวิทยาลัยเกษตรศาสตร์ (@ku.th)");
    }
    if (response.status === 429) {
      throw new LoginRequestError("rate-limit", "เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
    }
    throw new LoginRequestError("server", "ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง");
  }

  async function authenticateWithGoogle(credential, fetchImpl = globalObject.fetch, requestedNext = "") {
    const token = String(credential || "").trim();
    if (!token) throw new LoginRequestError("missing-credential", "Google ไม่ได้ส่งข้อมูลยืนยันตัวตน กรุณาลองใหม่");
    const next = safeNextPath(requestedNext);
    return postAuthentication(googleEndpoint, next ? { credential: token, next } : { credential: token }, fetchImpl);
  }

  async function authenticatePreview(fetchImpl = globalObject.fetch, requestedNext = "") {
    const next = safeNextPath(requestedNext);
    return postAuthentication(previewEndpoint, next ? { next } : {}, fetchImpl);
  }

  const testApi = {
    googleEndpoint,
    previewEndpoint,
    defaultNext,
    safeNextPath,
    isLocalPreview,
    authenticateWithGoogle,
    authenticatePreview,
    LoginRequestError,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = testApi;
  globalObject.loginTestApi = testApi;

  if (typeof document === "undefined") return;
  const googleContainer = document.querySelector("[data-google-login]");
  const googleButton = document.getElementById("google-signin-button");
  const previewButton = document.querySelector("[data-preview-login]");
  const status = document.querySelector("[data-login-status]");
  const clientId = document.querySelector('meta[name="google-signin-client-id"]')?.content || "";
  const next = safeNextPath(new URLSearchParams(globalObject.location.search).get("next"));
  if (!googleContainer || !googleButton || !previewButton || !status) return;

  function setStatus(message, state = "") {
    status.className = "login-status";
    if (state) status.classList.add(`is-${state}`);
    status.textContent = message;
  }

  async function finishAuthentication(request) {
    setStatus("กำลังตรวจบัญชี…");
    try {
      const result = await request;
      setStatus(result.preview ? "เข้าสู่ระบบ Preview แล้ว กำลังกลับไปยังหน้าคลาส…" : "เข้าสู่ระบบแล้ว กำลังกลับไปยังหน้าคลาส…", "success");
      globalObject.location.assign(result.next);
    } catch (error) {
      setStatus(error instanceof LoginRequestError ? error.message : "ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง", "error");
    }
  }

  if (isLocalPreview(globalObject.location.hostname)) {
    previewButton.hidden = false;
    previewButton.addEventListener("click", () => finishAuthentication(authenticatePreview(globalObject.fetch, next)));
  }

  if (!clientId) {
    googleContainer.hidden = true;
    setStatus("ยังไม่ได้กำหนด Google Client ID", "error");
    return;
  }

  let attempts = 0;
  const waitForGoogle = globalObject.setInterval(() => {
    attempts += 1;
    if (globalObject.google?.accounts?.id) {
      globalObject.clearInterval(waitForGoogle);
      globalObject.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => finishAuthentication(authenticateWithGoogle(response?.credential, globalObject.fetch, next)),
      });
      globalObject.google.accounts.id.renderButton(googleButton, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280,
      });
      setStatus("เลือกบัญชี Google เพื่อเข้าสู่ระบบ");
      return;
    }
    if (attempts >= 100) {
      globalObject.clearInterval(waitForGoogle);
      googleContainer.hidden = true;
      setStatus("โหลด Google Sign-In ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่", "error");
    }
  }, 100);
})(typeof window !== "undefined" ? window : globalThis);
