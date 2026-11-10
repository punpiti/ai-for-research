document.documentElement.classList.add("js");

const classroomApiBase = "/api/ai-for-research/classrooms";

function classroomIdFromLocation() {
  const queryValue = new URLSearchParams(location.search).get("classroom_id") || "";
  const pathMatch = location.pathname.match(/\/classrooms\/([A-Za-z0-9][A-Za-z0-9._-]{2,63})\/content\//);
  const value = queryValue || pathMatch?.[1] || "";
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(value) ? value : "";
}

function markNoviceCaseContent() {
  if (document.querySelector("[data-module-2-shared-case]")) return;
  const caseTerms = /(?:หิว|อิ่ม|เรื่องอาหาร|มื้อข้าว|satiety|fullness|hunger)/i;
  document.querySelectorAll("p").forEach((paragraph) => {
    if (/เคสฝึก(?:สำหรับ)?นิสิต|เคสฝึกสำหรับนิสิต|นิสิต\/นักวิจัยมือใหม่/.test(paragraph.textContent) || caseTerms.test(paragraph.textContent)) {
      paragraph.dataset.audienceRoute = "student";
    }
  });
  document.querySelectorAll(".command, pre").forEach((example) => {
    if (caseTerms.test(example.textContent)) example.dataset.audienceRoute = "student";
  });
  const module3Example = document.querySelector("#example");
  if (module3Example) module3Example.dataset.audienceRoute = "student";
  const module5CaseHeading = document.querySelector('[id^="3-เคสฝึก"]');
  if (module5CaseHeading) {
    let item = module5CaseHeading;
    while (item && (item === module5CaseHeading || item.tagName !== "H3")) {
      item.dataset.audienceRoute = "student";
      item = item.nextElementSibling;
    }
  }
}

function applyClassroomContentRoutes(routes) {
  const allowed = new Set(Array.isArray(routes) ? routes : []);
  const route = allowed.size === 1 && allowed.has("faculty")
    ? "faculty"
    : allowed.size === 1 && allowed.has("student") ? "student" : "mixed";
  document.documentElement.dataset.classroomContentRoute = route;
  markNoviceCaseContent();
  document.querySelectorAll("[data-audience-route]").forEach((element) => {
    const audience = element.dataset.audienceRoute;
    const contentRoute = document.querySelector("[data-module-2-shared-case]") ? "student" : route;
    element.hidden = contentRoute !== "mixed" && audience !== contentRoute;
  });
  if (route === "faculty" && !document.querySelector("[data-module-2-shared-case]")) {
    document.querySelectorAll('site-header a[href="#sources"]').forEach((link) => { link.href = "#faculty-sources"; });
    document.querySelectorAll('site-header a[href="#activity"]').forEach((link) => { link.href = "#faculty-activity"; });
  }
  document.dispatchEvent(new CustomEvent("classroom-content-route", { detail: { route, routes: [...allowed] } }));
  return route;
}

async function resolveClassroomContentRoute() {
  const classroomId = classroomIdFromLocation();
  if (!classroomId) return applyClassroomContentRoutes(["student", "faculty"]);


  try {
    const response = await fetch(`${classroomApiBase}/${encodeURIComponent(classroomId)}/content-route`, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) throw new Error("classroom-content-route-unavailable");
    const payload = await response.json();
    const routes = Array.isArray(payload.allowed_routes)
      ? payload.allowed_routes.filter((route) => route === "student" || route === "faculty")
      : [];
    return applyClassroomContentRoutes(routes.length ? routes : ["student", "faculty"]);
  } catch (_error) {
    // Standalone/public module pages remain usable when classroom context is unavailable.
    return applyClassroomContentRoutes(["student", "faculty"]);
  }
}

window.classroomContentRouteReady = resolveClassroomContentRoute();

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function setCookie(name, value) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

function getPreference(name) {
  return getCookie(name) || localStorage.getItem(name);
}

function setPreference(name, value) {
  setCookie(name, value);
  // Browsers do not persist cookies for file:// pages; this also provides a
  // fallback when cookies are blocked during local classroom testing.
  localStorage.setItem(name, value);
}

const researchProfileKey = "ai-research-profile:v1";
// [key, label, type, example placeholder, options for select]
const researchProfileFields = [
  ["thai_name", "ชื่อ-นามสกุล ภาษาไทย (ไม่บังคับ)", "text", "ใช้ตอนทำเอกสาร เช่น หน้าปก"],
  ["english_name", "ชื่อ-นามสกุล ภาษาอังกฤษ (ไม่บังคับ)", "text", "ใช้ตอนทำเอกสารภาษาอังกฤษ"],
  ["affiliation", "สังกัด", "text", "เช่น ภาควิชาวิศวกรรมเครื่องกล ม.เกษตรศาสตร์"],
  ["role", "ตอนนี้คุณเป็น", "text", "เช่น นิสิตปริญญาโทปี 1, อาจารย์, นักวิจัย"],
  ["field", "สาขาที่ทำวิจัย", "text", "เช่น วิทยาศาสตร์การอาหาร, วิศวกรรมโยธา"],
  ["advisor", "อาจารย์ที่ปรึกษา (ไม่บังคับ)", "text", "เว้นว่างได้ ถ้าไม่ต้องการระบุ"],
  ["research_topic", "หัวข้อที่ทำหรือสนใจ", "textarea", "1–2 ประโยค เช่น ใช้ภาพถ่ายตรวจความสุกของมะม่วง"],
  ["research_stage", "งานตอนนี้อยู่ขั้นไหน", "text", "เช่น ยังหาหัวข้อ, อ่านงานวิจัยเก่า, เก็บข้อมูลแล้ว, กำลังเขียนบทความ"],
  ["desired_output", "อยากได้ผลงานแบบไหน", "text", "เช่น proposal, บทความวารสาร, วิทยานิพนธ์, poster"],
  ["target_venue", "อยากตีพิมพ์หรือนำเสนอที่ไหน (ถ้ามี)", "text", "ชื่อวารสารหรืองานประชุม หรือเว้นว่าง"],
  ["intended_audience", "ใครจะอ่านหรือใช้ผลงานนี้", "text", "เช่น กรรมการสอบ, นักวิจัยในสาขา, ผู้ประกอบการ"],
  ["working_language", "ภาษาที่ใช้เขียนงาน", "text", "เช่น ไทย, อังกฤษ, ไทยปนอังกฤษ"],
  ["constraints", "ข้อจำกัดที่ AI ควรรู้", "textarea", "เช่น ต้องส่งใน 2 เดือน, ใช้ได้แค่ Excel, ข้อมูลเป็นภาษาไทย"],
  ["data_sensitivity", "ข้อมูลของคุณมีความลับไหม", "select", "", [
    "ไม่มีข้อมูลลับ ใช้กับ AI ได้",
    "มีข้อมูลส่วนบุคคลหรือข้อมูลลับบางส่วน",
    "ยังไม่แน่ใจ",
  ]],
];

function loadResearchProfile() {
  try { return JSON.parse(localStorage.getItem(researchProfileKey) || "{}"); }
  catch { return {}; }
}

function saveResearchProfile(profile) {
  localStorage.setItem(researchProfileKey, JSON.stringify(profile));
}

function hasResearchProfile(profile) {
  return researchProfileFields.some(([key]) => String(profile[key] || "").trim());
}

const profileKeysByModule = {
  1: researchProfileFields.map(([key]) => key),
  2: ["role", "affiliation", "field", "research_topic", "research_stage", "working_language", "data_sensitivity"],
  3: ["field", "research_topic", "research_stage", "desired_output", "intended_audience", "constraints", "data_sensitivity"],
  4: ["field", "research_topic", "target_venue", "intended_audience", "working_language", "data_sensitivity"],
  5: ["field", "research_topic", "research_stage", "target_venue", "intended_audience", "constraints", "data_sensitivity"],
  6: ["field", "research_topic", "research_stage", "target_venue", "constraints", "data_sensitivity"],
  7: ["field", "research_topic", "desired_output", "intended_audience", "constraints", "data_sensitivity"],
  8: ["affiliation", "field", "target_venue", "intended_audience", "desired_output", "working_language", "constraints", "data_sensitivity"],
  9: ["role", "field", "research_topic", "research_stage", "desired_output", "working_language", "constraints", "data_sensitivity"],
};

function currentModuleNumber() {
  if (location.pathname.endsWith("prepare.html")) return 1;
  const match = location.pathname.match(/module-(\d+)\.html$/);
  return match ? Number(match[1]) : 1;
}

function profileContextText(profile) {
  const allowed = new Set(profileKeysByModule[currentModuleNumber()] || []);
  const lines = researchProfileFields
    .filter(([key]) => allowed.has(key) && String(profile[key] || "").trim())
    .map(([key, label]) => `- ${label}: ${String(profile[key]).trim()}`);
  return lines.length ? `ข้อมูลผู้เรียนที่ต้องใช้เป็นเงื่อนไข\n${lines.join("\n")}\nใช้ข้อมูลนี้เพื่อจำกัดขอบเขต ภาษา แหล่งค้น และค่าเริ่มต้น ห้ามเดาข้อมูลในช่องที่ยังไม่ได้บันทึก` : "";
}

function renderResearchProfile(host, forceEdit = false) {
  const profile = loadResearchProfile();
  const hasProfile = hasResearchProfile(profile);
  const relevantKeys = new Set(profileKeysByModule[currentModuleNumber()] || []);
  const hasRelevantProfile = researchProfileFields.some(([key]) => relevantKeys.has(key) && String(profile[key] || "").trim());
  const editMode = forceEdit || host.dataset.mode === "edit" || !hasRelevantProfile;
  if (!editMode) {
    const rows = researchProfileFields
      .filter(([key]) => relevantKeys.has(key) && String(profile[key] || "").trim())
      .map(([key, label]) => `<div><dt>${label}</dt><dd>${String(profile[key]).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</dd></div>`)
      .join("");
    host.innerHTML = `<div class="profile-status"><div><p class="eyebrow">ข้อมูลของคุณ</p><h3>ใช้ข้อมูลนี้กับกิจกรรมในบท</h3><p>เลือกคัดลอกให้ AI เมื่อต้องการ ข้อมูลเก็บอยู่ในเบราว์เซอร์เครื่องนี้</p></div><div class="profile-summary-actions"><button type="button" class="button primary" data-profile-copy>คัดลอกข้อมูลให้ AI</button><button type="button" class="button secondary" data-profile-edit>แก้ไขข้อมูล</button><small aria-live="polite"></small></div></div><dl class="profile-summary">${rows}</dl>`;
    host.querySelector("[data-profile-edit]").addEventListener("click", () => renderResearchProfile(host, true));
    host.querySelector("[data-profile-copy]").addEventListener("click", async () => {
      await navigator.clipboard.writeText(profileContextText(profile));
      host.querySelector(".profile-summary-actions small").textContent = "คัดลอกแล้ว";
    });
    return;
  }
  const escapeAttribute = (text) => String(text || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  // Ask only what this module uses; Module 1 collects everything once.
  const visibleFields = researchProfileFields.filter(([key]) => relevantKeys.has(key));
  const fields = visibleFields.map(([key, label, type, example, options]) => {
    const value = escapeAttribute(profile[key]);
    const placeholder = example ? ` placeholder="${escapeAttribute(example)}"` : "";
    let control = `<input name="${key}" value="${value}"${placeholder}>`;
    if (type === "textarea") control = `<textarea name="${key}" rows="3"${placeholder}>${value}</textarea>`;
    if (type === "select") {
      const choices = [...options];
      if (profile[key] && !choices.includes(profile[key])) choices.push(profile[key]);
      control = `<select name="${key}"><option value="">เลือก</option>${choices.map((choice) => `<option${choice === profile[key] ? " selected" : ""}>${escapeAttribute(choice)}</option>`).join("")}</select>`;
    }
    return `<label><span>${label}</span>${control}</label>`;
  }).join("");
  host.innerHTML = `<div class="profile-status"><div><p class="eyebrow">ข้อมูลของคุณ · เก็บในเครื่องนี้</p><h3>${hasProfile ? "ตรวจหรือแก้ไขข้อมูล" : "บอก AI เกี่ยวกับงานของคุณ"}</h3><p>กรอกเท่าที่จำเป็น ข้ามข้อที่ไม่เกี่ยวข้องได้ และห้ามใส่รหัสผ่านหรือข้อมูลส่วนบุคคลที่ไม่จำเป็น</p></div></div><form class="profile-form">${fields}<div class="profile-actions"><button class="button primary" type="submit">บันทึกข้อมูลในเครื่องนี้</button>${hasRelevantProfile ? '<button class="button secondary" type="button" data-profile-cancel>ยกเลิก</button>' : ""}<small aria-live="polite"></small></div><p class="form-help">ข้อมูลนี้เก็บไว้ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ระบบของคลาสไม่ได้รับหรือเก็บไว้บน server ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ต้องกรอกใหม่</p></form>`;
  const form = host.querySelector("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = { ...loadResearchProfile() };
    for (const [key] of visibleFields) next[key] = form.elements[key].value.trim();
    saveResearchProfile(next);
    document.dispatchEvent(new CustomEvent("research-profile-updated", { detail: next }));
    for (const item of document.querySelectorAll("[data-research-profile]")) renderResearchProfile(item);
  });
  const cancel = host.querySelector("[data-profile-cancel]");
  if (cancel) cancel.addEventListener("click", () => renderResearchProfile(host));
}

for (const host of document.querySelectorAll("[data-research-profile]")) renderResearchProfile(host);

// ทุกโมดูลเริ่มจากกรณีเดียวกัน เพื่อให้ผู้เรียนทบทวนตรรกะการวิจัยก่อนใช้ AI
// โดยไม่ต้องคัดลอกเนื้อหาฉบับเต็มไปไว้หลายหน้า
const moduleHero = document.querySelector(".module-hero");
if (moduleHero && !document.querySelector("[data-hunger-review]")) {
  const review = document.createElement("section");
  review.className = "section hunger-review";
  review.dataset.hungerReview = "";
  review.dataset.audienceRoute = "student";
  review.innerHTML = `<div class="section-heading compact">
    <p class="eyebrow">เคสฝึกสำหรับนิสิตและนักวิจัยมือใหม่</p>
    <h2>หิว → กิน → อิ่ม</h2>
    <p><strong>หิว</strong> คือปัญหา <strong>อิ่ม</strong> คือผลที่ต้องการ และ <strong>กิน</strong> เป็นเพียงวิธีหนึ่ง ต้องกำหนดว่าใครหิว วัดความอิ่มอย่างไร มีข้อจำกัดอะไร และใช้หลักฐานใดตรวจว่ากินแล้วได้ผลจริง</p>
  </div><div class="plain-note"><strong>จำไว้ตลอดบท:</strong> ทำขั้นตอนครบหรือใช้ AI สำเร็จ ไม่ได้แปลว่าตอบปัญหาวิจัยแล้ว ผลงานท้ายบทต้องเชื่อมกลับไปยังปัญหา วัตถุประสงค์ และหลักฐานเสมอ</div>
  <div class="hero-actions"><a class="button secondary" href="hunger-research-methodology.html">เปิดเคสฝึกฉบับเต็ม →</a></div>`;
  review.hidden = !document.querySelector("[data-module-2-shared-case]") && document.documentElement.dataset.classroomContentRoute === "faculty";
  if (document.querySelector("[data-module-2-shared-case]")) {
    review.querySelector(".eyebrow").textContent = "เคสกลางสำหรับผู้เรียนทุกคน";
    review.querySelector(".section-heading p:last-child").textContent = "หิวคือสิ่งที่อยากแก้ กินคือสิ่งที่ลองทำ และอิ่มคือผลที่อยากได้ เริ่มจากเรื่องใกล้ตัวนี้เพื่อดูว่า AI อ่านสูตร ตาราง และภาพ แล้วสร้างผลงานให้เราเปิดตรวจได้อย่างไร";
    review.querySelector(".plain-note").textContent = "ช่วงสาธิตดูตัวอย่างร่วมกันก่อน เมื่อฝึกเองให้ใช้ชุดข้อมูลเดียวกัน แล้วตรวจคำตอบกับไฟล์ต้นฉบับ";
    const caseLink = review.querySelector("a");
    caseLink.href = "#food-demo";
    caseLink.textContent = "ดูตัวอย่างอาหารด้านล่าง →";
  }
  moduleHero.insertAdjacentElement("afterend", review);
}

const guidedModuleConfigs = {
  6: {
    title: "ตรวจแบบวิจัยไปทีละขั้น",
    output: "แบบวิจัยที่ระบุสิ่งที่จะทดสอบ วิธีวัด คู่เทียบ เกณฑ์ตัดสิน และผลที่ทำให้ข้อสรุปไม่ผ่าน",
    steps: "(1) เลือกกรณีศึกษา (2) ตรึงข้อกล่าวอ้าง (3) แตกเป็นสมมติฐาน (4) ระบุส่วนประกอบของการศึกษา (5) ตรวจเครื่องมือและข้อกำกับ (6) เตรียมการตอบสนองต่อผลหลายแบบ (7) ท้าทายและตัดสินความพร้อม",
  },
  7: {
    title: "วิเคราะห์ข้อมูลและสร้างภาพไปทีละขั้น",
    output: "รายงานนำเข้าข้อมูล การตรวจคุณภาพ ผลวิเคราะห์ ตาราง ภาพ และหลักฐานที่ทำซ้ำได้",
    steps: "(1) เลือกข้อมูลและคำถาม (2) ตรวจชนิดแฟ้มและสิทธิการใช้ (3) นำเข้าโดยไม่แก้ต้นฉบับ (4) ตรวจและจัดข้อมูล (5) เลือกวิธีวิเคราะห์ (6) สร้างตารางและภาพ (7) ตรวจข้อสรุปและส่งออก",
  },
  8: {
    title: "ผลิตเอกสารไปทีละขั้น",
    output: "เอกสารหรือสื่อนำเสนอที่ตรงข้อกำหนดของแหล่งเผยแพร่และตรวจย้อนกลับถึงเนื้อหาต้นทางได้",
    steps: "(1) เลือกผลงานและแหล่งเผยแพร่ (2) ตรวจชุดแม่แบบทางการ (3) ทดสอบแม่แบบเดิม (4) วางโครงจากเนื้อหาที่ตรวจแล้ว (5) เพิ่มข้อความ รูป ตาราง และรายการอ้างอิงทีละส่วน (6) สร้างเอกสารเต็ม (7) ตรวจเนื้อหา รูปแบบ และไฟล์สุดท้าย",
  },
  9: {
    title: "สร้างชุดวิธีทำงานส่วนตัวไปทีละขั้น",
    output: "ชุดวิธีทำงานกับ AI ที่มีข้อมูลผู้ใช้ กติกา แบบฟอร์ม จุดตรวจ การทดสอบ และบันทึกการใช้งาน",
    steps: "(1) เลือกงานที่ทำซ้ำ (2) บันทึกวิธีปัจจุบัน (3) กำหนดข้อมูลเข้าและผลลัพธ์ (4) ตั้งสิ่งที่ทำได้ ต้องถาม ห้ามทำ และต้องส่งต่อ (5) ประกอบชุดใช้งาน (6) ทดลองกับกรณีปกติและกรณีผิดพลาด (7) แก้ไขและบันทึกรุ่นแรก",
  },
};

const guidedModuleNumber = currentModuleNumber();
const guidedConfig = guidedModuleConfigs[guidedModuleNumber];
if (guidedConfig) {
  const outcomesSection = document.querySelector("#outcomes");
  const activitySection = document.querySelector("#activity");
  if (outcomesSection && activitySection) {
    const guide = document.createElement("section");
    guide.className = "section markdown-section guided-module-start";
    guide.innerHTML = `<div class="section-heading compact"><p class="eyebrow">เรียนด้วย AI</p><h2>${guidedConfig.title}</h2><p>เริ่มทำได้ทันที ไม่ต้องอ่านเนื้อหาทั้งหมดก่อน AI ต้องอธิบายเฉพาะสิ่งที่จำเป็นในขั้นปัจจุบัน แล้วให้คุณทำกับงานของตนเอง</p></div><div class="markdown-body"><div class="command markdown-command"><code>ช่วยเป็นผู้ช่วยเรียนโมดูล ${guidedModuleNumber} และพาฉันอ่านไป ทำไป และคิดไปทีละขั้น ห้ามสอนเนื้อหาทั้งหมดล่วงหน้า

ชิ้นงานปลายทางของโมดูลนี้คือ: ${guidedConfig.output}
เส้นทางทำงานคือ: ${guidedConfig.steps}

ในแต่ละขั้น:
1. อ่านข้อมูลใน profile/ ถ้ามี และถามข้อมูลที่ยังขาดทีละข้อ
2. บอกชิ้นงานย่อยที่ต้องได้ แล้วอธิบายเฉพาะแนวคิดที่จำเป็นเป็นภาษาไทยไม่เกิน 3 ประโยค
3. ใช้กรณีวิจัยที่คลาสกำหนด หรือกรณีวิจัยของฉันเมื่อได้รับอนุญาต โดยไม่เปลี่ยนกรณีศึกษาเอง
4. ถามฉันเพียงหนึ่งคำถามแล้วรอคำตอบ
5. แยกข้อมูลที่ตรวจแล้ว การตัดสินใจ สมมติฐาน และสิ่งที่ยังต้องตรวจ
6. ถามคำถามท้าทายหนึ่งข้อและรอคำตอบ
7. บันทึกเฉพาะสิ่งที่ฉันอนุมัติ แล้วให้ฉันเลือกแก้หรือไปขั้นถัดไป

ห้ามแต่งข้อมูล หลักฐาน ผล ตัวเลข แหล่งอ้างอิง หรือการอนุมัติ ห้ามเลือกวิธี เครื่องมือ หรือข้อสรุปแทนฉัน เริ่มจากตรวจของที่ฉันมีและถามคำถามแรกเพียงข้อเดียว</code><button type="button" data-copy>คัดลอกคำสั่งเริ่มเรียนกับ AI</button></div></div>`;

    const reference = document.createElement("details");
    reference.className = "section concept-reference";
    reference.innerHTML = `<summary><strong>เปิดคลังคำอธิบายเมื่อ AI พามาถึงแนวคิดนั้น</strong></summary><p>เนื้อหาในส่วนนี้เก็บรายละเอียดเดิมไว้ครบ แต่ไม่จำเป็นต้องอ่านและจำทั้งหมดก่อนเริ่มทำงาน</p>`;
    let cursor = outcomesSection.nextElementSibling;
    while (cursor && cursor !== activitySection) {
      const next = cursor.nextElementSibling;
      reference.append(cursor);
      cursor = next;
    }
    outcomesSection.after(guide, reference);
  }

  const finish = document.querySelector("#finish .markdown-body");
  if (finish && !finish.querySelector("[data-checklist]")) {
    const lists = [...finish.querySelectorAll(":scope > ul")];
    if (lists.length) {
      const checklist = document.createElement("div");
      checklist.className = "checklist";
      checklist.dataset.checklist = `module-${guidedModuleNumber}`;
      for (const list of lists) {
        for (const item of list.querySelectorAll(":scope > li")) {
          const label = document.createElement("label");
          label.innerHTML = `<input type="checkbox"> ${item.innerHTML}`;
          checklist.append(label);
        }
        list.remove();
      }
      for (const paragraph of [...finish.querySelectorAll(":scope > p")]) {
        if (/^(เกณฑ์ผ่าน|ถือว่าผ่าน)/.test(paragraph.textContent.trim())) {
          const label = document.createElement("label");
          label.innerHTML = `<input type="checkbox"> ${paragraph.innerHTML}`;
          checklist.append(label);
          paragraph.remove();
        }
      }
      finish.append(checklist);
    }
  }
}

const links = document.querySelectorAll('a[href^="#"]');
for (const link of links) {
  link.addEventListener("click", () => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) target.setAttribute("tabindex", "-1");
  });
}

