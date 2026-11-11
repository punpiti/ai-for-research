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
const productionFile = location.pathname.endsWith("/") ? "" : location.pathname.split("/").pop();
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
  6: [["start", "ก่อนเริ่ม"], ["activity", "ลงมือทำ"], ["review", "ทบทวน"]],
  7: [["start", "ก่อนเริ่ม"], ["activity", "ลงมือทำ"], ["review", "ทบทวน"]],
  8: [["start", "ก่อนเริ่ม"], ["activity", "ลงมือทำ"], ["review", "ทบทวน"]],
  9: [["start", "ก่อนเริ่ม"], ["activity", "ลงมือทำ"], ["review", "ทบทวน"]],
  example: [["definition", "โจทย์วิจัย"], ["method", "วิธีวิจัย"], ["review", "ทบทวน"]],
  register: [["form", "เตรียมข้อมูลสมัคร"]],
  checkout: [],
};

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute("current") || "";
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
    const localLinks = (LOCAL_LINKS[current] || [])
      .map(([id, label]) => `<a href="#${id}">${label}</a>`)
      .join("");
    this.innerHTML = `<header class="site-header">
      <a class="brand" href="${isHome ? "#top" : "index.html"}" aria-label="AIRR หน้าแรก"><span class="brand-mark">A</span><span>AIRR</span></a>
      <nav aria-label="เมนูหลัก">
        ${isHome ? "" : '<a href="index.html">หน้าหลัก</a>'}
        ${isClassroomEntry ? `<a href="${classroomDirectoryHref}">คลาสที่เปิดรับ</a>` : `<details class="module-menu"><summary>โมดูล 1–9</summary><div>${moduleLinks}</div></details>`}
        ${localLinks}
        <a class="nav-cta" href="${ctaHref}">${ctaLabel}</a>
      </nav>
    </header>`;

    if (isClassroomEntry && current !== "login") this.updateClassroomCta(current);
  }

  async updateClassroomCta(current) {
    const cta = this.querySelector(".nav-cta");
    if (!cta || typeof fetch !== "function") return;
    try {
      const response = await fetch(`${CLASSROOM_API_BASE}/me`, {
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) return;
      const session = await response.json();
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
      <div class="footer-owner"><p><a href="index.html">AIRR · AI for Research &amp; Review</a></p><div class="institution-lockup footer-institution"><img src="https://upload.wikimedia.org/wikipedia/commons/4/43/Kasetsart_Sublogo-TH.svg" alt="ตราสัญลักษณ์พร้อมชื่อมหาวิทยาลัยเกษตรศาสตร์" width="232" height="300" loading="lazy"><span>ภาควิชาวิศวกรรมคอมพิวเตอร์<br>มหาวิทยาลัยเกษตรศาสตร์</span></div></div>
      <div class="footer-credit"><p>Developed by One234@KU</p><p>© 2026 พันธุ์ปิติ เปี่ยมสง่า. All rights reserved.</p></div>
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
