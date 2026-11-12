#!/usr/bin/env python3
"""Windows + macOS unit tests for the Module 7 and Module 8 installers.

Nothing is installed: uv, curl, Invoke-WebRequest and the learner Python are
replaced by fakes that record how they were called.

* macOS section: runs the real macOS bootstraps under bash with fake curl/uv,
  checks bash 3.2 / BSD userland compatibility, and executes the generated
  .sh launchers.
* Windows section: needs powershell.exe (Windows PowerShell 5.1, e.g. from
  WSL). It parses every shipped/generated .ps1 with the real 5.1 parser, runs
  the bootstraps with mocks, and round-trips a Thai workspace path through the
  generated launchers. Skipped with a notice when powershell.exe is absent.

Rule under test: Windows PowerShell 5.1 reads a BOM-less .ps1 as the ANSI code
page, so UTF-8 punctuation breaks parsing. Shipped bootstraps stay pure ASCII;
generated .ps1 files are written as UTF-8 with BOM.
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / "downloads"
MODULES = ("07", "08")
THAI_DIR = "ผู้ใช้ ทดสอบ O'Brien"
BASE_URL = "https://urban.cpe.ku.ac.th/ai-for-research/downloads/"
BOM = b"\xef\xbb\xbf"


def load(name: str):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), DOWNLOADS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def executable(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


# ---------------------------------------------------------------- shared/static

def test_encoding_rule() -> None:
    for path in sorted(ROOT.rglob("*.ps1")):
        data = path.read_bytes()
        assert data.startswith(BOM) or data.isascii(), f"{path}: non-ASCII .ps1 without UTF-8 BOM"
    for module in MODULES:
        assert (DOWNLOADS / f"setup-module-{module}-windows.ps1").read_bytes().isascii()


BASH4_OR_GNU = {
    r"declare\s+-[aA]*A": "associative arrays (bash 4)",
    r"\b(mapfile|readarray|coproc)\b": "bash 4 builtin",
    r"\$\{[A-Za-z_][A-Za-z0-9_]*(,,|\^\^)": "case-modifying expansion (bash 4)",
    r"\|&|&>>": "bash 4 redirection",
    r"\blocal\s+-n\b": "nameref (bash 4.3)",
    r"\breadlink\s+-f\b": "GNU readlink -f",
    r"\bsed\s+-i\s+(?!'')": "GNU sed -i",
    r"\bdate\s+-d\b": "GNU date -d",
    r"\bstat\s+-c\b": "GNU stat -c",
    r"\bgrep\s+-[a-zA-Z]*P": "GNU grep -P",
    r"(?<![\w-])timeout\s": "GNU timeout (absent on macOS)",
}


def assert_macos_shell(text: str, label: str) -> None:
    for pattern, reason in BASH4_OR_GNU.items():
        assert not re.search(pattern, text), f"{label}: {reason} is not available on stock macOS"
    if "sha256sum" in text:
        assert "shasum" in text, f"{label}: sha256sum needs a shasum fallback on macOS"


def test_macos_static() -> None:
    for module in MODULES:
        path = DOWNLOADS / f"setup-module-{module}-macos.sh"
        subprocess.run(["bash", "-n", str(path)], check=True)
        assert_macos_shell(path.read_text(encoding="utf-8"), path.name)


def test_bootstrap_targets_exist() -> None:
    for module in MODULES:
        for script in (f"setup-module-{module}-windows.ps1", f"setup-module-{module}-macos.sh"):
            text = (DOWNLOADS / script).read_text(encoding="utf-8")
            assert f"{BASE_URL}setup-module-{module}.py" in text, script
        assert (DOWNLOADS / f"setup-module-{module}.py").is_file()
        page = (ROOT / f"module-{int(module)}.html").read_text(encoding="utf-8")
        assert f"setup-module-{module}-windows.ps1" in page and f"setup-module-{module}-macos.sh" in page


# ---------------------------------------------------------------- macOS / bash

FAKE_CURL = """#!/bin/sh
out=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift 2 ;; -*) shift ;; *) url="$1"; shift ;; esac
done
printf '%s\\n' "$url" >> "$FAKE_LOG/curl.log"
case "$url" in
  *astral.sh/uv/install.sh) cat > "$out" <<'EOS'
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/uv" <<'EOU'
#!/bin/sh
for a in "$@"; do printf '%s\\n' "$a"; done > "$FAKE_LOG/uv.args"
printf '%s' "${AI_MODULE07_UV:-}" > "$FAKE_LOG/uv.env"
exit "${FAKE_UV_EXIT:-0}"
EOU
chmod +x "$HOME/.local/bin/uv"
EOS
  ;;
  *) printf 'print("fake")\\n' > "$out" ;;
