const initialMarkdown = `# ความหิวก่อนและความอิ่มหลังอาหาร: เคสฝึกสำหรับนิสิตและนักวิจัยมือใหม่

ผู้เขียนตัวอย่าง

**สังกัด:** หลักสูตร AI เพื่อการวิจัย · **ผู้ประสานงาน:** researcher@example.org

## บทคัดย่อ

เคสสมมติสำหรับนิสิตและนักวิจัยมือใหม่นี้ใช้แสดงการสร้างเอกสารจาก Markdown ไม่ใช่ผลวิจัยจริง ผู้ตอบ 30 คนมีคะแนนความหิวก่อนอาหารเฉลี่ย 7.2 และคะแนนความอิ่มหลังอาหารเฉลี่ย 8.1 บนมาตรา 0–10 ข้อมูลไม่เพียงพอสำหรับสรุปว่าอาหารเป็นสาเหตุของความเปลี่ยนแปลง

**คำสำคัญ:** ความหิว · ความอิ่ม · การวัดผล · กรณีตัวอย่าง

## 1. ที่มาและคำถาม

คำถามคือ คะแนนความอิ่มหลังอาหารสูงกว่าคะแนนความหิวก่อนอาหารหรือไม่ จุดสำคัญคือ “กิน” เป็นวิธี ส่วน “อิ่ม” เป็นผลที่ต้องวัด จึงห้ามใช้เพียงการได้รับอาหารแทนผลลัพธ์

## 2. วิธี

ผู้ตอบ 30 คนตอบครบทั้งสองคำถาม คะแนน 0 หมายถึงไม่รู้สึกเลย และ 10 หมายถึงรู้สึกมากที่สุด ข้อมูลทั้งหมดเป็นข้อมูลสมมติสำหรับการเรียน

## 3. ผล

| ตัวแปร | จำนวน | ค่าเฉลี่ย | ส่วนเบี่ยงเบนมาตรฐาน |
|---|---:|---:|---:|
| ความหิวก่อนอาหาร | 30 | 7.2 | 1.4 |
| ความอิ่มหลังอาหาร | 30 | 8.1 | 1.1 |

## 4. ข้อจำกัด

กรณีนี้ไม่มีข้อมูลรายบุคคล ไม่มีกลุ่มเปรียบเทียบ และไม่มีหลักฐานรองรับข้อสรุปเชิงเหตุและผล

## เอกสารอ้างอิง

[ต้องเพิ่มเอกสารอ้างอิงที่ตรวจแล้ว]`;

const source = document.querySelector("[data-markdown-source]");
const preview = document.querySelector("[data-preview]");
const paper = document.querySelector("[data-paper]");
const templateName = document.querySelector("[data-template-name]");

function escapeHtml(value) { return value.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function inline(value) { return escapeHtml(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>"); }
function renderMarkdown(markdown) {
  const documentData = { title: "ไม่มีชื่อเรื่อง", authors: "", affiliation: "", abstract: [], keywords: "", sections: [] };
  let currentSection = null;
  let preambleLine = 0;
  let tableRows = [];

  const flushTable = () => {
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
      currentSection = { heading, blocks: [], abstract: /บทคัดย่อ|abstract/i.test(heading) };
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
    flushTable();
    currentSection.blocks.push({ type: "paragraph", text: line });
  }
  flushTable();

  const abstractSection = documentData.sections.find(section => section.abstract);
  const bodySections = documentData.sections.filter(section => !section.abstract);
  const renderBlock = block => {
    if (block.type === "paragraph") return `<p>${inline(block.text)}</p>`;
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
    <div class="paper-body">${bodyHtml}</div>`;
}
function selectTemplate(name) {
  paper.classList.toggle("springer",name==="springer"); paper.classList.toggle("ieee",name==="ieee");
  templateName.textContent=name==="springer"?"Springer":"IEEE";
  document.querySelector("[data-publication-name]").textContent=name==="springer"?"Springer Nature":"IEEE";
  document.querySelector("[data-publication-series]").textContent=name==="springer"?"Research Article · Review Manuscript":"Transactions · Manuscript for Review";
  document.querySelector("[data-paper-mark]").textContent=name==="springer"?"SN":"IEEE";
  document.querySelector("[data-footer-code]").textContent=name==="springer"?"SN-M8-2026":"IEEE-M8-2026";
  document.querySelectorAll("[data-template]").forEach(button=>{ const active=button.dataset.template===name; button.setAttribute("aria-pressed",String(active)); button.classList.toggle("primary",active); button.classList.toggle("secondary",!active); });
}
source.value=initialMarkdown; renderMarkdown(initialMarkdown);
source.addEventListener("input",()=>renderMarkdown(source.value));
document.querySelectorAll("[data-template]").forEach(button=>button.addEventListener("click",()=>selectTemplate(button.dataset.template)));
document.querySelector("[data-reset]").addEventListener("click",()=>{ source.value=initialMarkdown; renderMarkdown(initialMarkdown); });
document.querySelector("[data-print]").addEventListener("click",()=>window.print());
