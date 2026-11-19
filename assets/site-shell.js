const MODULE_LINKS = [
  [1, "prepare.html", "Prepare Your AI Research Workspace"],
  [2, "module-2.html", "Your First AI Research Task"],
  [3, "module-3.html", "Problem Statement → Research Gap"],
  [4, "module-4.html", "Literature Evidence"],
  [5, "module-5.html", "Research Logic"],
  [6, "module-6.html", "Experiment Design Stress Test"],
  [7, "module-7.html", "Analysis & Visualization"],
  [8, "module-8.html", "Document Production"],
  [9, "module-9.html", "Personal AI Research Practice"],
];

function moduleContentHref(moduleId, classroomId = "") {
  const match = /^module-([1-9])$/.exec(String(moduleId || ""));
  if (!match) return "prepare.html";
  const path = match[1] === "1" ? "prepare.html" : `module-${match[1]}.html`;
  return classroomId
    ? `/api/ai-for-research/classrooms/${encodeURIComponent(classroomId)}/content/${path}?classroom_id=${encodeURIComponent(classroomId)}`
    : path;
}

const PRODUCTION_BASE = "https://urban.cpe.ku.ac.th/ai-for-research/";
const GOOGLE_ANALYTICS_ID = "G-BWX7PFH4XM";
const CLASSROOM_API_BASE = "/api/ai-for-research/classrooms";
const FEATURED_CLASSROOM_ID = "faculty-pilot-2569";
// Path of this page below the site root (the folder above assets/), so pages in
// sub-folders such as admin/ keep their own canonical URL and analytics path.
const siteRootPath = document.currentScript?.src ? new URL("../", document.currentScript.src).pathname : "";
const productionFile = siteRootPath && location.pathname.startsWith(siteRootPath)
  ? location.pathname.slice(siteRootPath.length)
  : (location.pathname.endsWith("/") ? "" : location.pathname.split("/").pop());
const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
canonical.rel = "canonical";
canonical.href = PRODUCTION_BASE + productionFile;
if (!canonical.isConnected) document.head.append(canonical);

// Use the same GA4 property as urban.cpe.ku.ac.th so visits remain in one
// measurement stream. The script is shared by every course page.
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag("js", new Date());
gtag("config", GOOGLE_ANALYTICS_ID, {
  anonymize_ip: true,
  page_location: canonical.href,
  page_title: document.title,
});

const analyticsScript = document.createElement("script");
analyticsScript.async = true;
analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
document.head.append(analyticsScript);

const LOCAL_LINKS = {
  home: [],
  classroom: [["outcomes", "Learning outcomes"], ["syllabus", "Syllabus"], ["requirements", "Requirements"]],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
  9: [],
  example: [["definition", "โจทย์วิจัย"], ["method", "วิธีวิจัย"], ["review", "ทบทวน"]],
  register: [["form", "เตรียมข้อมูลสมัคร"]],
  checkout: [],
};