const markdownArticle = document.querySelector(".markdown-body");
const markdownToc = document.querySelector(".markdown-toc ol");
if (markdownArticle && markdownToc) {
  for (const heading of markdownArticle.querySelectorAll("h2")) {
    if (!heading.id) heading.id = heading.textContent.trim().toLowerCase().replace(/\s+/g, "-");
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    item.appendChild(link);
    markdownToc.appendChild(item);
  }
}
const platformButtons = document.querySelectorAll("[data-platform-button]");
const platformPanels = document.querySelectorAll("[data-platform-panel]");
function selectPlatform(name, persist = false) {
  for (const button of platformButtons) button.setAttribute("aria-pressed", String(button.dataset.platformButton === name));
  for (const panel of platformPanels) panel.hidden = panel.dataset.platformPanel !== name;
  if (persist) setPreference("ai-research-platform", name);
}
if (platformButtons.length) {
  const savedValue = getPreference("ai-research-platform");
  const saved = ["windows", "macos", "linux"].includes(savedValue) ? savedValue : null;
  const detected = /Mac/.test(navigator.platform) ? "macos" : /Win/.test(navigator.platform) ? "windows" : "linux";
  selectPlatform(saved || detected);
  for (const button of platformButtons) button.addEventListener("click", () => selectPlatform(button.dataset.platformButton, true));
}

