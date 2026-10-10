(function devAuthentication(globalObject) {
  "use strict";

  const storageKey = "ai-research-dev-session";
  const apiPrefix = "/api/ai-for-research/";
  const hostname = String(globalObject.location?.hostname || "").toLowerCase();
  const enabled = ["127.0.0.1", "localhost", "::1"].includes(hostname);

  function read() {
    if (!enabled) return "";
    try { return globalObject.sessionStorage?.getItem(storageKey) || ""; } catch (_error) { return ""; }
  }

  function store(token) {
    if (!enabled || !token) return;
    try { globalObject.sessionStorage?.setItem(storageKey, String(token)); } catch (_error) { /* Cookie may still work. */ }
  }

  function clear() {
    if (!enabled) return;
    try { globalObject.sessionStorage?.removeItem(storageKey); } catch (_error) { /* No-op. */ }
  }

  const nativeFetch = typeof globalObject.fetch === "function" ? globalObject.fetch.bind(globalObject) : null;
  if (enabled && nativeFetch) {
    globalObject.fetch = function developmentAuthenticatedFetch(input, init = {}) {
      const url = new URL(typeof input === "string" ? input : input.url, globalObject.location.href);
      const token = read();
      if (token && url.origin === globalObject.location.origin && url.pathname.startsWith(apiPrefix)) {
        const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
        headers.set("X-AI-Research-Dev-Session", token);
        return nativeFetch(input, { ...init, headers });
      }
      return nativeFetch(input, init);
    };
  }

  globalObject.aiResearchDevAuth = { enabled, read, store, clear };
})(typeof window !== "undefined" ? window : globalThis);
