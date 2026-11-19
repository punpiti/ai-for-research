#!/usr/bin/env python3
"""Focused tests for the AIRR Module 7 VS Code client."""

import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile


ROOT = Path(__file__).resolve().parents[1]
CLIENT_PATH = ROOT / "downloads/course-materials/visualization/tools/ai-for-research-course.py"
spec = importlib.util.spec_from_file_location("airr_client", CLIENT_PATH)
client = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(client)
setup_spec = importlib.util.spec_from_file_location("module7_setup", ROOT / "downloads/setup-module-07.py")
setup = importlib.util.module_from_spec(setup_spec)
assert setup_spec and setup_spec.loader
setup_spec.loader.exec_module(setup)

MARKDOWN = """# Module 7 highlights

## คำถามที่สำรวจ

ค่า PM2.5 เปลี่ยนอย่างไรตามพื้นที่ กลุ่ม ก่อน–หลังมาตรการ และเวลา

## Highlights

- North intervention ลดลง 8.2 µg/m³ หลังมาตรการ
- Central intervention ลดลง 5.1 µg/m³ ขณะที่ control เปลี่ยน 0.8 µg/m³
- South มีรูปแบบต่างออกไป โดยค่าเฉลี่ยหลังมาตรการสูงขึ้น 1.4 µg/m³

## กราฟที่เลือก

ใช้กราฟเส้นแยกพื้นที่และกลุ่มเพื่อดูแนวโน้ม พร้อมกราฟจุดสรุปก่อนและหลัง

## ข้อสรุป

ข้อมูลจำลองสนับสนุนว่าการเปลี่ยนแปลงหลังมาตรการแตกต่างกันตามพื้นที่ โดย North และ Central ลดลงชัดกว่า South จึงไม่ควรสรุปผลรวมเพียงค่าเดียว

## ข้อจำกัดและสิ่งที่ยังสรุปไม่ได้

ข้อมูลจำลองนี้ไม่ยืนยันเหตุและผล ต้องตรวจแบบการศึกษา ตัวแปรกวน และความไม่แน่นอนก่อนนำไปอ้างอิงภายนอกบทเรียน
"""
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def run() -> None:
    with tempfile.TemporaryDirectory(prefix="airr-cli-") as folder:
        workspace = Path(folder)
        work = workspace / "module-07-work"
        figures = work / "figures"
        figures.mkdir(parents=True)
        (work / "module-07-highlights.md").write_text(MARKDOWN, encoding="utf-8")
        (figures / "pm25-summary.png").write_bytes(PNG)
        installed_client = workspace / "course-materials/module-07/tools/ai-for-research-course.py"
        installed_client.parent.mkdir(parents=True)
        installed_client.write_text("# AIRR client\n", encoding="utf-8")
        setup.write_launchers(workspace, workspace / ".venv-module07/bin/python")
        assert "ai-for-research-course.py" in (workspace / "tools/airr.sh").read_text(encoding="utf-8")
        assert "@args" in (workspace / "tools/airr.ps1").read_text(encoding="utf-8")
        original_file = client.__file__
        client.__file__ = str(installed_client)
        try:
            assert client.resolve_workspace(None) == workspace
        finally:
            client.__file__ = original_file
        calls = []

        def fake_request(method, url, api_key=None, payload=None):
            calls.append((method, url, api_key, payload))
            if url.endswith("/me"):
                return {"key_id": "key_test", "classroom_id": "pilot-07", "classroom_title": "AIRR Pilot", "class": {"is_open": True}}
            if url.endswith("/submissions"):
                assert api_key == "airr_" + "k" * 48
                if "/module-1/" in url:
                    assert payload["progress"]["checks"]["workspace_opened"] is True
                    return {"status": "accepted", "submission_id": payload["submission_id"], "attempt_count": 1, "received_at": "2026-11-11T00:00:00+00:00"}
                assert payload["artifact"]["highlight_count"] == 3
                assert len(payload["graphs"]) == 1
                return {"review_status": "pending_review", "submission_id": payload["submission_id"], "attempt_count": 1, "received_at": "2026-11-11T00:00:00+00:00"}
            if url.endswith("/module-2/done"):
                assert payload["progress"]["line_counts"] == {"meal_card": 2, "learner_additions": 1}
                assert "meal" not in json.dumps(payload["module_evaluation"])
                return {"status": "accepted", "submission_id": payload["submission_id"], "attempt_count": 1, "received_at": "2026-11-11T00:00:00+00:00"}
            if url.endswith("/status"):
                return {"module_completed": False, "submissions": [{"submission_id": "s1", "received_at": "2026-11-11T00:00:00+00:00", "review_status": "revision_requested", "review_comment": "เพิ่มหลักฐานตัวเลข"}]}
            raise AssertionError(url)

        original = client.request_json
        client.request_json = fake_request
        try:
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                assert client.main(["--workspace", str(workspace), "--api-base", "https://test/api/airr/v1", "login", "--key", "airr_" + "k" * 48]) == 0
                assert client.main(["--workspace", str(workspace), "check", "module-7"]) == 0
                assert client.main(["--workspace", str(workspace), "submit", "module-7", "--yes"]) == 0
                assert client.main(["--workspace", str(workspace), "status", "module-7"]) == 0
                assert client.main(["--workspace", str(workspace), "init", "module-1", "--forms-only"]) == 0
                module1_path = workspace / "module-01-work/output/module-1-progress.json"
                module1 = json.loads(module1_path.read_text(encoding="utf-8"))
                assert module1["completion_status"] == "could_not_complete"
                module1["completion_status"] = "completed"
                module1_path.write_text(json.dumps(module1), encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-1"]) == 1, "completed with unticked checks must fail"
                module1["checks"] = {key: True for key in module1["checks"]}
                module1_path.write_text(json.dumps(module1), encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-1"]) == 0
                assert client.main(["--workspace", str(workspace), "submit", "module-1", "--yes"]) == 0
                # Module 1 short path: learner ticked the web checklist; AIRR only says "done", no progress file needed.
                module1_path.unlink()
                assert client.main(["--workspace", str(workspace), "submit", "module-1", "--short", "--yes"]) == 0
                short_call = calls[-1]
                assert short_call[1].endswith("/modules/module-1/submissions"), short_call[1]
                assert short_call[3]["progress"]["completion_status"] == "completed"
                assert all(short_call[3]["progress"]["checks"].values())
                assert 1 <= short_call[3]["progress"]["completion_minutes"] <= 600
                assert not module1_path.exists(), "--short must not create a progress file"
                # Module 2 short path: placeholder evaluation and missing files are refused locally.
                assert client.main(["--workspace", str(workspace), "init", "module-2", "--forms-only"]) == 0
                (workspace / "module-02-work/output/meal-card.md").write_text("# full\n# short\n", encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-2", "--short"]) == 1
                (workspace / "module-02-work/notes").mkdir(parents=True, exist_ok=True)
                (workspace / "module-02-work/output/evidence-table.md").write_text("answer\n\n", encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-2", "--short"]) == 1, "placeholder evaluation must fail"
                evaluation_path = workspace / "module-02-work/output/module-2-evaluation.json"
                evaluation = json.loads(evaluation_path.read_text(encoding="utf-8"))
                evaluation.update({"ai_tool": "claude", "ai_turns": 4, "completion_minutes": 35, "hardest_step": "prompt_test"})
                evaluation_path.write_text(json.dumps(evaluation), encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-2", "--short"]) == 0
                assert client.main(["--workspace", str(workspace), "submit", "module-2", "--short", "--yes"]) == 0
                # Friday class without faithful-summary: refs.bib from the OpenAlex topic fills the meal_card slot.
                (workspace / "module-02-work/output/meal-card.md").unlink()
                assert client.main(["--workspace", str(workspace), "check", "module-2", "--short"]) == 1
                (workspace / "module-02-work/openalex").mkdir(parents=True, exist_ok=True)
                (workspace / "module-02-work/openalex/refs.bib").write_text("@article{a,\n title={T}\n}\n", encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-2", "--short"]) == 0
            text = output.getvalue()
            assert "AIRR CONNECTED" in text and "AIRR CHECK PASS" in text and "AIRR SUBMIT PASS" in text
            assert "revision_requested" in text and "feedback: เพิ่มหลักฐานตัวเลข" in text
            config = json.loads((workspace / ".airr/config.json").read_text(encoding="utf-8"))
            assert config["classroom_id"] == "pilot-07" and config["api_key"].startswith("airr_")
            receipt = json.loads((work / "airr-module-07-receipt.json").read_text(encoding="utf-8"))
            assert receipt["graph_sha256"]["pm25-summary.png"]
        finally:
            client.request_json = original

    try:
        client.inspect_highlights(MARKDOWN.replace("- South", "South"))
    except client.AIRRError:
        pass
    else:
        raise AssertionError("invalid highlight count was accepted")
    materials_test()
    init_test()
    topic_card_test()
    ai_key_test()
    print("AIRR Module 7 VS Code client tests passed.")


def materials_test() -> None:
    """`airr materials module-2|module-4` place files without overwriting learner copies."""
    with tempfile.TemporaryDirectory(prefix="airr-materials-") as folder:
        workspace = Path(folder)
        (workspace / ".airr").mkdir()
        (workspace / ".airr/config.json").write_text(json.dumps({"schema_version": "airr.workspace.v1", "api_base": "https://example.test/api/airr/v1", "api_key": "airr_x", "classroom_id": "c"}), encoding="utf-8")
        urls = []
        original = client.request_bytes
        client.request_bytes = lambda url, key: urls.append(url) or b"data:" + url.rsplit("/", 1)[-1].encode()
        try:
            def call(*argv):
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    assert client.main(["--workspace", str(workspace), *argv]) == 0
                return out.getvalue()
            text = call("materials", "module-2")
            zip_path = workspace / "module-02-work/input/original/module-02-food-evidence.zip"
            assert zip_path.read_bytes() == b"data:module-02-food-evidence.zip" and "AIRR MATERIALS PASS · module-2" in text
            assert urls[-1] == "https://example.test/api/airr/v1/modules/module-2/materials/module-02-food-evidence.zip"
            zip_path.write_bytes(b"learner copy")
            assert "AIRR SKIP" in call("materials", "module-2") and zip_path.read_bytes() == b"learner copy"
            call("materials", "module-4")
            assert (workspace / "module-04-work/input/original/mock-paper.pdf").is_file()
            assert (workspace / "course-materials/module-04/citation-audit-rules.md").is_file()
            call("materials", "module-4", "--thai")
            assert (workspace / "module-04-work/thai-mock/input/original/mock-paper-th.pdf").is_file()
        finally:
            client.request_bytes = original


def init_test() -> None:
    """`airr init module-N` downloads the module's files once, never overwrites learner work,
    puts a changed course file in .course-updates/, and needs AIRR only for login-protected files."""
    import hashlib
    import zipfile
    with tempfile.TemporaryDirectory(prefix="airr-init-") as folder:
        root = Path(folder); web = root / "web"; workspace = root / "ws"
        (web / "course").mkdir(parents=True); workspace.mkdir()
        course = web / "course" / "rules.md"; course.write_bytes(b"rules v1\n")
        mock = web / "course" / "mock.md"; mock.write_bytes(b"mock\n")
        entry = lambda path, url, data, kind: {"kind": kind, "url": url, "path": path, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        manifest = {"schema_version": "airr.module-materials.v1", "modules": {"module-9": {"files": [
            entry("course-materials/module-09/rules.md", "course/rules.md", b"rules v1\n", "course"),
            entry("module-09-work/input/mock.md", "course/mock.md", b"mock\n", "mock"),
            {"kind": "api", "module": "module-9", "name": "paper.pdf", "path": "module-09-work/input/original/paper.pdf", "refresh": False},
            {"kind": "copy", "from": "course-materials/module-09/rules.md", "path": "module-09-work/rules-copy.md"},
        ]}}}
        (web / "module-materials.json").write_text(json.dumps(manifest), encoding="utf-8")
        url = (web / "module-materials.json").as_uri()
        def call(*argv):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                assert client.main(["--workspace", str(workspace), "init", "module-9", "--manifest-url", url, *argv]) == 0
            return out.getvalue()
        text = call()
        assert (workspace / "course-materials/module-09/rules.md").read_bytes() == b"rules v1\n"
        assert (workspace / "module-09-work/rules-copy.md").read_bytes() == b"rules v1\n"
        assert "ต้องเชื่อม AIRR ก่อน" in text and not (workspace / "module-09-work/input/original/paper.pdf").exists()
        (workspace / "module-09-work/input/mock.md").write_bytes(b"learner edit\n")
        course.write_bytes(b"rules v2\n"); manifest["modules"]["module-9"]["files"][0] = entry("course-materials/module-09/rules.md", "course/rules.md", b"rules v2\n", "course")
        (web / "module-materials.json").write_text(json.dumps(manifest), encoding="utf-8")
        text = call()
        assert (workspace / "module-09-work/input/mock.md").read_bytes() == b"learner edit\n"
        assert (workspace / "course-materials/module-09/rules.md").read_bytes() == b"rules v1\n"
        assert (workspace / ".course-updates/course-materials/module-09/rules.md").read_bytes() == b"rules v2\n"
        (workspace / ".airr").mkdir()
        (workspace / ".airr/config.json").write_text(json.dumps({"schema_version": "airr.workspace.v1", "api_base": "https://example.test/api/airr/v1", "api_key": "airr_x", "classroom_id": "c"}), encoding="utf-8")
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as bundle:
            bundle.writestr("README.md", "course evidence\n")
            bundle.writestr("data/table.csv", "value\n1\n")
        zip_bytes = archive.getvalue()
        manifest["modules"]["module-9"]["files"][2] = {
            "kind": "api", "module": "module-9", "name": "evidence.zip",
            "path": "module-09-work/input/original/evidence.zip",
            "extract": True, "refresh": False,
        }
        (web / "module-materials.json").write_text(json.dumps(manifest), encoding="utf-8")
        original = client.request_bytes
        client.request_bytes = lambda u, key: zip_bytes
        try:
            call()
        finally:
            client.request_bytes = original
        extracted = workspace / "module-09-work/input/original/evidence"
        assert (extracted / "README.md").read_text() == "course evidence\n"
        assert (extracted / "data/table.csv").read_text() == "value\n1\n"
        (extracted / "README.md").write_text("learner edit\n")
        call()
        assert (extracted / "README.md").read_text() == "learner edit\n"
        unsafe = root / "unsafe.zip"
        with zipfile.ZipFile(unsafe, "w") as bundle:
            bundle.writestr("../outside.txt", "blocked\n")
        try:
            client.extract_zip_once(unsafe, workspace / "module-09-work/input/unsafe", workspace)
            raise AssertionError("unsafe ZIP was accepted")
        except client.AIRRError:
            pass
        assert not (root / "outside.txt").exists()
        # refresh=True (e.g. M4 rule files): a learner-edited copy is kept, the new version goes to .course-updates/
        manifest["modules"]["module-9"]["files"] = [{"kind": "api", "module": "module-9", "name": "rules.md", "path": "course-materials/module-09/api-rules.md", "refresh": True}]
        (web / "module-materials.json").write_text(json.dumps(manifest), encoding="utf-8")
        original = client.request_bytes
        client.request_bytes = lambda u, key: b"server rules\n"
        try:
            call()
            assert (workspace / "course-materials/module-09/api-rules.md").read_bytes() == b"server rules\n"
            (workspace / "course-materials/module-09/api-rules.md").write_bytes(b"learner edit\n")
            text = call()
        finally:
            client.request_bytes = original
        assert (workspace / "course-materials/module-09/api-rules.md").read_bytes() == b"learner edit\n"
        assert (workspace / ".course-updates/course-materials/module-09/api-rules.md").read_bytes() == b"server rules\n"
        assert "AIRR CONTEXT · ตอนนี้ทำ module-9 · ทำงานใน module-09-work/" in text and "course-materials/module-09/api-rules.md" in text
        manifest["modules"]["module-9"]["files"] = [{"kind": "copy", "from": "../outside.txt", "path": "module-09-work/x.txt"}]
        (web / "module-materials.json").write_text(json.dumps(manifest), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            assert client.main(["--workspace", str(workspace), "init", "module-9", "--manifest-url", url]) == 1


def topic_card_test() -> None:
    """The M2 OpenAlex topic card is sent only once filled in, with the server's limits."""
    with tempfile.TemporaryDirectory(prefix="airr-card-") as folder:
        workspace = Path(folder); card_path = workspace / "module-02-work/openalex/topic-card.json"
        assert client.module2_topic_card(workspace) is None
        card_path.parent.mkdir(parents=True)
        empty = {"topic": "", "question": "", "works_found": 0, "works_kept": 0, "sources_excluded": 0, "bib_entries": 0}
        card_path.write_text(json.dumps(empty), encoding="utf-8")
        assert client.module2_topic_card(workspace) is None
        filled = {**empty, "topic": "  PM2.5 ในโรงเรียน ", "question": "มาตรการไหนลดฝุ่นในห้องเรียนได้", "works_found": 140, "works_kept": 12, "sources_excluded": 2, "bib_entries": 12}
        card_path.write_text(json.dumps(filled, ensure_ascii=False), encoding="utf-8")
        assert client.module2_topic_card(workspace) == {**filled, "topic": "PM2.5 ในโรงเรียน"}
        for bad in ({**filled, "abstract": "x"}, {**filled, "topic": "a\nb"}, {**filled, "works_kept": -1}, {**filled, "question": "x" * 301}):
            card_path.write_text(json.dumps(bad, ensure_ascii=False), encoding="utf-8")
            try:
                client.module2_topic_card(workspace)
                raise AssertionError(f"bad topic card accepted: {bad}")
            except client.AIRRError:
                pass


def ai_key_test() -> None:
    """`airr ai-key` writes the key to a private file outside the workspace and never prints it."""
    with tempfile.TemporaryDirectory(prefix="airr-aikey-") as folder:
        workspace, home = Path(folder) / "ws", Path(folder) / "home"
        (workspace / ".airr").mkdir(parents=True)
        (workspace / ".airr/config.json").write_text(json.dumps({"schema_version": "airr.workspace.v1", "api_base": "https://example.test/api/airr/v1", "api_key": "airr_x", "classroom_id": "c"}), encoding="utf-8")
        key = "sk-or-v1-" + "a1" * 32
        calls = []
        original_request, original_path = client.request_json, client.ai_key_path
        client.request_json = lambda method, url, api_key=None, payload=None: calls.append((method, url)) or {
            "provider": "openrouter", "label": "L01", "tier": "learner", "api_key": key}
        client.ai_key_path = lambda: home / ".airr" / "ai-key.txt"
        try:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                assert client.main(["--workspace", str(workspace), "ai-key"]) == 0
            assert calls == [("POST", "https://example.test/api/airr/v1/ai-key")]
            assert key not in out.getvalue() and "AIRR AI-KEY READY" in out.getvalue()
            path = home / ".airr" / "ai-key.txt"
            assert path.read_text(encoding="utf-8").splitlines()[0] == key
            assert oct(path.stat().st_mode & 0o777) == "0o600"
            assert not any(key in item.read_text(encoding="utf-8", errors="ignore") for item in workspace.rglob("*") if item.is_file())
            with contextlib.redirect_stdout(io.StringIO()):
                assert client.main(["--workspace", str(workspace), "ai-key", "--clear"]) == 0
            assert not path.exists()
            client.request_json = lambda *a, **k: {"api_key": "not-a-key"}
            with contextlib.redirect_stderr(io.StringIO()):
                assert client.main(["--workspace", str(workspace), "ai-key"]) == 1
            assert not path.exists()
        finally:
            client.request_json, client.ai_key_path = original_request, original_path



def run_update() -> None:
    """airr update replaces only a hash-verified copy; already-latest and tampered cases change nothing."""
    import hashlib, shutil, subprocess, sys
    with tempfile.TemporaryDirectory(prefix="airr-update-") as folder:
        root = Path(folder); web = root / "web"; tools = root / "ws" / "tools"
        web.mkdir(); tools.mkdir(parents=True)
        installed = tools / "client.py"; shutil.copy(CLIENT_PATH, installed)
        newer = web / "client.py"; newer.write_bytes(CLIENT_PATH.read_bytes() + b"\n# newer\n")
        content = newer.read_bytes()
        (web / "manifest.json").write_text(json.dumps({"files": [{"url": newer.as_uri(), "path": "course-materials/module-07/tools/ai-for-research-course.py",
            "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)}]}), encoding="utf-8")
        update = lambda: subprocess.run([sys.executable, str(installed), "update", "--manifest-url", (web / "manifest.json").as_uri()], capture_output=True, text=True)
        assert update().returncode == 0 and installed.read_bytes() == content
        assert "รุ่นล่าสุดแล้ว" in update().stdout
        version = subprocess.run([sys.executable, str(installed), "version", "--manifest-url", (web / "manifest.json").as_uri()], capture_output=True, text=True)
        assert version.returncode == 0 and version.stdout.startswith("AIRR ") and "รุ่นล่าสุดแล้ว" in version.stdout
        newer.write_bytes(content + b"# tampered\n"); shutil.copy(CLIENT_PATH, installed)
        assert update().returncode == 1 and installed.read_bytes() == CLIENT_PATH.read_bytes()


if __name__ == "__main__":
    run()
    run_update()
