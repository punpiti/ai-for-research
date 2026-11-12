#!/usr/bin/env python3
"""Install the standalone Module 8 journal-first LaTeX workspace."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import urllib.request


MANIFEST_URL = "https://urban.cpe.ku.ac.th/ai-for-research/downloads/course-materials-module-08.json"
ALLOWED_URL_PREFIX = "https://urban.cpe.ku.ac.th/ai-for-research/downloads/"
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 48 * 1024 * 1024


def log(message: str) -> None:
    print(f"[AI for Research · Module 8] {message}", flush=True)


def safe_workspace(value: Path) -> Path:
    workspace = value.expanduser().resolve()
    if workspace == Path(workspace.anchor) or workspace == Path.home().resolve():
        raise RuntimeError("Workspace must be a project folder, not the home or filesystem root.")
    workspace.mkdir(parents=True, exist_ok=True)
    return workspace


def read_manifest(url: str, allowed_prefix: str) -> dict:
    if not url.startswith(allowed_prefix):
        raise RuntimeError("Manifest URL is outside the approved course download root.")
    with urllib.request.urlopen(url, timeout=30) as response:
        if not response.geturl().startswith(allowed_prefix):
            raise RuntimeError("Manifest redirected outside the approved course download root.")
        payload = response.read(128 * 1024 + 1)
    if len(payload) > 128 * 1024:
        raise RuntimeError("Manifest is too large.")
    manifest = json.loads(payload.decode("utf-8"))
    if (
        not isinstance(manifest, dict)
        or manifest.get("schema_version") != "ai-for-research.course-materials.v1"
        or manifest.get("module_id") != "module-08"
    ):
        raise RuntimeError("Manifest is not a supported Module 8 manifest.")
    files = manifest.get("files")
    if not isinstance(files, list) or not 1 <= len(files) <= 32:
        raise RuntimeError("Manifest file list is invalid.")
    if sum(item.get("bytes", MAX_TOTAL_BYTES + 1) for item in files if isinstance(item, dict)) > MAX_TOTAL_BYTES:
        raise RuntimeError("Manifest exceeds the Module 8 download limit.")
    return manifest


def verified_download(item: dict, target: Path, allowed_prefix: str) -> None:
    if set(item) != {"url", "path", "sha256", "bytes"}:
        raise RuntimeError("Manifest entry has unexpected fields.")
    url = item["url"]
    expected_hash = item["sha256"]
    expected_bytes = item["bytes"]
    if not isinstance(url, str) or not url.startswith(allowed_prefix):
        raise RuntimeError("Material URL is outside the approved course download root.")
    if (
        not isinstance(expected_hash, str)
        or len(expected_hash) != 64
        or any(character not in "0123456789abcdef" for character in expected_hash)
    ):
        raise RuntimeError("Material SHA-256 is invalid.")
    if not isinstance(expected_bytes, int) or not 0 < expected_bytes <= MAX_FILE_BYTES:
        raise RuntimeError("Material size is invalid.")

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + ".download")
    digest = hashlib.sha256()
    total = 0
    try:
        with urllib.request.urlopen(url, timeout=60) as response, temporary.open("wb") as stream:
            if not response.geturl().startswith(allowed_prefix):
                raise RuntimeError("Material redirected outside the approved course download root.")
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > expected_bytes or total > MAX_FILE_BYTES:
                    raise RuntimeError("Material download exceeded its manifest size.")
                digest.update(chunk)
                stream.write(chunk)
        if total != expected_bytes or digest.hexdigest() != expected_hash:
            raise RuntimeError("Material failed its size/SHA-256 check.")
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def install_materials(workspace: Path, manifest: dict, allowed_prefix: str) -> tuple[int, int, int]:
    module_root = (workspace / "course-materials/module-08").resolve()
    update_root = (workspace / ".course-updates/course-materials/module-08").resolve()
    installed = reused = updates = 0
    seen: set[Path] = set()
    receipt_files = []
    expected_prefix = Path("course-materials/module-08")
    prefix_length = len(expected_prefix.parts)

    for item in manifest["files"]:
        if not isinstance(item, dict):
            raise RuntimeError("Manifest entry is invalid.")
        relative = Path(str(item.get("path", "")))
        if relative.is_absolute() or ".." in relative.parts or relative.parts[:prefix_length] != expected_prefix.parts:
            raise RuntimeError("Material destination is unsafe.")
        within_module = Path(*relative.parts[prefix_length:])
        if not within_module.parts or within_module in seen:
            raise RuntimeError("Manifest contains an empty or duplicate destination.")
        seen.add(within_module)
        destination = (module_root / within_module).resolve()
        if module_root not in destination.parents:
            raise RuntimeError("Material destination escaped the Module 8 folder.")

        expected_hash = item.get("sha256")
        if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected_hash:
            status = "reused"
            reused += 1
        elif destination.exists():
            destination = (update_root / within_module).resolve()
            if update_root not in destination.parents:
                raise RuntimeError("Update destination escaped the Module 8 update folder.")
            if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected_hash:
                status = "update-reused"
            else:
                verified_download(item, destination, allowed_prefix)
                status = "update-downloaded"
            updates += 1
        else:
            verified_download(item, destination, allowed_prefix)
            status = "installed"
            installed += 1
        receipt_files.append({"path": str(destination.relative_to(workspace)), "status": status, "sha256": expected_hash})

    receipt = {
        "schema_version": "ai-for-research.module-08-install.v1",
        "manifest_url": MANIFEST_URL,
        "files": receipt_files,
    }
    receipt_path = workspace / "course-materials/module-08/install-receipt.json"
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return installed, reused, updates


def copy_if_missing(source: Path, target: Path) -> bool:
    if target.exists():
        return False
    if not source.is_file():
        raise RuntimeError(f"Required course file is missing: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return True


def prepare_work_area(workspace: Path) -> tuple[Path, str, int]:
    materials = workspace / "course-materials/module-08"
    work = workspace / "module-08-work"
    for folder in (
        "input/module-07-figures",
        "journal-dossiers/journal-a/original",
        "journal-dossiers/journal-b/original",
        "literature",
        "source",
        "figures",
        "generated",
        "build",
        "submission",
    ):
        (work / folder).mkdir(parents=True, exist_ok=True)

    copy_if_missing(materials / "data/mock-study-data.csv", work / "input/mock-study-data.csv")
    copy_if_missing(materials / "evidence/analysis-summary.csv", work / "input/analysis-summary.csv")
    copy_if_missing(materials / "journal-dossiers/journal-a-profile.md", work / "journal-dossiers/journal-a/original/profile.md")
    copy_if_missing(materials / "journal-dossiers/journal-b-profile.md", work / "journal-dossiers/journal-b/original/profile.md")
    copy_if_missing(materials / "literature/references.bib", work / "literature/references.bib")
    copy_if_missing(materials / "templates/manuscript-starter.md", work / "source/manuscript.md")
    copy_if_missing(materials / "templates/submission-readiness-template.md", work / "submission/submission-readiness.md")
    copy_if_missing(materials / "templates/venue-change-impact-template.md", work / "submission/venue-change-impact.md")
    copy_if_missing(materials / "figures/pm25-before-after.png", work / "figures/pm25-before-after.png")

    module7_highlights = workspace / "module-07-work/module-07-highlights.md"
    if module7_highlights.is_file():
        copy_if_missing(module7_highlights, work / "input/module-07-highlights.md")
        route = "continued-from-module-07"
    else:
        copy_if_missing(materials / "evidence/module-07-highlights-example.md", work / "input/module-07-highlights.md")
        route = "standalone-example"

    copied_figures = 0
    module7_figures = workspace / "module-07-work/figures"
    if module7_figures.is_dir():
        for source in sorted(module7_figures.iterdir()):
            if source.is_file() and source.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                target = work / "input/module-07-figures" / source.name
                if copy_if_missing(source, target):
                    copied_figures += 1

    blank_files = {
        work / "literature/bibliography-audit.md": "# Bibliography Audit\n\n| Citation key | Metadata | Abstract source | Status / action |\n|---|---|---|---|\n",
        work / "literature/literature-map.md": "# Literature Map\n\n| Citation key | Problem/context | Method | Finding | Limitation |\n|---|---|---|---|---|\n",
        work / "literature/candidate-gap.md": "# Candidate Research Gap\n\n## Observed in corpus\n\n## Candidate gap\n\n## Counterevidence\n\n## Search needed\n",
    }
    for path, content in blank_files.items():
        if not path.exists():
            path.write_text(content, encoding="utf-8")

    guide = work / "README-FIRST.md"
    if not guide.exists():
        guide.write_text(
            "# Module 8 Work Area\n\n"
            f"Install route: `{route}`\n\n"
            "1. อ่าน `input/` เพื่อรู้ว่าข้อมูล ผล และกราฟมาจากไหน\n"
            "2. เลือกวารสารจาก `journal-dossiers/` แล้วบันทึก fit decision\n"
            "3. ตรวจ `literature/references.bib` และเติม audit/map/candidate gap\n"
            "4. แก้เนื้อหาที่ `source/manuscript.md` ซึ่งเป็น source of truth\n"
            "5. ให้ AI สร้าง `generated/main.tex` แล้ว build ไปที่ `build/manuscript.pdf`\n"
            "6. ตรวจ `submission/submission-readiness.md` ก่อนตัดสินว่าส่งได้หรือยัง\n"
            "7. เมื่อลอง Journal B ให้กรอก `submission/venue-change-impact.md` และสร้าง output ชุดใหม่\n\n"
            "ห้ามแก้ไฟล์ต้นฉบับใต้ `course-materials/module-08/` และห้ามแก้ Markdown กับ generated LaTeX เป็นสองต้นฉบับคู่กัน\n",
            encoding="utf-8",
        )
    return work, route, copied_figures


def write_build_launchers(workspace: Path) -> None:
    tools = workspace / "tools"
    tools.mkdir(parents=True, exist_ok=True)
    shell = tools / "build-module-08.sh"
    powershell = tools / "build-module-08.ps1"
    shell.write_text(
        "#!/usr/bin/env bash\nset -euo pipefail\n"
        "workspace=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")/..\" && pwd)\"\n"
        "cd \"$workspace/module-08-work\"\n"
        "test -f generated/main.tex || { echo 'Missing generated/main.tex — ask AI to generate it from source/manuscript.md first.' >&2; exit 1; }\n"
        "mkdir -p build\nlatexmk -xelatex -bibtex -interaction=nonstopmode -halt-on-error -outdir=build generated/main.tex\n",
        encoding="utf-8",
    )
    shell.chmod(0o755)
    powershell.write_text(
        "$ErrorActionPreference = 'Stop'\n"
        "$workspace = Split-Path -Parent $PSScriptRoot\n"
        "$work = Join-Path $workspace 'module-08-work'\n"
        "$main = Join-Path $work 'generated/main.tex'\n"
        "if (-not (Test-Path -LiteralPath $main -PathType Leaf)) { throw 'Missing generated/main.tex - ask AI to generate it from source/manuscript.md first.' }\n"
        "New-Item -ItemType Directory -Force -Path (Join-Path $work 'build') | Out-Null\n"
        "Set-Location $work\nlatexmk -xelatex -bibtex -interaction=nonstopmode -halt-on-error -outdir=build generated/main.tex\n",
        encoding="utf-8-sig",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--manifest-url", default=MANIFEST_URL)
    parser.add_argument("--allowed-url-prefix", default=ALLOWED_URL_PREFIX)
    args = parser.parse_args()

    workspace = safe_workspace(args.workspace)
    log(f"Workspace: {workspace}")
    manifest = read_manifest(args.manifest_url, args.allowed_url_prefix)
    installed, reused, updates = install_materials(workspace, manifest, args.allowed_url_prefix)
    log(f"Materials ready: installed={installed}, reused={reused}, updates={updates}")
    work, route, copied_figures = prepare_work_area(workspace)
    write_build_launchers(workspace)
    log(f"Learner work area: {work}")
    log(f"Learning route: {route}; Module 7 figures copied={copied_figures}")

    tools = {name: bool(shutil.which(name)) for name in ("pandoc", "xelatex", "latexmk", "latexdiff")}
    ready = ", ".join(f"{name}={'ready' if found else 'missing'}" for name, found in tools.items())
    log(f"Document tools: {ready}")
    if not tools["latexmk"] or not tools["xelatex"]:
        log("Build tools are missing. Run the Module 1 course setup before building the PDF.")
    log("FINAL_RESULT PASS")
    log(f"Open this folder in VS Code: {workspace}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log(f"FINAL_RESULT FAIL — {error}")
        sys.exit(1)