const promptProfileMap = {
  THAI_NAME: "thai_name",
  ENGLISH_NAME: "english_name",
  AFFILIATION: "affiliation",
  ROLE: "role",
  RESEARCH_FIELD: "field",
  ADVISOR: "advisor",
  RESEARCH_TOPIC_OR_RQ: "research_topic",
  TARGET_VENUE: "target_venue",
  INTENDED_AUDIENCE: "intended_audience",
  RESEARCH_QUESTION: "research_topic",
  OUTPUT_AUDIENCE: "intended_audience",
  OUTPUT_TYPE: "desired_output",
  DATA_CLASSIFICATION: "data_sensitivity",
  WORKING_LANGUAGE: "working_language",
  CONSTRAINTS: "constraints",
};

function applyProfileToPrompt(text, profile) {
  text = text.replace(/^ข้อมูลผู้เรียนที่ต้องใช้เป็นเงื่อนไข[\s\S]*?^ใช้ข้อมูลนี้เพื่อจำกัดขอบเขต ภาษา แหล่งค้น และค่าเริ่มต้น ห้ามเดาข้อมูลในช่องที่ยังไม่ได้บันทึก\n*/m, "");
  for (const [variable, profileKey] of Object.entries(promptProfileMap)) {
    const value = String(profile[profileKey] || "").trim();
    if (value) text = text.replace(new RegExp(`(${variable}:\\s*)(?:\\{\\{[^\\n]*\\}\\}|[^\\n]*)`), `$1${value}`);
  }
  const context = profileContextText(profile);
  return context ? `${context}\n\n${text}` : text;
}

