#!/usr/bin/env python3
"""Focused offline tests for the Module 8 manifest installer."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
INSTALLER = ROOT / "downloads/setup-module-08.py"
SOURCE = ROOT / "downloads/course-materials/document-production"


def build_manifest(folder: Path) -> Path:
    files = []
    prefix = folder.resolve().as_uri() + "/"
    for source in sorted(path for path in SOURCE.rglob("*") if path.is_file()):
        relative = source.relative_to(SOURCE).as_posix()
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        payload = target.read_bytes()
        files.append(
            {
                "url": prefix + relative,
                "path": f"course-materials/module-08/{relative}",
                "sha256": hashlib.sha256(payload).hexdigest(),
                "bytes": len(payload),
            }
        )
    manifest = folder / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": "ai-for-research.course-materials.v1",
                "module_id": "module-08",
                "files": files,
            }
        ),
        encoding="utf-8",
    )
    return manifest


def install(workspace: Path, manifest: Path, allowed: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(INSTALLER),
            "--workspace",
            str(workspace),
            "--manifest-url",
            manifest.resolve().as_uri(),
            "--allowed-url-prefix",
            allowed,
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="module8-installer-test-") as temporary:
        root = Path(temporary)
        server = root / "server"
        workspace = root / "workspace"
        manifest = build_manifest(server)
        allowed = server.resolve().as_uri() + "/"

        module7 = workspace / "module-07-work"
        (module7 / "figures").mkdir(parents=True)
        (module7 / "module-07-highlights.md").write_text("# Learner Module 7 highlights\n", encoding="utf-8")
        (module7 / "figures/learner-pm25.png").write_bytes(
            (SOURCE / "figures/pm25-before-after.png").read_bytes()
        )

        result = install(workspace, manifest, allowed)
        assert "FINAL_RESULT PASS" in result.stdout
        assert "continued-from-module-07" in result.stdout
        work = workspace / "module-08-work"
        assert (work / "input/module-07-highlights.md").read_text(encoding="utf-8").startswith("# Learner")
        assert (work / "input/module-07-figures/learner-pm25.png").is_file()
        assert (work / "source/manuscript.md").is_file()
        assert (work / "generated").is_dir() and (work / "build").is_dir()
        assert (workspace / "tools/build-module-08.sh").is_file()

        manuscript = work / "source/manuscript.md"
        manuscript.write_text("# Learner edit\n", encoding="utf-8")
        second = install(workspace, manifest, allowed)
        assert "reused=11" in second.stdout
        assert manuscript.read_text(encoding="utf-8") == "# Learner edit\n"

        standalone = root / "standalone"
        standalone_result = install(standalone, manifest, allowed)
        assert "standalone-example" in standalone_result.stdout
        example = standalone / "module-08-work/input/module-07-highlights.md"
        assert "PM2.5 Highlights Example" in example.read_text(encoding="utf-8")

    print("Module 8 installer tests passed.")


if __name__ == "__main__":
    main()
