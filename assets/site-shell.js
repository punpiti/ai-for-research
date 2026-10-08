const MODULE_LINKS = [
  [1, "prepare.html", "Prepare Your AI Research Workspace"],
  [2, "module-2.html", "Your First AI Research Task"],
  [3, "module-3.html", "Problem → Gap → Research Question"],
  [4, "module-4.html", "Literature Evidence"],
  [5, "module-5.html", "Research Logic"],
  [6, "module-6.html", "Experiment Design Stress Test"],
  [7, "module-7.html", "Analysis & Visualization"],
  [8, "module-8.html", "Document Production"],
  [9, "module-9.html", "Personal AI Research Workflow"],
];

const PRODUCTION_BASE = "https://urban.cpe.ku.ac.th/ai-for-research/";
const GOOGLE_ANALYTICS_ID = "G-BWX7PFH4XM";
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
  home: [["course", "หลักสูตร"], ["requirements", "ข้อกำหนด"]],
  1: [["setup", "ก่อนเริ่ม"], ["practice", "ฝึกทำ"], ["homework", "งานท้ายบท"]],
  2: [["sources", "ดาวน์โหลดข้อมูล"], ["json-basics", "รู้จัก MD/JSON"], ["activity", "ลงมือทำ"], ["submit", "ส่งงาน"], ["finish", "ทบทวน"]],
  3: [["start", "ก่อนเริ่ม"], ["activity", "ลงมือทำ"], ["finish", "ทบทวน"]],
  4: [["prepare", "ก่อนเริ่ม"], ["shared", "ลงมือทำ"], ["finish", "ทบทวน"]],
  5: [["start", "ก่อนเริ่ม"], ["activity", "ลงมือทำ"], ["review", "ทบทวน"]],
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
    const moduleLinks = MODULE_LINKS.map(([number, href, label]) => {
      const active = String(number) === current ? ' aria-current="page"' : "";
      return `<a class="available" href="${href}"${active}>${number} · ${label}</a>`;
    }).join("");
    const localLinks = (LOCAL_LINKS[current] || [])
      .map(([id, label]) => `<a href="#${id}">${label}</a>`)
      .join("");
    this.innerHTML = `<header class="site-header">
      <a class="brand" href="${isHome ? "#top" : "index.html"}" aria-label="AI for Research หน้าแรก"><span class="brand-mark">AI</span><span>for Research</span></a>
      <nav aria-label="เมนูหลัก">
        ${isHome ? "" : '<a href="index.html">หน้าหลัก</a>'}
        <details class="module-menu"><summary>โมดูล 1–9</summary><div>${moduleLinks}</div></details>
        ${localLinks}
        <a class="nav-cta" href="${current === "register" ? "index.html#course" : "register.html"}">${current === "register" ? "ดูรายละเอียดคลาส" : "สมัครเป็นกลุ่ม"}</a>
      </nav>
    </header>`;
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<footer>
      <div class="footer-owner"><p><a href="index.html">AI for Research</a></p><div class="institution-lockup footer-institution"><img src="https://upload.wikimedia.org/wikipedia/commons/4/43/Kasetsart_Sublogo-TH.svg" alt="ตราสัญลักษณ์พร้อมชื่อมหาวิทยาลัยเกษตรศาสตร์" width="232" height="300" loading="lazy"><span>ภาควิชาวิศวกรรมคอมพิวเตอร์<br>มหาวิทยาลัยเกษตรศาสตร์</span></div></div>
      <div class="footer-credit"><p>Developed by One234@KU</p><p>© 2026 พันธุ์ปิติ เปี่ยมสง่า. All rights reserved.</p></div>
    </footer>`;
  }
}

customElements.define("site-header", SiteHeader);
customElements.define("site-footer", SiteFooter);
