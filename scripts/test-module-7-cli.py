#!/usr/bin/env python3
"""Focused tests for the Module 7 VS Code submission client."""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile


ROOT = Path(__file__).resolve().parents[1]
CLIENT_PATH = ROOT / "downloads/course-materials/visualization/tools/ai-for-research-course.py"
spec = importlib.util.spec_from_file_location("module7_course_client", CLIENT_PATH)
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


def run() -> None:
    with tempfile.TemporaryDirectory(prefix="module7-cli-") as folder:
        workspace = Path(folder)
        work = workspace / "module-07-work"
        work.mkdir()
        (work / "module-07-highlights.md").write_text(MARKDOWN, encoding="utf-8")
        installed_client = workspace / "course-materials/module-07/tools/ai-for-research-course.py"
        installed_client.parent.mkdir(parents=True)
        installed_client.write_text("# client\n", encoding="utf-8")
        setup.write_launchers(workspace, workspace / ".venv-module07/bin/python")
        assert "ai-for-research-course.py" in (workspace / "tools/module-07-course.sh").read_text(encoding="utf-8")
        assert "@args" in (workspace / "tools/module-07-course.ps1").read_text(encoding="utf-8")
        original_file = client.__file__
        client.__file__ = str(installed_client)
        try:
            assert client.resolve_workspace(None) == workspace
        finally:
            client.__file__ = original_file
        calls = []

        def fake_request(method, url, payload=None):
            calls.append((method, url, payload))
            if url.endswith("/status"):
                return {"module_id": "module-7", "is_open": True}
            if url.endswith("/submissions"):
                assert payload["artifact"]["highlight_count"] == 3
                assert payload["artifact"]["markdown"] == MARKDOWN
                return {"review_status": "pending_review", "callsign_key": "k" * 32, "attempt_count": 1, "received_at": "2026-11-11T00:00:00+00:00"}
            if "submission-status?" in url:
                return {"module_completed": False, "submissions": [{"submission_id": "s1", "received_at": "2026-11-11T00:00:00+00:00", "review_status": "revision_requested", "review_comment": "เพิ่มหลักฐานตัวเลข"}]}
            raise AssertionError(url)

        original = client.request_json
        client.request_json = fake_request
        try:
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                assert client.main(["--workspace", str(workspace), "check"]) == 0
                assert client.main(["--workspace", str(workspace), "--api-base", "https://test/api", "submit", "--class-code", "pilot-07", "--callsign", "green-orbit-7", "--chart-count", "2", "--ai-used", "yes", "--yes"]) == 0
                assert client.main(["--workspace", str(workspace), "--api-base", "https://test/api", "status"]) == 0
            text = output.getvalue()
            assert "LOCAL_CHECK PASS" in text and "SUBMIT PASS" in text
            assert "revision_requested" in text and "feedback: เพิ่มหลักฐานตัวเลข" in text
            receipt = json.loads((work / "module-07-submission-receipt.json").read_text(encoding="utf-8"))
            assert receipt["callsign_key"] == "k" * 32
            assert calls[1][2]["callsign_key"] == ""
        finally:
            client.request_json = original

    try:
        client.inspect_highlights(MARKDOWN.replace("- South", "South"))
    except client.CourseClientError:
        pass
    else:
        raise AssertionError("invalid highlight count was accepted")
    print("Module 7 VS Code client tests passed.")


if __name__ == "__main__":
    run()
