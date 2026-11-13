const initialMarkdown = `# ความหิวก่อนและความอิ่มหลังอาหาร: เคสฝึกสำหรับนิสิตและนักวิจัยมือใหม่

ผู้เขียนตัวอย่าง

**สังกัด:** หลักสูตร AI เพื่อการวิจัย · **ผู้ประสานงาน:** researcher@example.org

## บทคัดย่อ

เคสสมมติสำหรับนิสิตและนักวิจัยมือใหม่นี้ใช้แสดงการสร้างเอกสารจาก Markdown ไม่ใช่ผลวิจัยจริง ผู้ตอบ 30 คนมีคะแนนความหิวก่อนอาหารเฉลี่ย 7.2 และคะแนนความอิ่มหลังอาหารเฉลี่ย 8.1 บนมาตรา 0–10 ข้อมูลไม่เพียงพอสำหรับสรุปว่าอาหารเป็นสาเหตุของความเปลี่ยนแปลง

**คำสำคัญ:** ความหิว · ความอิ่ม · การวัดผล · กรณีตัวอย่าง

## ไฮไลต์

- คะแนนความอิ่มหลังอาหารเฉลี่ย 8.1 สูงกว่าคะแนนความหิวก่อนอาหารเฉลี่ย 7.2
- ผู้ตอบ 30 คนตอบครบทั้งสองคำถามบนมาตรา 0–10
- ไม่มีกลุ่มเปรียบเทียบ จึงยังสรุปเหตุและผลไม่ได้

## 1. ที่มาและคำถาม

คำถามคือ คะแนนความอิ่มหลังอาหารสูงกว่าคะแนนความหิวก่อนอาหารหรือไม่ จุดสำคัญคือ “กิน” เป็นวิธี ส่วน “อิ่ม” เป็นผลที่ต้องวัด จึงห้ามใช้เพียงการได้รับอาหารแทนผลลัพธ์

## 2. วิธี

ผู้ตอบ 30 คนตอบครบทั้งสองคำถาม คะแนน 0 หมายถึงไม่รู้สึกเลย และ 10 หมายถึงรู้สึกมากที่สุด ข้อมูลทั้งหมดเป็นข้อมูลสมมติสำหรับการเรียน

## 3. ผล

| ตัวแปร | จำนวน | ค่าเฉลี่ย | ส่วนเบี่ยงเบนมาตรฐาน |
|---|---:|---:|---:|
| ความหิวก่อนอาหาร | 30 | 7.2 | 1.4 |
| ความอิ่มหลังอาหาร | 30 | 8.1 | 1.1 |

![ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานของคะแนนทั้งสอง](assets/images/module-8-hunger-satiety.svg "คะแนนความหิวก่อนอาหารและความอิ่มหลังอาหาร (ค่าเฉลี่ย ± SD, n = 30, ข้อมูลสมมติ)")

## 4. ข้อจำกัด

กรณีนี้ไม่มีข้อมูลรายบุคคล ไม่มีกลุ่มเปรียบเทียบ และไม่มีหลักฐานรองรับข้อสรุปเชิงเหตุและผล

## เอกสารอ้างอิง

[ต้องเพิ่มเอกสารอ้างอิงที่ตรวจแล้ว]`;

const source = document.querySelector("[data-markdown-source]");
const preview = document.querySelector("[data-preview]");
const paper = document.querySelector("[data-paper]");
const templateName = document.querySelector("[data-template-name]");

