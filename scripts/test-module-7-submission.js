const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const siteRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(siteRoot, "assets/module-7-submission.js"), "utf8");
const context = { document: { querySelector: () => null }, TextEncoder, console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context);

const template = fs.readFileSync(path.join(siteRoot, "..", "documents", "ai-for-grad-students-syllabus", "examples", "module-07-figure-consistency", "figure-consistency-audit-template.md"), "utf8");
const completed = template
  .replaceAll("- [ ]", "- [x]")
  .replaceAll("| C01 | | | | | major/minor | |", `| C01 | Figure 1 + Table 1 | population differs across outputs | CSV n=120 versus n=80 | changes overall claim | major | use one population |`)
  .replaceAll("| C02 | | | | | major/minor | |", `| C02 | Figure 1 + Figure 2 | color meaning changes | legend inspection | reverses comparison | major | lock palette |`)
  .replaceAll("| C03 | | | | | major/minor | |", `| C03 | Figure 3 + caption | sign is reversed | recomputed change | labels worsening as improvement | major | correct sign |`)
  .replaceAll("| C04 | | | | | major/minor | |", `| C04 | Figure 4 + Methods | South is omitted | site count check | hides heterogeneity | major | include South |`)
  .replaceAll("| C05 | | | | | major/minor | |", `| C05 | Figure 2 panels | axes differ | compare limits | exaggerates slopes | major | share scale |`)
  .replaceAll("| C06 | | | | | major/minor | |", `| C06 | Results + CSV | all sites claim is false | South rises | invalid generalization | major | report heterogeneity |`)
  + "\n" + "หลักฐานและคำอธิบายเพิ่มเติม ".repeat(80);

assert.deepEqual(JSON.parse(JSON.stringify(context.module7SubmissionTestApi.validateMarkdown(completed))), { issueRows: 6, completedDeclarations: 5 });
assert.throws(() => context.module7SubmissionTestApi.validateMarkdown(completed.replace(/^\| C06 .*$/m, "")), /อย่างน้อย 6/);
assert.throws(() => context.module7SubmissionTestApi.validateMarkdown(completed.replaceAll("- [x]", "- [ ]")), /Final declaration/);
assert.throws(() => context.module7SubmissionTestApi.safeCode("bad code", "รหัสคลาส"), /3–40/);
console.log("module-7-submission validator: ok");