for (const [index, block] of [...document.querySelectorAll(".prompt-template")].entries()) {
  const code = block.querySelector("code");
  if (!code) continue;
  const initialValue = code.textContent;
  const storageKey = `ai-research-prompt:${location.pathname}:${index}`;
  const savedValue = localStorage.getItem(storageKey);
  const editor = document.createElement("textarea");
  editor.className = "prompt-editor";
  editor.setAttribute("aria-label", "แก้ไข Prompt ก่อนส่งให้ AI");
  editor.spellcheck = false;
  editor.value = savedValue ?? applyProfileToPrompt(initialValue, loadResearchProfile());
  editor.rows = Math.min(28, Math.max(10, editor.value.split("\n").length + 1));
  code.replaceWith(editor);

  const copyButton = block.querySelector("[data-copy]");
  const actions = document.createElement("div");
  actions.className = "prompt-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "บันทึกในเครื่อง";
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "คืนค่าเริ่มต้น";
  const status = document.createElement("small");
  status.className = "prompt-save-status";
  status.setAttribute("aria-live", "polite");
  if (savedValue !== null) status.textContent = "โหลดข้อมูลที่บันทึกไว้ใน browser นี้แล้ว";
  saveButton.addEventListener("click", () => {
    localStorage.setItem(storageKey, editor.value);
    status.textContent = "บันทึกแล้วใน browser นี้";
  });
  resetButton.addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    editor.value = initialValue;
    status.textContent = "คืนค่าเริ่มต้นแล้ว";
  });
  if (copyButton) actions.append(copyButton);
  actions.append(saveButton, resetButton, status);
  block.append(actions);
}

