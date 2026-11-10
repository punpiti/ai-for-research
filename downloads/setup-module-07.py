#!/usr/bin/env python3
"""Install the standalone Module 7 notebook lab into a learner workspace."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request


MANIFEST_URL = "https://urban.cpe.ku.ac.th/ai-for-research/downloads/course-materials.json"
ALLOWED_URL_PREFIX = "https://urban.cpe.ku.ac.th/ai-for-research/downloads/"
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024
NOTEBOOK_PACKAGES = (
    "jupyterlab>=4,<5",
    "ipykernel>=6,<8",
    "nbformat>=5.9,<6",
    "nbclient>=0.10,<0.12",
    "nbconvert>=7.16,<8",
)


def log(message: str) -> None:
    print(f"[AI for Research · Module 7] {message}", flush=True)


def run(*arguments: object, **kwargs: object) -> subprocess.CompletedProcess:
    return subprocess.run([str(argument) for argument in arguments], check=True, **kwargs)


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
        or manifest.get("module_id") != "module-07"
    ):
        raise RuntimeError("Manifest is not a supported Module 7 manifest.")
    files = manifest.get("files")
    if not isinstance(files, list) or not 1 <= len(files) <= 40:
        raise RuntimeError("Manifest file list is invalid.")
    if sum(item.get("bytes", MAX_TOTAL_BYTES + 1) for item in files if isinstance(item, dict)) > MAX_TOTAL_BYTES:
        raise RuntimeError("Manifest exceeds the Module 7 download limit.")
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
    module_root = (workspace / "course-materials/module-07").resolve()
    update_root = (workspace / ".course-updates/course-materials/module-07").resolve()
    installed = reused = updates = 0
    seen: set[Path] = set()
    receipt_files = []

    for item in manifest["files"]:
        if not isinstance(item, dict):
            raise RuntimeError("Manifest entry is invalid.")
        relative = Path(str(item.get("path", "")))
        expected_prefix = Path("course-materials/module-07")
        prefix_length = len(expected_prefix.parts)
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.parts[:prefix_length] != expected_prefix.parts
        ):
            raise RuntimeError("Material destination is unsafe.")
        within_module = Path(*relative.parts[prefix_length:])
        if not within_module.parts or within_module in seen:
            raise RuntimeError("Manifest contains an empty or duplicate destination.")
        seen.add(within_module)
        destination = (module_root / within_module).resolve()
        if module_root not in destination.parents:
            raise RuntimeError("Material destination escaped the Module 7 folder.")

        expected_hash = item.get("sha256")
        if destination.is_file() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected_hash:
            status = "reused"
            reused += 1
        elif destination.exists():
            destination = (update_root / within_module).resolve()
            if update_root not in destination.parents:
                raise RuntimeError("Update destination escaped the Module 7 update folder.")
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
        "schema_version": "ai-for-research.module-07-install.v1",
        "manifest_url": MANIFEST_URL,
        "files": receipt_files,
    }
    receipt_path = workspace / "course-materials/module-07/install-receipt.json"
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return installed, reused, updates


def write_launchers(workspace: Path, python: Path) -> None:
    tools = workspace / "tools"
    tools.mkdir(parents=True, exist_ok=True)
    notebook = workspace / "course-materials/module-07/notebooks/module-07-data-visualization.ipynb"
    shell = tools / "start-module-07.sh"
    powershell = tools / "start-module-07.ps1"
    shell.write_text(
        "#!/usr/bin/env bash\nset -euo pipefail\n"
        f"exec {shlex_quote(str(python))} -m jupyter lab {shlex_quote(str(notebook))}\n",
        encoding="utf-8",
    )
    shell.chmod(0o755)
    powershell.write_text(
        "$ErrorActionPreference = 'Stop'\n"
        f"& '{str(python).replace("'", "''")}' -m jupyter lab '{str(notebook).replace("'", "''")}'\n",
        encoding="utf-8",
    )


def prepare_work_area(workspace: Path) -> Path:
    work_root = workspace / "module-07-work"
    work_root.mkdir(parents=True, exist_ok=True)
    answer = work_root / "module-07-figure-audit.md"
    template = workspace / "course-materials/module-07/examples/figure-consistency/figure-consistency-audit-template.md"
    if not answer.exists():
        if not template.is_file():
            raise RuntimeError("Figure-consistency audit template is missing after installation.")
        shutil.copy2(template, answer)
    return work_root


def shlex_quote(value: str) -> str:
    import shlex

    return shlex.quote(value)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--manifest-url", default=MANIFEST_URL)
    parser.add_argument("--allowed-url-prefix", default=ALLOWED_URL_PREFIX)
    args = parser.parse_args()

    workspace = safe_workspace(args.workspace)
    uv = os.environ.get("AI_MODULE07_UV") or shutil.which("uv")
    if not uv:
        raise RuntimeError("uv is unavailable; rerun the operating-system bootstrap command from the Module 7 page.")

    log(f"Workspace: {workspace}")
    manifest = read_manifest(args.manifest_url, args.allowed_url_prefix)
    installed, reused, updates = install_materials(workspace, manifest, args.allowed_url_prefix)
    log(f"Materials ready: installed={installed}, reused={reused}, updates={updates}")
    work_root = prepare_work_area(workspace)
    log(f"Learner work area: {work_root}")

    environment = workspace / ".venv-module07"
    run(uv, "venv", "--python", "3.12", "--allow-existing", environment)
    python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    requirements = workspace / "course-materials/module-07/notebooks/module-07-requirements.txt"
    run(uv, "pip", "install", "--python", python, "-r", requirements, *NOTEBOOK_PACKAGES)
    run(
        python,
        "-m",
        "ipykernel",
        "install",
        "--user",
        "--name",
        "ai-for-research-module07",
        "--display-name",
        "Python (AI for Research M07)",
    )
    probe = (
        "import altair, jupyterlab, matplotlib, numpy, pandas, plotly, seaborn; "
        "print('imports=PASS')"
    )
    run(python, "-c", probe)
    write_launchers(workspace, python)

    notebook = workspace / "course-materials/module-07/notebooks/module-07-data-visualization.ipynb"
    if not notebook.is_file():
        raise RuntimeError("Module 7 notebook hub is missing after installation.")
    log("FINAL_RESULT PASS")
    log(f"Open this folder in VS Code: {workspace}")
    if os.name == "nt":
        log(f"Start later: powershell -ExecutionPolicy Bypass -File \"{workspace / 'tools/start-module-07.ps1'}\"")
    else:
        log(f"Start later: bash {shlex_quote(str(workspace / 'tools/start-module-07.sh'))}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log(f"FINAL_RESULT FAIL — {error}")
        raise SystemExit(1)