function escapeHtml(value) { return value.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
// Only web (http/https) or relative image paths; anything else is ignored.
function safeImageUrl(url) { return /^(https?:\/\/|[\w./-]+$)/i.test(url) && !/^javascript:/i.test(url) ? url : ""; }
function inline(value) { return escapeHtml(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>"); }
function renderMarkdown(markdown) {
  const documentData = { title: "ไม่มีชื่อเรื่อง", authors: "", affiliation: "", abstract: [], keywords: "", sections: [] };
  let currentSection = null;
  let preambleLine = 0;
  let tableRows = [];
  let listItems = [];

  const flushTable = () => {
    if (listItems.length && currentSection) { currentSection.blocks.push({ type: "list", items: listItems }); listItems = []; }
    if (!tableRows.length || !currentSection) return;
    currentSection.blocks.push({ type: "table", rows: tableRows });
    tableRows = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { flushTable(); continue; }
    if (line.startsWith("# ")) { documentData.title = line.slice(2); continue; }
    if (line.startsWith("## ")) {
      flushTable();
      const heading = line.slice(3);
      currentSection = { heading, blocks: [], abstract: /บทคัดย่อ|abstract/i.test(heading), highlights: /ไฮไลต์|highlights/i.test(heading) };
      documentData.sections.push(currentSection);
      continue;
    }
    if (!currentSection) {
      if (preambleLine === 0) documentData.authors = line;
      else documentData.affiliation += `${documentData.affiliation ? " " : ""}${line}`;
      preambleLine += 1;
      continue;
    }
    if (/^\*\*คำสำคัญ:|^\*\*keywords?:/i.test(line)) { documentData.keywords = line; continue; }
    if (line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map(value => value.trim());
      if (!cells.every(value => /^:?-{3,}:?$/.test(value))) tableRows.push(cells);
      continue;
    }
    if (/^[-*]\s+/.test(line)) { listItems.push(line.replace(/^[-*]\s+/, "")); continue; }
    flushTable();
    const image = line.match(/^!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)$/);
    if (image) { currentSection.blocks.push({ type: "figure", alt: image[1], src: image[2], caption: image[3] || image[1] }); continue; }
    currentSection.blocks.push({ type: "paragraph", text: line });
  }
  flushTable();

  const abstractSection = documentData.sections.find(section => section.abstract);
  const highlightSection = documentData.sections.find(section => section.highlights);
  const bodySections = documentData.sections.filter(section => !section.abstract && !section.highlights);
  let figureNumber = 0;
  const renderBlock = block => {
    if (block.type === "paragraph") return `<p>${inline(block.text)}</p>`;
    if (block.type === "list") return `<ul>${block.items.map(item => `<li>${inline(item)}</li>`).join("")}</ul>`;
    if (block.type === "figure") {
      const src = safeImageUrl(block.src);
      figureNumber += 1;
      return `<figure class="paper-figure">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" loading="lazy">` : `<p class="figure-missing">ที่อยู่รูปภาพใช้ไม่ได้</p>`}<figcaption><strong>รูปที่ ${figureNumber}</strong> ${inline(block.caption)}</figcaption></figure>`;
    }
    const rows = block.rows.map((cells, rowIndex) => {
      const tag = rowIndex === 0 ? "th" : "td";
      return `<tr>${cells.map(value => `<${tag}>${inline(value)}</${tag}>`).join("")}</tr>`;
    }).join("");
    return `<div class="table-wrap"><table><tbody>${rows}</tbody></table></div>`;
  };
  const abstractHtml = abstractSection ? abstractSection.blocks.map(renderBlock).join("") : "<p>ยังไม่มีบทคัดย่อ</p>";
  const bodyHtml = bodySections.map(section => `<section class="paper-section"><h2>${inline(section.heading)}</h2>${section.blocks.map(renderBlock).join("")}</section>`).join("");

  preview.innerHTML = `<h1>${inline(documentData.title)}</h1>
    <p class="authors">${inline(documentData.authors)}</p>
    <p class="affiliation">${inline(documentData.affiliation)}</p>
    <section class="abstract"><h2>${inline(abstractSection?.heading || "บทคัดย่อ")}</h2>${abstractHtml}</section>
    ${documentData.keywords ? `<p class="keywords">${inline(documentData.keywords)}</p>` : ""}
    ${highlightSection ? `<section class="highlights"><h2>${inline(highlightSection.heading)}</h2>${highlightSection.blocks.map(renderBlock).join("")}</section>` : ""}
    <div class="paper-body">${bodyHtml}</div>`;
}
const TEMPLATES = {
  springer: { label: "Springer", publication: "Springer Nature", series: "Research Article · Review Manuscript", mark: "SN", footer: "SN-M8-2026" },
  ieee: { label: "IEEE", publication: "IEEE", series: "Transactions · Manuscript for Review", mark: "IEEE", footer: "IEEE-M8-2026" },
  elsevier: { label: "Elsevier", publication: "Elsevier", series: "Journal Article · Preprint submitted for review", mark: "ELS", footer: "Preprint submitted to Elsevier · ELS-M8-2026" },
};
function selectTemplate(name) {
  const t = TEMPLATES[name] || TEMPLATES.springer;
  Object.keys(TEMPLATES).forEach(key => paper.classList.toggle(key, key === name));
  templateName.textContent = t.label;
  document.querySelector("[data-publication-name]").textContent = t.publication;
  document.querySelector("[data-publication-series]").textContent = t.series;
  document.querySelector("[data-paper-mark]").textContent = t.mark;
  document.querySelector("[data-footer-code]").textContent = t.footer;
  document.querySelectorAll("[data-template]").forEach(button=>{ const active=button.dataset.template===name; button.setAttribute("aria-pressed",String(active)); button.classList.toggle("primary",active); button.classList.toggle("secondary",!active); });
}
source.value=initialMarkdown; renderMarkdown(initialMarkdown);
source.addEventListener("input",()=>renderMarkdown(source.value));
document.querySelectorAll("[data-template]").forEach(button=>button.addEventListener("click",()=>selectTemplate(button.dataset.template)));
document.querySelector("[data-reset]").addEventListener("click",()=>{ source.value=initialMarkdown; renderMarkdown(initialMarkdown); });
document.querySelector("[data-print]").addEventListener("click",()=>window.print());