document.addEventListener("research-profile-updated", (event) => {
  for (const editor of document.querySelectorAll(".prompt-editor")) {
    editor.value = applyProfileToPrompt(editor.value, event.detail);
  }
});

function nearestPromptHeading(block) {
  const section = block.closest(".markdown-body") || block.parentElement;
  const headings = [...section.querySelectorAll("h2, h3")];
  return headings.filter((heading) => heading.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1)?.textContent.trim()
    || block.closest("section")?.querySelector("h2")?.textContent.trim()
    || "คำสั่งพร้อมใช้";
}

function formatCopyOnlyPrompts() {
  const promptStart = /^(งาน:|ช่วย|ตรวจ|อ่าน|เลือก|ใช้|ถาม|สร้าง|ทำงาน|ทำรายการ|ทำหน้าที่|ตอนนี้|เริ่ม|เปิด|แสดง|นำเข้า|เสนอ|สำรวจ|แยก|สำหรับ citation|จาก |พาฉัน|ท้าทาย|กรอง|ส่งออก)/;
  const breakBefore = /\s+(?=(?:จากนั้น|ก่อน(?:สร้าง|ทำ|ผ่าน|เริ่ม|คำนวณ|วาด)|หลัง(?:จาก|ทำ|สร้าง)|หาก|ถ้า|เมื่อ(?:ครบ|เสร็จ|ผ่าน|พบ)|ห้าม|รอฉัน|สุดท้าย|ส่งมอบ))/g;
  for (const block of document.querySelectorAll(".command:not(.prompt-template):has([data-copy])")) {
    const code = block.querySelector("code");
    if (!code) continue;
    const original = code.textContent.trim();
    const copyButton = block.querySelector("[data-copy]");
    const copyLabel = copyButton?.textContent.trim() || "";
    const explicitPrompt = block.classList.contains("ai-prompt") || /Prompt|คำสั่งสร้าง/.test(copyLabel);
    const explicitExample = /ตัวอย่าง|โครงสร้าง/.test(copyLabel);
    if (explicitPrompt) block.classList.add("ai-prompt");
    if (explicitExample) block.classList.add("copy-example");
    const isTerminalCommand = code.hasAttribute("data-agent-command")
      || /^(?:curl(?:\.exe)?\s|powershell\s|AI_GRAD_AGENT=|bash\s|code\s|agy-ide\s|cd\s)/.test(original);
    if (isTerminalCommand) {
      block.classList.add("terminal-command");
      if (copyButton && copyButton.textContent.trim() === "คัดลอก") copyButton.textContent = "คัดลอกคำสั่ง";
      continue;
    }
    block.classList.add("copy-only-template");
    const heading = nearestPromptHeading(block);
    if (promptStart.test(original) && original.length >= 120 && !original.startsWith("%") && !/@\w+\{|curl |├|└/.test(original)) {
      block.classList.add("copy-prompt-readable");
      let readable = original;
      if (!original.includes("\n")) readable = original.replace(/\s*(\([1-9]\))/g, "\n$1").replace(breakBefore, "\n\n").trim();
      if (explicitPrompt && !/^งาน:/m.test(readable)) readable = `งาน: ${heading}\n\nคำสั่ง:\n${readable}`;
      code.textContent = readable;
    }
    if (explicitPrompt || explicitExample) {
      const header = document.createElement("div");
      header.className = "copy-prompt-heading";
      header.innerHTML = `<span>${explicitPrompt ? "Prompt ให้ AI" : "ตัวอย่าง"}</span><strong></strong>`;
      header.querySelector("strong").textContent = heading;
      block.prepend(header);
    }
  }
}

formatCopyOnlyPrompts();

function decorateModuleActions() {
  const moduleMatch = location.pathname.match(/module-([23])\.html$/);
  if (!moduleMatch) return;
  const moduleNumber = moduleMatch[1];
  const hero = document.querySelector(".module-hero");
  if (hero) {
    const legend = document.createElement("div");
    legend.className = "learning-action-legend";
    legend.setAttribute("aria-label", "คำอธิบายชนิดของเนื้อหา");
    legend.innerHTML = `<span class="content-kind is-read">อ่าน</span><span class="content-kind is-input">เลือก / กรอก</span><span class="content-kind is-download">ดาวน์โหลด</span><span class="content-kind is-action">ทำ / ตรวจ</span><span class="content-kind is-prompt">Prompt ให้ AI</span><span class="content-kind is-submit">ส่งงาน</span>`;
    hero.insertAdjacentElement("afterend", legend);
  }
  const maps = {
    "2": { outcomes:["read","อ่าน"], sources:["download","ดาวน์โหลด"], levels:["read","อ่าน"], "json-basics":["read","อ่าน"], activity:["action","ทำ / ตรวจ"], "local-validator":["prompt","Prompt ให้ AI"], submit:["submit","ส่งงาน"], finish:["action","ตรวจความครบ"] },
    "3": { "learner-level":["input","เลือก"], start:["read","อ่าน"], outcomes:["read","อ่าน"], concepts:["read","อ่าน"], example:["read","อ่านตัวอย่าง"], "student-path":["action","ทำเส้นทางนี้"], "faculty-path":["action","ทำเส้นทางนี้"], activity:["action","ทำ / ตรวจ"], "submit-module-3":["submit","ส่งงาน"], finish:["action","ตรวจความครบ"] }
  };
  for (const [id, [type, label]] of Object.entries(maps[moduleNumber])) {
    const heading = document.querySelector(`#${id} > .section-heading`);
    if (!heading || heading.querySelector(".content-kind")) continue;
    const badge = document.createElement("span");
    badge.className = `content-kind is-${type}`;
    badge.textContent = label;
    heading.prepend(badge);
  }
  for (const profile of document.querySelectorAll(".profile-context")) {
    const label = document.createElement("div");
    label.className = "task-heading profile-task-heading";
    label.innerHTML = `<span class="content-kind is-input">เลือก / กรอก</span><strong>ข้อมูลที่จะใช้กับกิจกรรม</strong>`;
    profile.prepend(label);
  }
  for (const link of document.querySelectorAll("a[download]")) link.classList.add("download-action");
  for (const form of document.querySelectorAll(".module-submission-form")) {
    const label = document.createElement("div");
    label.className = "task-heading form-task-heading";
    label.innerHTML = `<span class="content-kind is-input">กรอก</span><strong>ข้อมูลสำหรับตรวจและส่งความคืบหน้า</strong>`;
    form.before(label);
  }
  const collapsible = moduleNumber === "3"
    ? [["example", "เปิดเคสฝึกนิสิต/นักวิจัยมือใหม่"], ["student-path", "เปิดเส้นทางนักเรียน"], ["faculty-path", "เปิดเส้นทางอาจารย์ / นักวิจัย"]]
    : [];
  for (const [id, summaryText] of collapsible) {
    const section = document.getElementById(id);
    const heading = section?.querySelector(":scope > .section-heading");
    if (!section || !heading || section.querySelector(":scope > details.guided-details")) continue;
    const details = document.createElement("details");
    details.className = "fallback-details guided-details";
    const summary = document.createElement("summary");
    summary.textContent = summaryText;
    details.append(summary);
    while (heading.nextSibling) details.append(heading.nextSibling);
    section.append(details);
  }
  const openHashTarget = () => {
    let target = null;
    try { target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; }
    catch (_error) { target = null; }
    const details = target?.querySelector(":scope > details.guided-details");
    if (details) {
      details.open = true;
      requestAnimationFrame(() => {
        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        target.scrollIntoView({ block: "start" });
        root.style.scrollBehavior = previousScrollBehavior;
      });
    }
  };
  openHashTarget();
  addEventListener("load", () => setTimeout(openHashTarget, 80), { once: true });
  addEventListener("hashchange", openHashTarget);
}

decorateModuleActions();

async function copyCommand(event) {
  const button = event.currentTarget;
  const idleLabel = button.textContent;
  const command = button.closest(".command");
  const editor = command.querySelector(".prompt-editor");
  const code = command.querySelector("code");
  let value = editor ? editor.value : code.textContent;
  const needsResearchContext = /(ค้น|สืบค้น|ค่าเริ่มต้น|แหล่งเผยแพร่|วารสาร|การประชุม|venue|literature|source)/i.test(value);
  if (!editor && needsResearchContext) value = applyProfileToPrompt(value, loadResearchProfile());
  await navigator.clipboard.writeText(value);
  button.textContent = "คัดลอกแล้ว";
  setTimeout(() => { button.textContent = idleLabel; }, 1500);
}
for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", copyCommand);
}