// Display theme: "system" (default, follows the OS), "light" or "dark".
// Runs while <head> is parsed so the page never flashes the wrong theme.
const SHELL_SCRIPT_URL = document.currentScript?.src || location.href;
const THEME_KEY = "airr.theme";
const systemDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function themePreference() {
  try { const value = localStorage.getItem(THEME_KEY); return ["light", "dark"].includes(value) ? value : "system"; } catch (_error) { return "system"; }
}
function applyTheme(preference = themePreference()) {
  const effective = preference === "system" ? (systemDark && !systemDark.matches ? "light" : "dark") : preference;
  document.documentElement.dataset.theme = effective;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", effective === "light" ? "#f7f5ef" : "#101817");
  document.querySelectorAll(".theme-choice button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.themeValue === preference)));
}
function setTheme(preference) {
  try { if (preference === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, preference); } catch (_error) { /* applies to this page only */ }
  applyTheme(preference);
}
applyTheme();
systemDark?.addEventListener?.("change", () => { if (themePreference() === "system") applyTheme("system"); });
if (!document.querySelector('link[data-airr-theme]')) {
  const themeLink = document.createElement("link");
  themeLink.rel = "stylesheet";
  themeLink.href = new URL("theme.css?v=20261119-3", SHELL_SCRIPT_URL).href;
  themeLink.dataset.airrTheme = "";
  document.head.append(themeLink);
}

// One shared session lookup for the header (user menu + classroom CTA).
let sessionPromise = null;
function currentSession() {
  if (!sessionPromise) {
    sessionPromise = typeof fetch === "function"
      ? fetch(`${CLASSROOM_API_BASE}/me`, { credentials: "same-origin", headers: { "Accept": "application/json" } })
        .then((response) => (response.ok ? response.json() : null)).catch(() => null)
      : Promise.resolve(null);
    // Local preview only (no API on localhost): show a dummy learner so the header can be judged.
    // Add ?guest to the URL to preview the signed-out header instead.
    if (["localhost", "127.0.0.1", "::1"].includes(location.hostname) && !new URLSearchParams(location.search).has("guest")) {
      sessionPromise = sessionPromise.then((session) => session || DEV_DUMMY_SESSION);
    }
  }
  return sessionPromise;
}

const DEV_DUMMY_AVATAR = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#4a7fd0"/><circle cx="32" cy="25" r="12" fill="#f3d2b5"/><path d="M10 64c2-15 11-22 22-22s20 7 22 22z" fill="#2b4f86"/><path d="M20 23c0-9 6-14 12-14s13 4 12 15c-3-6-9-7-12-7s-9 1-12 6z" fill="#3a2a20"/></svg>');
const DEV_DUMMY_SESSION = {
  authenticated: true,
  user: { display_name: "ทดลอง ผู้เรียน (dev)", given_name: "ทดลอง", family_name: "ผู้เรียน", email: "learner@example.com", picture: DEV_DUMMY_AVATAR, system_role: "user" },
  classrooms: [],
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const THEME_CHOICES = [["system", "ตามระบบ"], ["light", "สว่าง"], ["dark", "มืด"]];
function userMenuHtml() {
  const preference = themePreference();
  const buttons = THEME_CHOICES.map(([value, label]) => `<button type="button" data-theme-value="${value}" aria-pressed="${value === preference}">${label}</button>`).join("");
  return `<details class="user-menu">
      <summary aria-label="บัญชีและการแสดงผล"><span class="user-avatar is-guest" aria-hidden="true">◐</span><span class="user-name" hidden></span></summary>
      <div>
        <p class="user-id" hidden></p>
        <fieldset class="theme-choice"><legend>ธีมหน้าจอ</legend><div>${buttons}</div></fieldset>
        <a class="user-login" href="${new URL("../login.html", SHELL_SCRIPT_URL).href}">เข้าสู่ระบบ</a>
        <button type="button" class="user-logout" hidden>ออกจากระบบ</button>
      </div>
    </details>`;
}

// Console pages (body.console, e.g. admin/): brand + page links + user menu only.
// <site-header current="console" root="../" links='[["href", "label", "data-attr-name"]]'>
// root: prefix from the page to the site root; links: page-relative, optional data-* hook for page scripts.
function consoleHeaderHtml(element) {
  const root = element.getAttribute("root") || "";
  let links = "";
  try {
    const items = JSON.parse(element.getAttribute("links") || "[]");
    links = (Array.isArray(items) ? items : []).map(([href, label, hook]) => {
      const data = /^[a-z][a-z0-9-]*$/.test(hook || "") ? ` data-${hook}` : "";
      return `<a href="${escapeHtml(href)}"${data}>${escapeHtml(label)}</a>`;
    }).join("");
  } catch (_error) { links = ""; }
  return `<header class="site-header">
      <a class="brand" href="${escapeHtml(root)}index.html" aria-label="AIRR หน้าแรก"><span class="brand-mark brand-logo"><img class="logo-on-dark" src="${new URL("images/airr-mark-dark.svg", SHELL_SCRIPT_URL).href}" alt="" width="36" height="36"><img class="logo-on-light" src="${new URL("images/airr-mark-light.svg", SHELL_SCRIPT_URL).href}" alt="" width="36" height="36"></span><span class="brand-full">AI for Research and Review</span><span class="brand-short" aria-hidden="true">AIRR</span></a>
      <nav aria-label="เมนูหลัก">
        ${links}
        ${userMenuHtml()}
      </nav>
    </header>`;
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute("current") || "";
    if (current === "console") {
      this.innerHTML = consoleHeaderHtml(this);
      this.setupUserMenu(current);
      return;
    }
    const isHome = current === "home";
    const isClassroomEntry = ["home", "classroom", "login"].includes(current);
    const classroomDirectoryHref = isHome ? "#course" : "index.html#course";
    const ctaHref = current === "login" ? "classroom.html?id=faculty-pilot-2569" : (isClassroomEntry ? "login.html" : (current === "register" ? "index.html#course" : "register.html"));
    const ctaLabel = current === "login" ? "ดูรายละเอียดคลาส" : (isClassroomEntry ? "เข้าสู่ระบบ" : (current === "register" ? "ดูคลาสที่เปิดรับ" : "สมัครเป็นกลุ่ม"));
    const queryClassroomId = new URLSearchParams(location.search).get("classroom_id") || "";
    const contentClassroomId = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(queryClassroomId) ? queryClassroomId : "";
    const moduleLinks = MODULE_LINKS.map(([number, href, label]) => {
      const active = String(number) === current ? ' aria-current="page"' : "";
      const classroomHref = contentClassroomId ? `${href}?classroom_id=${encodeURIComponent(contentClassroomId)}` : href;
      return `<a class="available" href="${classroomHref}"${active}>${number} · ${label}</a>`;
    }).join("");
    const currentModule = MODULE_LINKS.find(([number]) => String(number) === current);
    const menuLabel = currentModule
      ? `<span class="module-menu-number">โมดูล ${currentModule[0]}</span><span class="module-menu-title">${currentModule[2]}</span>`
      : current === "file-basics"
        ? '<span class="module-menu-number">โมดูลเสริม</span><span class="module-menu-title">File Basics</span>'
        : "โมดูล 1–9";
    // Lesson pages: "แผนการเรียน" (class syllabus) replaces "หน้าหลัก"; topic pages list sibling topics.
    let planHref = this.getAttribute("plan") || "";
    try {
      if (planHref && current === "class") localStorage.setItem("airr.planHref", planHref);
      if (!planHref && document.body.classList.contains("learn")) planHref = localStorage.getItem("airr.planHref") || "";
    } catch (error) { /* storage unavailable: fall back to หน้าหลัก */ }
    const planLink = planHref
      ? `<a href="${planHref}"${current === "class" ? ' aria-current="page"' : ""}>แผนการเรียน</a>`
      : '<a href="index.html">หน้าหลัก</a>';
    let topicMenu = "";
    try {
      const menu = JSON.parse(this.getAttribute("menu") || "null");
      if (menu && Array.isArray(menu.items)) {
        const links = menu.items.map((item) => `<a class="available" href="${item.href}"${item.current ? ' aria-current="page"' : ""}>${item.label}</a>`).join("");
        topicMenu = `<details class="module-menu"><summary aria-label="หัวข้ออื่นในโมดูลนี้"><span class="module-menu-number">${menu.module}</span><span class="module-menu-title">${menu.title}</span></summary><div>${links}</div></details>`;
      }
    } catch (error) { topicMenu = ""; }
    const localLinks = (LOCAL_LINKS[current] || [])
      .map(([id, label]) => `<a href="#${id}">${label}</a>`)
      .join("");
    // Classroom detail page: the enrolment box is the only action, so the header keeps
    // just the brand (back to home) and the user menu. The 404 page (current="error") uses the same.
    if (current === "classroom" || current === "error") {
      this.innerHTML = `<header class="site-header">
      <a class="brand" href="index.html" aria-label="AIRR หน้าแรก"><span class="brand-mark brand-logo"><img class="logo-on-dark" src="${new URL("images/airr-mark-dark.svg", SHELL_SCRIPT_URL).href}" alt="" width="36" height="36"><img class="logo-on-light" src="${new URL("images/airr-mark-light.svg", SHELL_SCRIPT_URL).href}" alt="" width="36" height="36"></span><span class="brand-full">AI for Research and Review</span><span class="brand-short" aria-hidden="true">AIRR</span></a>
      <nav aria-label="เมนูหลัก">${userMenuHtml()}</nav>
    </header>`;
      this.setupUserMenu(current);
      return;
    }
    this.innerHTML = `<header class="site-header">
      <a class="brand" href="${isHome ? "#top" : "index.html"}" aria-label="AIRR หน้าแรก"><span class="brand-mark brand-logo"><img class="logo-on-dark" src="${new URL("images/airr-mark-dark.svg", SHELL_SCRIPT_URL).href}" alt="" width="36" height="36"><img class="logo-on-light" src="${new URL("images/airr-mark-light.svg", SHELL_SCRIPT_URL).href}" alt="" width="36" height="36"></span><span class="brand-full">AI for Research and Review</span><span class="brand-short" aria-hidden="true">AIRR</span></a>
      <nav aria-label="เมนูหลัก">
        ${isHome ? "" : planLink}
        ${isClassroomEntry ? `<a class="nav-directory" href="${classroomDirectoryHref}">คลาสที่เปิดรับ</a>` : current === "class" ? "" : topicMenu || `<details class="module-menu"><summary aria-label="เลือกโมดูล (ตอนนี้: ${currentModule ? `โมดูล ${currentModule[0]}` : current === "file-basics" ? "โมดูลเสริม" : "ยังไม่ได้เลือก"})">${menuLabel}</summary><div>${moduleLinks}</div></details>`}
        ${localLinks}
        <a class="nav-cta" href="${ctaHref}">${ctaLabel}</a>
        ${userMenuHtml()}
      </nav>
    </header>`;

    this.setupUserMenu(current);

    if (isClassroomEntry && current !== "login") this.updateClassroomCta(current);
  }

  setupUserMenu(current) {
    const menu = this.querySelector(".user-menu");
    if (!menu) return;
    menu.querySelectorAll(".theme-choice button").forEach((button) => button.addEventListener("click", () => setTheme(button.dataset.themeValue)));
    document.addEventListener("click", (event) => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
    const login = menu.querySelector(".user-login");
    if (current === "login") login.hidden = true;
    menu.querySelector(".user-logout").addEventListener("click", async () => {
      try {
        await fetch(`${CLASSROOM_API_BASE}/auth/logout`, { method: "POST", credentials: "same-origin" });
      } catch (_error) { /* the session cookie is cleared server-side when reachable */ }
      window.aiResearchDevAuth?.clear?.();
      location.assign(new URL("../index.html", SHELL_SCRIPT_URL).href);
    });
    currentSession().then((session) => {
      const user = session?.authenticated ? session.user : null;
      if (!user) return;
      const name = user.display_name || [user.given_name, user.family_name].filter(Boolean).join(" ") || user.email || "ผู้ใช้";
      const avatar = menu.querySelector(".user-avatar");
      avatar.classList.remove("is-guest");
      if (/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//i.test(user.picture || "") || user.picture === DEV_DUMMY_AVATAR) {
        avatar.innerHTML = `<img src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer" width="32" height="32">`;
        avatar.querySelector("img").addEventListener("error", () => { avatar.textContent = name.trim().charAt(0).toUpperCase(); });
      } else {
        avatar.textContent = name.trim().charAt(0).toUpperCase();
      }
      const shortName = menu.querySelector(".user-name");
      shortName.textContent = user.given_name || name;
      shortName.hidden = false;
      const id = menu.querySelector(".user-id");
      id.innerHTML = `<strong>${escapeHtml(name)}</strong><small>${escapeHtml(user.email || "")}</small>`;
      id.hidden = false;
      menu.querySelector("summary").setAttribute("aria-label", `บัญชี ${name} และการแสดงผล`);
      login.hidden = true;
      menu.querySelector(".user-logout").hidden = false;
    });
  }

  async updateClassroomCta(current) {
    const cta = this.querySelector(".nav-cta");
    if (!cta || typeof fetch !== "function") return;
    try {
      const session = await currentSession();
      if (!session) return;
      const requestedClassroomId = current === "classroom"
        ? new URLSearchParams(location.search).get("id") || ""
        : FEATURED_CLASSROOM_ID;
      const targetClassroomId = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(requestedClassroomId)
        ? requestedClassroomId
        : FEATURED_CLASSROOM_ID;
      const membership = Array.isArray(session.classrooms)
        ? session.classrooms.find((item) => item.classroom_id === targetClassroomId)
        : null;
      const classroomHref = `classroom.html?id=${targetClassroomId}`;

      // Home page signed in: the page itself lists "คลาสของฉัน" and "เลือกคลาสเพิ่ม",
      // so the header keeps only the user menu (plus the admin console link).
      if (current === "home" && session.authenticated) {
        this.querySelector(".nav-directory")?.remove();
        if (session.user?.system_role !== "admin") { cta.remove(); return; }
      }

      if (session.user?.system_role === "admin") {
        cta.textContent = "จัดการผู้สอน";
        cta.href = `admin/?id=${encodeURIComponent(targetClassroomId)}`;
      } else if (membership?.status === "active") {
        if (membership.role === "teacher") {
          cta.textContent = "หน้าของอาจารย์";
          cta.href = `admin/?id=${encodeURIComponent(targetClassroomId)}`;
        } else {
          cta.textContent = current === "classroom" ? "เข้าสู่เนื้อหา" : "ห้องเรียนของฉัน";
          cta.href = current === "classroom" ? moduleContentHref(membership.active_module_id, targetClassroomId) : classroomHref;
        }
      } else if (membership?.status === "pending") {
        cta.textContent = "รออนุมัติ";
        cta.href = current === "classroom" ? "#syllabus" : classroomHref;
      } else {
        cta.textContent = "ลงทะเบียน";
        cta.href = classroomHref;
      }
    } catch (_error) {
      // Keep the server-independent login link when session status is unavailable.
    }
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<footer>
      <div class="footer-owner"><p><a href="index.html">AIRR · AI for Research &amp; Review</a></p><div class="institution-lockup footer-institution"><img src="https://upload.wikimedia.org/wikipedia/commons/4/43/Kasetsart_Sublogo-TH.svg" alt="ตราสัญลักษณ์พร้อมชื่อมหาวิทยาลัยเกษตรศาสตร์" width="232" height="300" loading="lazy"><a class="footer-lab-logo" href="https://madlab.cpe.ku.ac.th" target="_blank" rel="noopener" aria-label="MADLab - Multimedia Analysis and Discovery Laboratory"><img class="logo-on-dark" src="${new URL("images/madlab-ku-mark-dark.svg", SHELL_SCRIPT_URL).href}" alt="" width="64" height="64" loading="lazy"><img class="logo-on-light" src="${new URL("images/madlab-ku-mark-light.svg", SHELL_SCRIPT_URL).href}" alt="" width="64" height="64" loading="lazy"></a><span><a href="https://madlab.cpe.ku.ac.th" target="_blank" rel="noopener">MADLab - Multimedia Analysis and Discovery Laboratory</a><br>ภาควิชาวิศวกรรมคอมพิวเตอร์<br>มหาวิทยาลัยเกษตรศาสตร์</span></div></div>
      <div class="footer-credit"><p>© <a href="https://punpiti.github.io/" target="_blank" rel="noopener">One234</a>@KU All rights reserved.</p></div>
    </footer>`;
  }
}

customElements.define("site-header", SiteHeader);
customElements.define("site-footer", SiteFooter);

// Keep classroom-level content choices when learners move between modules.
function preserveClassroomContext() {
  const activeClassroomId = new URLSearchParams(location.search).get("classroom_id") || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(activeClassroomId)) return;
  document.querySelectorAll('a[href^="prepare.html"], a[href^="module-"]').forEach((link) => {
    const url = new URL(link.getAttribute("href"), location.href);
    if (url.origin !== location.origin || url.searchParams.has("classroom_id")) return;
    url.searchParams.set("classroom_id", activeClassroomId);
    link.href = `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", preserveClassroomContext);
else preserveClassroomContext();

// Fragment navigation can run before the custom header/footer have expanded,
// leaving an old bookmarked anchor at the wrong scroll position. Re-apply it
// after two layout frames so links such as index.html#course land correctly.
if (location.hash) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView({ block: "start" });
  }));
}

// Instructor-only links (e.g. the slide .pptx on topic pages): shown to admins and active
// teachers/TAs of any class. This only hides the link from learners; the file itself is public.
async function revealInstructorOnly() {
  const items = document.querySelectorAll("[data-instructor-only]");
  if (!items.length || typeof fetch !== "function") return;
  try {
    const session = await currentSession();
    const staff = session?.user?.system_role === "admin"
      || (Array.isArray(session?.classrooms) && session.classrooms.some((c) => c.status === "active" && (c.role === "teacher" || c.role === "ta")));
    if (staff) items.forEach((el) => { el.hidden = false; });
  } catch (_error) {
    // No session: keep instructor-only links hidden.
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", revealInstructorOnly);
else revealInstructorOnly();
