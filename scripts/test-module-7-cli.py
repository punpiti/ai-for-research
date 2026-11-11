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
                assert client.main(["--workspace", str(workspace), "init", "module-1"]) == 0
                module1_path = workspace / "output/module-1-progress.json"
                module1 = json.loads(module1_path.read_text(encoding="utf-8"))
                module1["checks"] = {key: True for key in module1["checks"]}
                module1_path.write_text(json.dumps(module1), encoding="utf-8")
                assert client.main(["--workspace", str(workspace), "check", "module-1"]) == 0
                assert client.main(["--workspace", str(workspace), "submit", "module-1", "--yes"]) == 0
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
    print("AIRR Module 7 VS Code client tests passed.")


if __name__ == "__main__":
    run()