for (const checklist of document.querySelectorAll("[data-checklist]")) {
  const boxes = [...checklist.querySelectorAll('input[type="checkbox"]')];
  const progress = checklist.parentElement.querySelector("[data-progress]");
  const checklistId = checklist.dataset.checklist;
  const updateProgress = () => {
    const done = boxes.filter((box) => box.checked).length;
    if (progress) progress.textContent = `${Math.round(done / boxes.length * 100)}%`;
  };
  boxes.forEach((box, index) => {
    const key = `ai-research-check-${checklistId}-${index}`;
    box.checked = localStorage.getItem(key) === "true";
    box.addEventListener("change", () => { localStorage.setItem(key, box.checked); updateProgress(); });
  });
  updateProgress();
}

const agentInputs = [...document.querySelectorAll('input[name="agent"]')];
const agentRequiredSections = [...document.querySelectorAll("[data-agent-required]")];
const agentGateStatus = document.querySelector("[data-agent-gate-status]");
const defaultProjectName = "ai-for-research-workspace";
const projectNamePreference = "ai-research-project-name";

function validateProjectName(value) {
  if (!value || value === "." || value === "..") return "กรุณาตั้งชื่อโฟลเดอร์โปรเจกต์";
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(value) || /[. ]$/.test(value)) {
    return "ใช้ชื่อโฟลเดอร์เดียว โดยไม่มี / \\ : * ? \" < > | และไม่ลงท้ายด้วยจุดหรือเว้นวรรค";
  }
  return "";
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function quotePosix(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function savedProjectName() {
  const saved = getPreference(projectNamePreference) || defaultProjectName;
  return validateProjectName(saved) ? defaultProjectName : saved;
}

function renderWorkspaceState(projectName, agent) {
  const activeAgent = agent || getPreference("ai-research-agent") || "codex";
  for (const label of document.querySelectorAll("[data-project-name]")) label.textContent = projectName;
  for (const path of document.querySelectorAll("[data-project-path]")) path.textContent = `~/${projectName}`;
  for (const command of document.querySelectorAll("[data-agent-command]")) {
    const template = activeAgent === "antigravity" && command.dataset.antigravityTemplate ? command.dataset.antigravityTemplate : command.dataset.template;
    command.textContent = template
      .replaceAll("{agent}", activeAgent)
      .replaceAll("{projectPs}", quotePowerShell(projectName))
      .replaceAll("{projectSh}", quotePosix(projectName))
      .replaceAll("{project}", projectName);
  }
}

function setupProjectName() {
  const input = document.querySelector("[data-project-name-input]");
  if (!input) return;
  const status = document.querySelector("[data-project-name-status]");
  const reset = document.querySelector("[data-project-name-reset]");
  const commit = () => {
    const projectName = input.value.trim() || defaultProjectName;
    const error = validateProjectName(projectName);
    input.setAttribute("aria-invalid", error ? "true" : "false");
    if (error) {
      status.textContent = error;
      return;
    }
    setPreference(projectNamePreference, projectName);
    renderWorkspaceState(projectName);
    status.textContent = `บันทึกแล้ว: ${projectName}`;
  };
  input.value = savedProjectName();
  renderWorkspaceState(input.value);
  input.addEventListener("input", commit);
  input.addEventListener("blur", () => {
    if (!input.value.trim()) input.value = defaultProjectName;
    commit();
  });
  reset.addEventListener("click", () => {
    input.value = defaultProjectName;
    commit();
    input.focus();
  });
}

setupProjectName();

function selectAgent(agent, persist = false) {
  if (!["codex", "claude", "openrouter"].includes(agent)) return;
  const workspaceApp = agent === "antigravity" ? "Antigravity IDE" : "VS Code";
  for (const element of document.querySelectorAll("[data-antigravity-only]")) element.hidden = agent !== "antigravity";
  for (const element of document.querySelectorAll("[data-antigravity-hide]")) element.hidden = agent === "antigravity";
  for (const label of document.querySelectorAll("[data-workspace-app]")) label.textContent = workspaceApp;
  for (const label of document.querySelectorAll("[data-workspace-open-command]")) label.textContent = agent === "antigravity" ? "agy-ide ." : "code .";
  const agentPanel = { codex: "Codex panel", claude: "Claude Code panel", openrouter: "Cline panel", antigravity: "Antigravity Agent panel" }[agent];
  for (const label of document.querySelectorAll("[data-agent-panel]")) label.textContent = agentPanel;
  renderWorkspaceState(savedProjectName(), agent);
  const loginSteps = document.querySelector("[data-login-steps]");
  if (loginSteps) {
    const steps = {
      codex: [
        ["เปิด Codex panel", "คลิกไอคอน Codex ในแถบด้านข้างของ VS Code"],
        ["เลือก Sign in with ChatGPT", "กดปุ่ม Sign in แล้วเลือกใช้บัญชี ChatGPT"],
        ["ยืนยันใน Browser", "ลงชื่อเข้าใช้บัญชีของตนเอง อนุญาตการเชื่อมต่อ แล้วกลับมาที่ VS Code"]
      ],
      claude: [
        ["เปิด Claude Code panel", "คลิกไอคอน Claude ในแถบด้านข้างของ VS Code"],
        ["เริ่ม Sign in", "กด Sign in แล้วเลือก Claude App หากใช้บัญชี Claude Pro หรือ Max; ผู้ใช้ Anthropic Console ให้เลือก Console"],
        ["ยืนยันใน Browser", "ลงชื่อเข้าใช้ Claude.ai หรือ Anthropic Console ตามสิทธิ์ แล้วอนุญาตการเชื่อมต่อ"]
      ],
      openrouter: [
        ["เปิด Cline panel", "คลิกไอคอน Cline ใน VS Code แล้วเปิด Settings"],
        ["เลือก API Provider: OpenRouter", "สร้าง API key ในบัญชี OpenRouter แล้ววางในช่อง key ของ Cline โดยตรง"],
        ["เลือกโมเดลและตรวจบัญชี", "เลือกโมเดลที่ต้องการ ตรวจเครดิตและราคา จากนั้นเริ่มงานใน Workspace; ไม่ส่ง key ในช่องสนทนาหรือไฟล์งาน"]
      ],
      antigravity: [
        ["เปิด Antigravity IDE", "ที่ Welcome screen กด Sign in"],
        ["เลือกบัญชี Google", "ลงชื่อเข้าใช้ด้วยบัญชี Gmail ส่วนบุคคลของตนเองใน Browser"],
        ["ตั้งค่าครั้งแรก", "กลับเข้า IDE เลือก Theme และเลือก Review-driven development เมื่อระบบถามนโยบายการทำงานของ Agent"]
      ]
    };
    loginSteps.innerHTML = steps[agent].map(([title, detail], index) => {
      return `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${title}</strong><br>${detail}</div></li>`;
    }).join("");
  }
  const loginSource = document.querySelector("[data-login-source]");
  if (loginSource) {
    const sources = {
      codex: ["คู่มือ Codex ของ OpenAI", "https://developers.openai.com/codex/"],
      claude: ["คู่มือเริ่มต้น Claude Code ของ Anthropic", "https://docs.anthropic.com/en/docs/claude-code/getting-started"],
      openrouter: ["คู่มือ Cline กับ OpenRouter", "https://openrouter.ai/works-with-openrouter/cline"],
      antigravity: ["คู่มือเริ่มต้น Antigravity IDE ของ Google", "https://codelabs.developers.google.com/getting-started-agy-ide?hl=th"]
    };
    loginSource.textContent = sources[agent][0];
    loginSource.href = sources[agent][1];
  }
  for (const section of agentRequiredSections) section.hidden = false;
  if (agentGateStatus) agentGateStatus.innerHTML = '<strong>เลือกแล้ว:</strong> ขั้นตอนถัดไปใช้ Workspace และ AI panel ที่ตรงกับบัญชี';
  if (persist) setPreference("ai-research-agent", agent);
}
if (agentInputs.length) {
  for (const section of agentRequiredSections) section.hidden = true;
  const savedValue = getPreference("ai-research-agent");
  const saved = ["codex", "claude", "openrouter"].includes(savedValue) ? savedValue : null;
  if (saved) {
    const selected = agentInputs.find((input) => input.value === saved);
    if (selected) {
      selected.checked = true;
      selectAgent(saved);
    }
  }
  for (const input of agentInputs) input.addEventListener("change", () => selectAgent(input.value, true));
}

function setupMarkdownDownloads() {
  const links = [...document.querySelectorAll('a[href$=".md"]')];
  if (!links.length) return;

  const dialog = document.createElement("dialog");
  dialog.className = "workspace-save-dialog";
  dialog.innerHTML = `
    <form method="dialog">
      <p class="eyebrow">ก่อนดาวน์โหลดไฟล์ Markdown</p>
      <h2>จะบันทึกไฟล์ไว้ที่ไหน?</h2>
      <p>แนะนำให้บันทึกไว้ใน <strong>project workspace</strong> ของงานวิจัยนี้ เพื่อให้ไฟล์อยู่กับข้อมูล หลักฐาน และผลลัพธ์ของโครงการ ไม่หลงอยู่ในโฟลเดอร์ Downloads</p>
      <div class="workspace-save-path"><span>ตำแหน่งที่แนะนำ</span><code>project workspace/</code></div>
      <p class="workspace-save-fallback" hidden>เบราว์เซอร์นี้เลือกตำแหน่งก่อนดาวน์โหลดไม่ได้ ไฟล์จะไปที่ Downloads ตามค่าของเบราว์เซอร์ กรุณาย้ายไฟล์เข้า project workspace ก่อนเริ่มทำงาน</p>
      <p class="workspace-save-status" aria-live="polite"></p>
      <div class="workspace-save-actions">
        <button class="button primary" type="button" data-workspace-save>เลือกตำแหน่งและบันทึก</button>
        <a class="button secondary" target="_blank" rel="noopener" data-workspace-open>เปิดดูก่อน</a>
        <button class="button secondary" value="cancel">ยกเลิก</button>
      </div>
    </form>`;
  document.body.append(dialog);

  const saveButton = dialog.querySelector("[data-workspace-save]");
  const openLink = dialog.querySelector("[data-workspace-open]");
  const fallback = dialog.querySelector(".workspace-save-fallback");
  const status = dialog.querySelector(".workspace-save-status");
  let activeLink = null;

  if (!("showSaveFilePicker" in window)) {
    saveButton.textContent = "ดาวน์โหลด แล้วนำไปไว้ใน workspace";
    fallback.hidden = false;
  }

  for (const link of links) {
    link.dataset.workspaceDownload = "";
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      activeLink = link;
      openLink.href = link.href;
      status.textContent = "";
      dialog.showModal();
    });
  }

  saveButton.addEventListener("click", async () => {
    if (!activeLink) return;
    const url = new URL(activeLink.href, location.href);
    const suggestedName = decodeURIComponent(url.pathname.split("/").pop() || "research-note.md");
    try {
      if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ (${response.status})`);
        const writable = await handle.createWritable();
        await writable.write(await response.blob());
        await writable.close();
        status.textContent = `บันทึก ${suggestedName} แล้ว`;
        saveButton.focus();
        return;
      }
      const download = document.createElement("a");
      download.href = url.href;
      download.download = suggestedName;
      document.body.append(download);
      download.click();
      download.remove();
      status.textContent = "ดาวน์โหลดแล้ว—อย่าลืมนำไฟล์ไปไว้ใน project workspace";
    } catch (error) {
      if (error.name !== "AbortError") status.textContent = error.message || "ยังบันทึกไฟล์ไม่ได้ กรุณาลองอีกครั้ง";
    }
  });
}

setupMarkdownDownloads();