esac
"""

FAKE_UV = """#!/bin/sh
for a in "$@"; do printf '%s\\n' "$a"; done > "$FAKE_LOG/uv.args"
printf '%s' "${AI_MODULE07_UV:-}" > "$FAKE_LOG/uv.env"
exit "${FAKE_UV_EXIT:-0}"
"""


def run_macos(module: str, root: Path, args: list[str], with_uv: bool, uv_exit: int = 0):
    home, bin_dir, log = root / "home", root / "bin", root / "log"
    for folder in (home, bin_dir, log):
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True)
    executable(bin_dir / "curl", FAKE_CURL)
    if with_uv:
        executable(bin_dir / "uv", FAKE_UV)
    for tool in ("bash", "sh", "mktemp", "rm", "cat", "mkdir", "chmod", "dirname"):
        found = shutil.which(tool)
        if found and not (bin_dir / tool).exists():
            (bin_dir / tool).symlink_to(found)
    env = {"HOME": str(home), "PATH": str(bin_dir), "FAKE_LOG": str(log), "FAKE_UV_EXIT": str(uv_exit), "LANG": "C.UTF-8"}
    result = subprocess.run(
        ["bash", str(DOWNLOADS / f"setup-module-{module}-macos.sh"), *args],
        env=env, capture_output=True, text=True, cwd=root,
    )
    uv_args = (log / "uv.args").read_text(encoding="utf-8").splitlines() if (log / "uv.args").exists() else None
    uv_env = (log / "uv.env").read_text(encoding="utf-8") if (log / "uv.env").exists() else None
    urls = (log / "curl.log").read_text(encoding="utf-8").splitlines() if (log / "curl.log").exists() else []
    return result, home, uv_args, uv_env, urls


def test_macos_bootstrap(tmp: Path) -> None:
    for module in MODULES:
        root = tmp / f"mac-{module}"
        # default workspace, uv already installed
        result, home, uv_args, uv_env, urls = run_macos(module, root, [], with_uv=True)
        assert result.returncode == 0, result.stderr
        assert uv_args[:5] == ["run", "--no-project", "--python", "3.12", "python"]
        assert uv_args[-2:] == ["--workspace", str(home / "ai-for-research-workspace")]
        assert urls == [f"{BASE_URL}setup-module-{module}.py"]
        if module == "07":
            assert uv_env and uv_env.endswith("/uv"), "AI_MODULE07_UV must point at uv"
        # explicit workspace with Thai, spaces and an apostrophe
        workspace = str(root / THAI_DIR)
        result, *_rest = run_macos(module, root, ["--workspace", workspace], with_uv=True)
        assert result.returncode == 0 and _rest[1][-1] == workspace
        # uv missing -> official installer path, then PATH refresh
        result, home, uv_args, _env, urls = run_macos(module, root, [], with_uv=False)
        assert result.returncode == 0, result.stderr
        assert "Installing uv" in result.stdout and urls[0].endswith("astral.sh/uv/install.sh")
        assert uv_args and uv_args[0] == "run"
        # failures propagate
        result, *_ = run_macos(module, root, [], with_uv=True, uv_exit=3)
        assert result.returncode == 3
        result, *_ = run_macos(module, root, ["--bogus"], with_uv=True)
        assert result.returncode == 2 and "Unknown option" in result.stderr


def make_m7_workspace(workspace: Path) -> None:
    client = workspace / "course-materials/module-07/tools/ai-for-research-course.py"
    client.parent.mkdir(parents=True, exist_ok=True)
    client.write_text("# fake client\n", encoding="utf-8")


def test_generated_shell_launchers(tmp: Path) -> None:
    m7, m8 = load("setup-module-07"), load("setup-module-08")
    workspace = tmp / "gen-sh" / THAI_DIR
    make_m7_workspace(workspace)
    log = tmp / "gen-sh" / "python.args"
    fake_python = executable(tmp / "gen-sh" / "fake python", f"#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\"; done > '{log}'\n")
    m7.write_launchers(workspace, fake_python)
    m8.write_build_launchers(workspace)
    for name in ("airr.sh", "module-07-course.sh", "start-module-07.sh", "build-module-08.sh"):
        script = workspace / "tools" / name
        subprocess.run(["bash", "-n", str(script)], check=True)
        assert_macos_shell(script.read_text(encoding="utf-8"), name)
        assert os.access(script, os.X_OK), f"{name} must be executable"
    subprocess.run([str(workspace / "tools/airr.sh"), "status", "module-7"], check=True)
    assert log.read_text(encoding="utf-8").splitlines() == [
        str(workspace / "course-materials/module-07/tools/ai-for-research-course.py"),
        "--workspace", str(workspace), "status", "module-7",
    ]
    (workspace / "module-08-work").mkdir()
    result = subprocess.run(["bash", str(workspace / "tools/build-module-08.sh")], capture_output=True, text=True)
    assert result.returncode == 1 and "Missing generated/main.tex" in result.stderr


# ---------------------------------------------------------------- Windows / PS 5.1

NATIVE_WINDOWS = os.name == "nt"
POWERSHELL = "powershell" if NATIVE_WINDOWS else "powershell.exe"
PS_CWD = None if NATIVE_WINDOWS else "/mnt/c"


def windows_temp() -> Path | None:
    """Windows temp folder: native on a Windows runner, or via WSL interop."""
    if NATIVE_WINDOWS:
        return Path(tempfile.gettempdir()) if shutil.which("powershell") else None
    if not shutil.which("powershell.exe") or not shutil.which("wslpath"):
        return None
    raw = subprocess.run(["cmd.exe", "/c", "echo %TEMP%"], capture_output=True, text=True, cwd="/mnt/c").stdout.strip()
    return Path(subprocess.run(["wslpath", "-u", raw], capture_output=True, text=True, check=True).stdout.strip())


def win(path: Path) -> str:
    if NATIVE_WINDOWS:
        return str(path)
    return subprocess.run(["wslpath", "-w", str(path)], capture_output=True, text=True, check=True).stdout.strip()


def ps_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def run_ps(driver: Path, body: str) -> dict:
    """Run a BOM-encoded driver with powershell.exe -File; it must write result.json."""
    driver.write_text(body, encoding="utf-8-sig")
    out = driver.with_name("result.json")
    out.unlink(missing_ok=True)
    proc = subprocess.run(
        [POWERSHELL, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", win(driver)],
        capture_output=True, text=True, errors="replace", cwd=PS_CWD,
    )
    assert out.exists(), f"PowerShell driver failed:\n{proc.stdout}\n{proc.stderr}"
    return json.loads(out.read_text(encoding="utf-8-sig"))


SAVE_JSON = "[IO.File]::WriteAllText({out}, ($result | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))\n"


def test_windows_parse(work: Path, files: list[Path]) -> None:
    listing = ",".join(ps_quote(win(p)) for p in files)
    result = run_ps(work / "parse.ps1", (
        "$result = @{}\n"
        f"foreach ($f in @({listing})) {{\n"
        "  $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$null, [ref]$errors)\n"
        "  $result[$f] = @($errors | ForEach-Object { $_.Message })\n}\n"
        + SAVE_JSON.format(out=ps_quote(win(work / "result.json")))
    ))
    bad = {k: v for k, v in result.items() if v}
    assert not bad, f"Windows PowerShell 5.1 parse errors: {bad}"


def test_windows_bootstrap(work: Path) -> None:
    fake_bin = work / "fakebin"
    fake_bin.mkdir()
    (fake_bin / "uv.ps1").write_text(
        "$log = Join-Path $PSScriptRoot 'uv.json'\n"
        "$data = @{ args = @($args | ForEach-Object { [string]$_ }); env = \"$env:AI_MODULE07_UV\" }\n"
        "[IO.File]::WriteAllText($log, ($data | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))\n"
        "exit [int]$env:FAKE_UV_EXIT\n",
        encoding="ascii",
    )
    for module in MODULES:
        bootstrap = work / f"m{module}.ps1"
        bootstrap.write_bytes((DOWNLOADS / f"setup-module-{module}-windows.ps1").read_bytes())  # byte-exact, no BOM
        for case, uv_exit, workspace_arg in (("default", 0, None), ("thai", 0, THAI_DIR), ("fail", 3, None)):
            uv_json = fake_bin / "uv.json"
            uv_json.unlink(missing_ok=True)
            workspace = None if workspace_arg is None else win(work) + "\\" + workspace_arg
            call = f"& {ps_quote(win(bootstrap))}" + (f" -Workspace {ps_quote(workspace)}" if workspace else "")
            result = run_ps(work / "drive.ps1", (
                f"$env:PATH = {ps_quote(win(fake_bin))} + ';' + $env:PATH\n"
                f"$env:FAKE_UV_EXIT = '{uv_exit}'\n"
                "$global:urls = @()\n"
                "function Invoke-WebRequest { param([switch]$UseBasicParsing, [Parameter(Position=0)]$Uri, $OutFile)\n"
                "  $global:urls += $Uri; Set-Content -LiteralPath $OutFile -Value 'print(1)' }\n"
                f"$output = {call} *>&1 | Out-String\n"
                "$result = @{ exit = $LASTEXITCODE; output = $output; urls = $global:urls; home = \"$HOME\"; temp = \"$env:TEMP\" }\n"
                + SAVE_JSON.format(out=ps_quote(win(work / "result.json")))
            ))
            label = f"windows m{module} {case}"
            assert result["urls"] == [f"{BASE_URL}setup-module-{module}.py"], (label, result)
            uv = json.loads(uv_json.read_text(encoding="utf-8-sig"))
            assert uv["args"][:5] == ["run", "--no-project", "--python", "3.12", "python"], (label, uv, result)
            assert uv["args"][5].lower() == (result["temp"] + f"\\ai-module{module}-setup.py").lower(), label
            expected_ws = workspace or result["home"] + "\\ai-for-research-workspace"
            assert uv["args"][6:] == ["--workspace", expected_ws], (label, uv["args"])
            if module == "07":
                assert uv["env"].lower().endswith("uv.ps1"), label
            if uv_exit:
                assert result["exit"] == 1, label
                assert f"FINAL_RESULT FAIL - Module {int(module)} setup failed with exit code 3" in result["output"], label
            else:
                assert result["exit"] in (0, None), (label, result)
                assert "FINAL_RESULT FAIL" not in result["output"], (label, result["output"])


def test_windows_generated_launchers(work: Path) -> list[Path]:
    m7, m8 = load("setup-module-07"), load("setup-module-08")
    workspace = work / THAI_DIR
    make_m7_workspace(workspace)
    fake_python = work / "fake-python.ps1"
    fake_python.write_text(
        f"[IO.File]::WriteAllText({ps_quote(win(work / 'python.json'))}, (@($args) | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))\nexit 0\n",
        encoding="ascii",
    )
    # str() of a PurePosixPath keeps the Windows spelling, as on a real Windows install.
    m7.write_launchers(workspace, Path(win(fake_python)))
    m8.write_build_launchers(workspace)
    generated = [workspace / "tools" / n for n in ("airr.ps1", "module-07-course.ps1", "start-module-07.ps1", "build-module-08.ps1")]
    for path in generated:
        assert path.read_bytes().startswith(BOM), f"{path.name} must be UTF-8 with BOM"
    (workspace / "module-08-work").mkdir()
    result = run_ps(work / "drive.ps1", (
        f"& {ps_quote(win(workspace / 'tools/airr.ps1'))} status module-7\n"
        "$airrExit = $LASTEXITCODE\n"
        f"$build = powershell -NoProfile -ExecutionPolicy Bypass -File {ps_quote(win(workspace / 'tools/build-module-08.ps1'))} 2>&1 | Out-String\n"
        "$result = @{ airr = $airrExit; build = $build; buildExit = $LASTEXITCODE }\n"
        + SAVE_JSON.format(out=ps_quote(win(work / "result.json")))
    ))
    assert result["airr"] == 0, result
    args = json.loads((work / "python.json").read_text(encoding="utf-8-sig"))
    assert args[1:] == ["--workspace", str(workspace), "status", "module-7"], args  # Thai path survives PS 5.1
    assert result["buildExit"] == 1 and "Missing generated/main.tex - ask AI" in result["build"], result
    return generated


def main() -> None:
    test_encoding_rule()
    test_bootstrap_targets_exist()
    if NATIVE_WINDOWS:
        print("SKIP: Module 7-8 macOS bash tests (native Windows host).")
    else:
        with tempfile.TemporaryDirectory(prefix="m78-platform-") as temporary:
            tmp = Path(temporary)
            test_macos_static()
            test_macos_bootstrap(tmp)
            test_generated_shell_launchers(tmp)
        print("Module 7-8 macOS bootstrap/launcher tests passed.")

    temp = windows_temp()
    if temp is None:
        print("SKIP: Module 7-8 Windows PowerShell 5.1 tests (Windows PowerShell not available).")
        return
    work = temp / f"airr-m78-{uuid.uuid4().hex[:8]}"
    work.mkdir()
    try:
        generated = test_windows_generated_launchers(work)
        shipped = [p for p in sorted(ROOT.rglob("*.ps1"))]
        copies = []
        for index, path in enumerate(shipped):
            copy = work / f"shipped-{index}-{path.name}"
            copy.write_bytes(path.read_bytes())
            copies.append(copy)
        test_windows_parse(work, copies + generated)
        test_windows_bootstrap(work)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print("Module 7-8 Windows PowerShell 5.1 bootstrap/launcher tests passed.")


if __name__ == "__main__":
    main()
