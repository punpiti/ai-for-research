#!/usr/bin/env python3
"""Module 7 workspace client for checking, submitting, and tracking highlights."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from uuid import uuid4


DEFAULT_API_BASE = "https://urban.cpe.ku.ac.th/api/ai-for-research/module-7"
EXPECTED_FILENAME = "module-07-highlights.md"
MAX_MARKDOWN_BYTES = 64 * 1024
MAX_RESPONSE_BYTES = 256 * 1024
SAFE_CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$")
REQUIRED_HEADINGS = (
    "คำถามที่สำรวจ",
    "Highlights",
    "กราฟที่เลือก",
    "ข้อสรุป",
    "ข้อจำกัดและสิ่งที่ยังสรุปไม่ได้",
)


class CourseClientError(RuntimeError):
    pass


def section(markdown: str, heading: str) -> str:
    match = re.search(
        rf"^##\s+{re.escape(heading)}\s*$([\s\S]*?)(?=^##\s+|\Z)",
        markdown,
        re.IGNORECASE | re.MULTILINE,
    )
    return match.group(1).strip() if match else ""


def inspect_highlights(markdown: str) -> dict[str, int]:
    size = len(markdown.encode("utf-8"))
    if size < 400 or size > MAX_MARKDOWN_BYTES:
        raise CourseClientError("ไฟล์ต้องมีขนาด 400 bytes ถึง 64 KB")
    missing = [
        heading
        for heading in REQUIRED_HEADINGS
        if not re.search(rf"^##\s+{re.escape(heading)}\s*$", markdown, re.IGNORECASE | re.MULTILINE)
    ]
    if missing:
        raise CourseClientError(f"ขาดหัวข้อ: {', '.join(missing)}")
    highlight_count = len(
        re.findall(r"^\s*(?:[-*]|\d+[.)])\s+\S+", section(markdown, "Highlights"), re.MULTILINE)
    )
    if not 3 <= highlight_count <= 5:
        raise CourseClientError("หัวข้อ Highlights ต้องมี 3–5 ข้อ")
    conclusion_length = len(section(markdown, "ข้อสรุป"))
    if conclusion_length < 40:
        raise CourseClientError("ข้อสรุปต้องมีอย่างน้อย 40 ตัวอักษร")
    return {
        "bytes": size,
        "highlight_count": highlight_count,
        "conclusion_characters": conclusion_length,
    }


def resolve_workspace(value: str | None) -> Path:
    if value:
        workspace = Path(value).expanduser().resolve()
    else:
        candidates = [Path.cwd().resolve()]
        script = Path(__file__).resolve()
        if len(script.parents) >= 4:
            candidates.append(script.parents[3])
        workspace = next(
            (candidate for candidate in candidates if (candidate / "module-07-work").is_dir()),
            candidates[0],
        )
    if not (workspace / "module-07-work").is_dir():
        raise CourseClientError("ไม่พบ module-07-work; เปิด Terminal ที่โฟลเดอร์ ai-for-research-workspace")
    return workspace


def highlights_path(workspace: Path, value: str | None) -> Path:
    path = Path(value).expanduser().resolve() if value else workspace / "module-07-work" / EXPECTED_FILENAME
    if path.name != EXPECTED_FILENAME or not path.is_file():
        raise CourseClientError(f"ไม่พบไฟล์ {EXPECTED_FILENAME}")
    return path


def safe_code(value: str, label: str) -> str:
    clean = str(value or "").strip()
    if not SAFE_CODE.fullmatch(clean):
        raise CourseClientError(f"{label} ต้องมี 3–40 ตัวอักษร A–Z, a–z, 0–9, จุด, ขีดกลาง หรือขีดล่าง")
    return clean


def request_json(method: str, url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        url,
        data=data,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json", "User-Agent": "ai-for-research-course/1"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as error:
        raw = error.read(MAX_RESPONSE_BYTES + 1)
        try:
            detail = json.loads(raw.decode("utf-8")).get("detail")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            detail = None
        raise CourseClientError(str(detail or f"Server ตอบ HTTP {error.code}")) from error
    except (URLError, TimeoutError, OSError) as error:
        raise CourseClientError(f"เชื่อมต่อระบบส่งงานไม่ได้: {error}") from error
    if len(raw) > MAX_RESPONSE_BYTES:
        raise CourseClientError("คำตอบจาก server ใหญ่ผิดปกติ")
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CourseClientError("Server ไม่ได้ตอบ JSON ที่อ่านได้") from error
    if not isinstance(value, dict):
        raise CourseClientError("รูปแบบคำตอบจาก server ไม่ถูกต้อง")
    return value


def receipt_path(workspace: Path) -> Path:
    return workspace / "module-07-work" / "module-07-submission-receipt.json"


def read_receipt(workspace: Path, required: bool = False) -> dict[str, Any] | None:
    path = receipt_path(workspace)
    if not path.is_file():
        if required:
            raise CourseClientError("ยังไม่มี receipt; ใช้คำสั่ง submit ก่อน")
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CourseClientError("อ่าน receipt ไม่ได้") from error
    if not isinstance(value, dict) or value.get("schema_version") != "ai-for-research.module-7-receipt.v1":
        raise CourseClientError("receipt ไม่ใช่รูปแบบของ Module 7")
    return value


def write_receipt(workspace: Path, value: dict[str, Any]) -> Path:
    path = receipt_path(workspace)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)
    if os.name != "nt":
        path.chmod(0o600)
    return path


def build_envelope(
    workspace: Path,
    file_path: Path,
    class_code: str,
    callsign: str,
    chart_count: int,
    ai_used: str,
) -> tuple[dict[str, Any], dict[str, int]]:
    if not 1 <= chart_count <= 10:
        raise CourseClientError("จำนวนกราฟต้องอยู่ระหว่าง 1–10")
    if ai_used not in {"yes", "no"}:
        raise CourseClientError("--ai-used ต้องเป็น yes หรือ no")
    markdown = file_path.read_text(encoding="utf-8")
    inspection = inspect_highlights(markdown)
    previous = read_receipt(workspace)
    callsign_key = ""
    if previous and previous.get("class_code") == class_code and previous.get("callsign") == callsign:
        callsign_key = str(previous.get("callsign_key") or "")
    envelope = {
        "event_type": "ai_for_research_module_7_highlights",
        "submission_id": str(uuid4()),
        "class_code": safe_code(class_code, "รหัสคลาส"),
        "callsign": safe_code(callsign, "Call sign"),
        "callsign_key": callsign_key,
        "client_submitted_at": datetime.now(timezone.utc).isoformat(),
        "artifact": {
            "filename": EXPECTED_FILENAME,
            "sha256": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
            "markdown": markdown,
            "highlight_count": inspection["highlight_count"],
            "chart_count": chart_count,
            "ai_used": ai_used,
            "evidence_confirmed": True,
            "conclusion_confirmed": True,
            "no_sensitive_data_confirmed": True,
        },
    }
    return envelope, inspection


def command_check(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    path = highlights_path(workspace, args.file)
    inspection = inspect_highlights(path.read_text(encoding="utf-8"))
    print(f"LOCAL_CHECK PASS · {path}")
    print(f"highlights={inspection['highlight_count']} bytes={inspection['bytes']} conclusion={inspection['conclusion_characters']} chars")


def command_submit(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    path = highlights_path(workspace, args.file)
    class_code = safe_code(args.class_code, "รหัสคลาส")
    callsign = safe_code(args.callsign, "Call sign")
    envelope, inspection = build_envelope(workspace, path, class_code, callsign, args.chart_count, args.ai_used)
    base = args.api_base.rstrip("/")
    state = request_json("GET", f"{base}/classes/{quote(class_code, safe='')}/status")
    if state.get("is_open") is not True:
        raise CourseClientError("Module 7 ของคลาสนี้ยังไม่เปิดรับงาน")
    print(f"ตรวจผ่าน: {inspection['highlight_count']} highlights, {args.chart_count} กราฟ, {inspection['bytes']} bytes")
    print("จะส่งเฉพาะ module-07-highlights.md; ไม่ส่งข้อมูลดิบ โค้ด หรือภาพ")
    if not args.yes:
        if input("ยืนยันส่งงาน? [y/N] ").strip().lower() not in {"y", "yes"}:
            print("ยกเลิกการส่งงาน")
            return
    result = request_json("POST", f"{base}/submissions", envelope)
    if result.get("review_status") != "pending_review" or not result.get("callsign_key"):
        raise CourseClientError("Server รับงานแต่ไม่คืน receipt ที่สมบูรณ์")
    receipt = {
        "schema_version": "ai-for-research.module-7-receipt.v1",
        "module_id": "module-7",
        "submission_id": envelope["submission_id"],
        "class_code": class_code,
        "callsign": callsign,
        "callsign_key": result["callsign_key"],
        "review_status": result["review_status"],
        "attempt_count": result.get("attempt_count"),
        "received_at": result.get("received_at"),
        "artifact_sha256": envelope["artifact"]["sha256"],
    }
    saved = write_receipt(workspace, receipt)
    print(f"SUBMIT PASS · status=pending_review attempt={receipt['attempt_count']}")
    print(f"receipt={saved}")


def command_status(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    receipt = read_receipt(workspace, required=True)
    assert receipt is not None
    query = urlencode({
        "class_code": receipt["class_code"],
        "callsign": receipt["callsign"],
        "callsign_key": receipt["callsign_key"],
    })
    result = request_json("GET", f"{args.api_base.rstrip('/')}/submission-status?{query}")
    submissions = result.get("submissions")
    if not isinstance(submissions, list):
        raise CourseClientError("Server ไม่คืนรายการสถานะที่อ่านได้")
    print(f"module_completed={str(bool(result.get('module_completed'))).lower()} attempts={len(submissions)}")
    for item in submissions:
        if not isinstance(item, dict):
            continue
        line = f"{item.get('received_at', '-')} · {item.get('review_status', '-')} · {item.get('submission_id', '-')}"
        print(line)
        if item.get("review_comment"):
            print(f"  feedback: {item['review_comment']}")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="AI for Research Module 7 workspace client")
    root.add_argument("--workspace", help="โฟลเดอร์ ai-for-research-workspace; ค่าเริ่มต้นคือโฟลเดอร์ปัจจุบัน")
    root.add_argument("--api-base", default=DEFAULT_API_BASE, help=argparse.SUPPRESS)
    commands = root.add_subparsers(dest="command", required=True)
    check = commands.add_parser("check", help="ตรวจไฟล์ในเครื่องโดยยังไม่ส่ง")
    check.add_argument("--file")
    check.set_defaults(handler=command_check)
    submit = commands.add_parser("submit", help="ตรวจและส่ง highlights ผ่าน API")
    submit.add_argument("--class-code", required=True)
    submit.add_argument("--callsign", required=True)
    submit.add_argument("--chart-count", required=True, type=int)
    submit.add_argument("--ai-used", required=True, choices=("yes", "no"))
    submit.add_argument("--file")
    submit.add_argument("--yes", action="store_true", help="ส่งโดยไม่ถามยืนยันซ้ำ")
    submit.set_defaults(handler=command_submit)
    status = commands.add_parser("status", help="ดูผลตรวจและ feedback จาก receipt")
    status.set_defaults(handler=command_status)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        args.handler(args)
    except (CourseClientError, UnicodeDecodeError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
