# AI for Research workspace

- On every request, read `.ai/PROJECT_STATE.md` and `.ai/agent-project-kit/STARTUP.md`, then load only task-relevant files. This workspace contains the token-saving Markdown subset of Agent Project Kit, not the full kit.
- Default to `T1 Standard` with `C0 Economy`. Read `.ai/TOKEN_BUDGET.md` when cost is explicit or work may be expensive, and `.ai/agent-project-kit/TOKEN_DISCIPLINE.md` before a broad scan, large corpus, wide rewrite, or long agent/test loop.
- Reuse derived files in `input/markdown/` while originals are unchanged. Prefer an inventory and relevant subset before loading a large corpus, inspect only the relevant tail of long logs, and never scan the whole workspace merely because files exist.
- After meaningful work, compact `.ai/PROJECT_STATE.md` to 10–30 lines with the objective, completed work/evidence, blocker, next action, files touched, tests, and open decisions. Never store credentials, full chat transcripts, full logs, or copied source documents there.
- Keep answers compact unless detail is requested: outcome first, then risks and checks; summarize diffs instead of printing whole files. Never save cost by dropping evidence checks, tests, validation, or review gates.
- Treat `content.md` as the editable source of truth.
- Put generated files in `output/`; do not replace the source unless asked.
- Keep untouched source documents in `input/original/` and derived Markdown in `input/markdown/`.
- Before analyzing documents, run `tools/import-documents.ps1` on Windows or `tools/import-documents.sh` on macOS/Linux when Markdown copies are missing. DOCX/ODT/RTF/HTML import uses Pandoc. PPTX extraction retains slide order, titles, text, tables, speaker notes, and warnings for images/charts; XLSX extraction retains worksheet boundaries, cell values, and formulas. Those formats automatically install only `python-pptx` or `openpyxl` into the course Python environment at first use, then record the package versions in `tools/on-demand-packages.jsonl`. PDF import uses Poppler `pdftotext` for an existing text layer and falls back to Thai-English OCR only when usable text is absent. Generated Markdown always records the extraction method.
- OCR uses Thai and English. Treat OCR text as a draft: preserve the source filename and identify passages that need comparison with the original.
- Never delete or overwrite files in `input/original/`.
- When the user asks for a PDF, run:

  ```text
  pandoc content.md --defaults templates/modern-thai.yaml -o output/content.pdf
  ```

- Run that exact `pandoc` build once; do not split it into repeated exploratory shell commands.
- Read `tools/runtime-env.json` for the machine-local tool root. Load `tools/runtime-env.sh` (macOS/Linux) or `tools/runtime-env.ps1` (Windows) before installing or running tools when environment variables are missing.
- Python 3.12 and user-owned TinyTeX are installed during setup with only the packages needed for the first Markdown/PDF task. Before a later task, automatically install its smallest direct dependencies into the course environment: use `uv pip install --python <research-environment-python> <packages>` for Python and the course TinyTeX `tlmgr install <packages>` for TeX. This includes `python-pptx` or `openpyxl` for Office import; Requests for OpenAlex; pandas/pyreadstat and analysis/visualization libraries for data tasks; and latexmk, BibTeX/natbib, latexdiff, or Biber/BibLaTeX/csquotes when the selected venue workflow requires them. Do not ask the learner for repeated permission because setup already authorizes these user-owned course directories. Record added packages and versions. Never install into system Python or system TeX.
- The learner authorizes downloads and installation of task-required libraries/packages into the course tool root. Proceed without requesting repeated permission for those actions. Keep environments and caches in the machine-local course tool root, separate from research files. Do not use sudo, Administrator, system pip, system tlmgr, or a workspace `.venv`.
- Codex uses workspace-scoped network access and a writable course tool root. If tools are blocked, report the actual error and check that the workspace is trusted and a fresh session loaded `.codex/config.toml`; do not try to bypass organization policy. Existing configs are preserved by setup.
- Claude has workspace-scoped allows for uv, tlmgr, Pandoc, XeLaTeX, bibliography builds, latexmk, and latexdiff; Antigravity terminal policy is configured in its IDE. Other commands may still require the IDE's own permission.
- The PDF baseline is A4, XeLaTeX, and the bundled Google Fonts `Sarabun` files under `templates/fonts/`; do not depend on system font discovery.
- The normal body style is 10.5 pt. Let LaTeX scale headings and other named styles from that base; do not substitute TH Sarabun New, TH Sarabun PSK, or TH Sarabun IT9.
- For revision review, keep immutable old/new source snapshots and run `latexdiff old.tex new.tex > diff.tex`, then compile the marked-up copy. Treat `diff.tex` as a review artifact, not the manuscript source of truth.
- OpenAlex harvesting must be bounded and reproducible: define the query, filters, selected fields, and maximum records before running; use cursor paging with timeouts and backoff; save raw JSONL, a normalized candidate table, and a manifest. Never store an OpenAlex credential in source, URLs written to disk, outputs, or logs. Treat OpenAlex records as candidate metadata until DOI, official page, and full text checks pass. Use the OpenAlex snapshot instead of cursoring through the whole database.
- Keep the modern blue/teal template unless the user requests another design.
- Do not ask the learner to edit generated LaTeX.
- After building, use the IDE file explorer to confirm that `output/content.pdf` exists and is non-empty. Do not run extra terminal commands merely to restate what the tool output and file explorer already show. Report the real build error if PDF generation fails.
