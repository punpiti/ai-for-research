# AI for Research workspace

- Treat `content.md` as the editable source of truth.
- Put generated files in `output/`; do not replace the source unless asked.
- Keep untouched source documents in `input/original/` and derived Markdown in `input/markdown/`.
- Before analyzing documents, run `tools/import-documents.ps1` on Windows or `tools/import-documents.sh` on macOS/Linux when Markdown copies are missing.
- OCR uses Thai and English. Treat OCR text as a draft: preserve the source filename and identify passages that need comparison with the original.
- Never delete or overwrite files in `input/original/`.
- When the user asks for a PDF, run:

  ```text
  pandoc content.md --defaults templates/modern-thai.yaml -o output/content.pdf
  ```

- Run that exact `pandoc` build once; do not split it into repeated exploratory shell commands.
- Read `tools/runtime-env.json` for the machine-local tool root. Load `tools/runtime-env.sh` (macOS/Linux) or `tools/runtime-env.ps1` (Windows) before installing or running tools when environment variables are missing.
- Python 3.12 and user-owned TinyTeX are installed during setup. Install task-required Python libraries with `uv pip install --python <research-environment-python> <packages>` and TeX packages with the course TinyTeX `tlmgr install <packages>`. Use the explicit interpreter/environment path from the runtime receipt, which records the verified Python executable and package versions. Run analysis with that Python. Record added packages and versions.
- The learner authorizes downloads and installation of task-required libraries/packages into the course tool root. Proceed without requesting repeated permission for those actions. Keep environments and caches in the machine-local course tool root, separate from research files. Do not use sudo, Administrator, system pip, system tlmgr, or a workspace `.venv`.
- Codex uses workspace-scoped network access and a writable course tool root. If tools are blocked, report the actual error and check that the workspace is trusted and a fresh session loaded `.codex/config.toml`; do not try to bypass organization policy. Existing configs are preserved by setup.
- Claude has workspace-scoped allows for uv/tlmgr/pandoc/xelatex; Antigravity terminal policy is configured in its IDE. Other commands may still require the IDE's own permission.
- The PDF baseline is A4, XeLaTeX, and the bundled Google Fonts `Sarabun` files under `templates/fonts/`; do not depend on system font discovery.
- Keep the modern blue/teal template unless the user requests another design.
- Do not ask the learner to edit generated LaTeX.
- After building, use the IDE file explorer to confirm that `output/content.pdf` exists and is non-empty. Do not run extra terminal commands merely to restate what the tool output and file explorer already show. Report the real build error if PDF generation fails.
