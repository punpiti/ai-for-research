#!/usr/bin/env python3
"""Focused offline tests for the Module 8 manifest installer."""

from __future__ import annotations

import hashlib
import json
import os
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


def make_tool_dirs(root: Path) -> tuple[str, str]:
    """Return PATH values with and without fake latexmk/xelatex."""
    with_tools = root / "bin-with-tools"
    without_tools = root / "bin-without-tools"
    with_tools.mkdir(parents=True)
    without_tools.mkdir(parents=True)
    for name in ("latexmk", "xelatex"):
        tool = with_tools / name
        tool.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        tool.chmod(0o755)
    return str(with_tools), str(without_tools)


def install(workspace: Path, manifest: Path, allowed: str, path: str) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ, PATH=path)
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
        env=env,
    )


def final_lines(output: str) -> list[str]:
    return [line.split("] ", 1)[1] for line in output.splitlines() if "FINAL_RESULT" in line]


def test_standalone_then_module7_reinstall(root: Path, manifest: Path, allowed: str, path: str) -> None:
    sample = (SOURCE / "evidence/module-07-highlights-example.md").read_bytes()
    workspace = root / "standalone-then-m7"
    first = install(workspace, manifest, allowed, path)
    assert "Learning route: standalone-example" in first.stdout
    work = workspace / "module-08-work"
    highlights = work / "input/module-07-highlights.md"
    assert highlights.read_bytes() == sample
    assert "standalone-example" in (work / "README-FIRST.md").read_text(encoding="utf-8")

    module7 = workspace / "module-07-work"
    (module7 / "figures").mkdir(parents=True)
    learner = "# Learner Module 7 highlights after standalone\n"
    (module7 / "module-07-highlights.md").write_text(learner, encoding="utf-8")
    (module7 / "figures/learner-fig.png").write_bytes(b"\x89PNG learner figure")

    second = install(workspace, manifest, allowed, path)
    assert "HANDOFF_UPDATED Replaced bundled sample module-08-work/input/module-07-highlights.md" in second.stdout, second.stdout
    assert "Learning route: continued-from-module-07; Module 7 figures copied=1" in second.stdout, second.stdout
    assert highlights.read_text(encoding="utf-8") == learner
    backup = work / "input/module-07-highlights.md.sample-backup"
    assert backup.read_bytes() == sample
    assert (work / "input/module-07-figures/learner-fig.png").read_bytes() == b"\x89PNG learner figure"
    assert "continued-from-module-07" in (work / "README-FIRST.md").read_text(encoding="utf-8")
    assert "WARN Module 7 output" not in second.stdout

    # Identical to Module 7 already: nothing to do, no noise.
    third = install(workspace, manifest, allowed, path)
    assert "HANDOFF_UPDATED" not in third.stdout and "WARN Module 7 output" not in third.stdout
    assert "Learning route: continued-from-module-07; Module 7 figures copied=0" in third.stdout
    assert highlights.read_text(encoding="utf-8") == learner


def test_learner_edited_input_is_kept(root: Path, manifest: Path, allowed: str, path: str) -> None:
    workspace = root / "edited-input"
    install(workspace, manifest, allowed, path)
    work = workspace / "module-08-work"
    highlights = work / "input/module-07-highlights.md"
    edited = "# My own edited highlights\n"
    highlights.write_text(edited, encoding="utf-8")
    (work / "README-FIRST.md").write_text("# My notes\n", encoding="utf-8")

    module7 = workspace / "module-07-work"
    (module7 / "figures").mkdir(parents=True)
    (module7 / "module-07-highlights.md").write_text("# Newer Module 7 highlights\n", encoding="utf-8")
    figure_target = work / "input/module-07-figures/fig.png"
    figure_target.write_bytes(b"learner's older figure")
    (module7 / "figures/fig.png").write_bytes(b"newer module 7 figure")

    result = install(workspace, manifest, allowed, path)
    assert (
        "WARN Module 7 output module-07-work/module-07-highlights.md is newer/different than "
        "module-08-work/input/module-07-highlights.md" in result.stdout
    ), result.stdout
    assert "copy module-07-work/module-07-highlights.md to module-08-work/input/module-07-highlights.md by hand" in result.stdout
    assert "WARN Module 7 output module-07-work/figures/fig.png" in result.stdout
    assert "HANDOFF_UPDATED" not in result.stdout
    assert "Learning route: learner-edited-input" in result.stdout
    assert "continued-from-module-07" not in result.stdout
    assert highlights.read_text(encoding="utf-8") == edited
    assert figure_target.read_bytes() == b"learner's older figure"
    assert not (work / "input/module-07-highlights.md.sample-backup").exists()
    assert (work / "README-FIRST.md").read_text(encoding="utf-8") == "# My notes\n"


def test_missing_build_tools(root: Path, manifest: Path, allowed: str, path: str) -> None:
    result = install(root / "no-tools", manifest, allowed, path)
    assert final_lines(result.stdout) == [
        "FINAL_RESULT PASS_WITH_WARNINGS - Work area ready, but the PDF build tools are missing."
    ], result.stdout
    assert "WARN Build tools missing: latexmk, xelatex." in result.stdout
    assert "Rerun the Module 1 installer" in result.stdout
    assert result.returncode == 0


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="module8-installer-test-") as temporary:
        root = Path(temporary)
        server = root / "server"
        workspace = root / "workspace"
        manifest = build_manifest(server)
        allowed = server.resolve().as_uri() + "/"
        tools_path, no_tools_path = make_tool_dirs(root)

        module7 = workspace / "module-07-work"
        (module7 / "figures").mkdir(parents=True)
        (module7 / "module-07-highlights.md").write_text("# Learner Module 7 highlights\n", encoding="utf-8")
        (module7 / "figures/learner-pm25.png").write_bytes(
            (SOURCE / "figures/pm25-before-after.png").read_bytes()
        )

        result = install(workspace, manifest, allowed, tools_path)
        assert final_lines(result.stdout) == ["FINAL_RESULT PASS"], result.stdout
        assert "WARN" not in result.stdout
        assert "continued-from-module-07" in result.stdout
        work = workspace / "module-08-work"
        assert (work / "input/module-07-highlights.md").read_text(encoding="utf-8").startswith("# Learner")
        assert (work / "input/module-07-figures/learner-pm25.png").is_file()
        assert (work / "source/manuscript.md").is_file()
        assert (work / "generated").is_dir() and (work / "build").is_dir()
        assert (workspace / "tools/build-module-08.sh").is_file()

        manuscript = work / "source/manuscript.md"
        manuscript.write_text("# Learner edit\n", encoding="utf-8")
        second = install(workspace, manifest, allowed, tools_path)
        assert "reused=11" in second.stdout
        assert manuscript.read_text(encoding="utf-8") == "# Learner edit\n"

        standalone = root / "standalone"
        standalone_result = install(standalone, manifest, allowed, tools_path)
        assert "standalone-example" in standalone_result.stdout
        example = standalone / "module-08-work/input/module-07-highlights.md"
        assert "PM2.5 Highlights Example" in example.read_text(encoding="utf-8")

        test_standalone_then_module7_reinstall(root, manifest, allowed, tools_path)
        test_learner_edited_input_is_kept(root, manifest, allowed, tools_path)
        test_missing_build_tools(root, manifest, allowed, no_tools_path)

    print("Module 8 installer tests passed.")


if __name__ == "__main__":
    main()
