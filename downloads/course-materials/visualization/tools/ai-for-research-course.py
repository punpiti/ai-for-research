#!/usr/bin/env python3
"""AIRR workspace client for Module 7 submission and review status."""

from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


DEFAULT_API_BASE = "https://urban.cpe.ku.ac.th/api/airr/v1"
EXPECTED_FILENAME = "module-07-highlights.md"
MAX_MARKDOWN_BYTES = 64 * 1024
MAX_GRAPH_BYTES = 2 * 1024 * 1024
MAX_GRAPH_TOTAL_BYTES = 8 * 1024 * 1024
MAX_GRAPHS = 5
MAX_RESPONSE_BYTES = 256 * 1024
GRAPH_SUFFIXES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
REQUIRED_HEADINGS = (
    "คำถามที่สำรวจ",
    "Highlights",
    "กราฟที่เลือก",
    "ข้อสรุป",
    "ข้อจำกัดและสิ่งที่ยังสรุปไม่ได้",
)


class AIRRError(RuntimeError):
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
        raise AIRRError("ไฟล์ highlights ต้องมีขนาด 400 bytes ถึง 64 KB")
    missing = [
        heading for heading in REQUIRED_HEADINGS
        if not re.search(rf"^##\s+{re.escape(heading)}\s*$", markdown, re.IGNORECASE | re.MULTILINE)
    ]
    if missing:
        raise AIRRError(f"ไฟล์ highlights ขาดหัวข้อ: {', '.join(missing)}")
    highlight_count = len(
        re.findall(r"^\s*(?:[-*]|\d+[.)])\s+\S+", section(markdown, "Highlights"), re.MULTILINE)
    )
    if not 3 <= highlight_count <= 5:
        raise AIRRError("หัวข้อ Highlights ต้องมี 3–5 ข้อ")
    conclusion_length = len(section(markdown, "ข้อสรุป"))
    if conclusion_length < 40:
        raise AIRRError("ข้อสรุปต้องมีอย่างน้อย 40 ตัวอักษร")
    return {"bytes": size, "highlight_count": highlight_count, "conclusion_characters": conclusion_length}


def resolve_workspace(value: str | None) -> Path:
    if value:
        workspace = Path(value).expanduser().resolve()
    else:
        candidates = [Path.cwd().resolve()]
        script = Path(__file__).resolve()
        if len(script.parents) >= 4:
            candidates.append(script.parents[3])
        workspace = next((item for item in candidates if (item / "module-07-work").is_dir()), candidates[0])
    if not (workspace / "module-07-work").is_dir():
        raise AIRRError("ไม่พบ module-07-work; เปิด Terminal ที่โฟลเดอร์ ai-for-research-workspace")
    return workspace


def highlights_path(workspace: Path, value: str | None) -> Path:
    path = Path(value).expanduser().resolve() if value else workspace / "module-07-work" / EXPECTED_FILENAME
    if path.name != EXPECTED_FILENAME or not path.is_file():
        raise AIRRError(f"ไม่พบไฟล์ {EXPECTED_FILENAME}")
    return path


def graph_paths(workspace: Path, values: list[str] | None) -> list[Path]:
    work = workspace / "module-07-work"
    if values:
        paths = [Path(value).expanduser().resolve() for value in values]
    else:
        figure_dir = work / "figures"
        source = figure_dir.iterdir() if figure_dir.is_dir() else work.iterdir()
        paths = sorted(path.resolve() for path in source if path.is_file() and path.suffix.lower() in GRAPH_SUFFIXES)
    if not 1 <= len(paths) <= MAX_GRAPHS:
        raise AIRRError("AIRR ต้องการกราฟ 1–5 ภาพ; เก็บภาพไว้ใน module-07-work/figures")
    total = 0
    for path in paths:
        try:
            path.relative_to(work.resolve())
        except ValueError as error:
            raise AIRRError("ไฟล์กราฟต้องอยู่ภายใน module-07-work") from error
        if not path.is_file() or path.suffix.lower() not in GRAPH_SUFFIXES:
            raise AIRRError(f"กราฟต้องเป็น PNG, JPEG หรือ WebP: {path.name}")
        size = path.stat().st_size
        if not 50 <= size <= MAX_GRAPH_BYTES:
            raise AIRRError(f"กราฟแต่ละภาพต้องไม่เกิน 2 MB: {path.name}")
        total += size
    if total > MAX_GRAPH_TOTAL_BYTES:
        raise AIRRError("กราฟทั้งหมดต้องมีขนาดรวมไม่เกิน 8 MB")
    if len({path.name.lower() for path in paths}) != len(paths):
        raise AIRRError("ชื่อไฟล์กราฟต้องไม่ซ้ำกัน")
    return paths


def config_path(workspace: Path) -> Path:
    return workspace / ".airr" / "config.json"


def read_config(workspace: Path, required: bool = True) -> dict[str, Any] | None:
    path = config_path(workspace)
    if not path.is_file():
        if required:
            raise AIRRError("ยังไม่ได้เชื่อม AIRR; ใช้คำสั่ง airr login แล้ววาง AIRR Key")
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AIRRError("อ่านการเชื่อมต่อ AIRR ไม่ได้; ใช้ airr login ใหม่") from error
    if not isinstance(value, dict) or value.get("schema_version") != "airr.workspace.v1" or not str(value.get("api_key", "")).startswith("airr_"):
        raise AIRRError("ข้อมูลเชื่อมต่อ AIRR ไม่ถูกต้อง; ใช้ airr login ใหม่")
    return value


def write_private_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)
    if os.name != "nt":
        path.chmod(0o600)


def request_json(method: str, url: str, api_key: str | None = None, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = {"Accept": "application/json", "User-Agent": "AIRR-VS-Code/1"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = Request(url, data=data, method=method, headers=headers)
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as error:
        raw = error.read(MAX_RESPONSE_BYTES + 1)
        try:
            detail = json.loads(raw.decode("utf-8")).get("detail")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            detail = None
        raise AIRRError(str(detail or f"AIRR ตอบ HTTP {error.code}")) from error
    except (URLError, TimeoutError, OSError) as error:
        raise AIRRError(f"เชื่อมต่อ AIRR ไม่ได้: {error}") from error
    if len(raw) > MAX_RESPONSE_BYTES:
        raise AIRRError("คำตอบจาก AIRR ใหญ่ผิดปกติ")
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AIRRError("AIRR ไม่ได้ตอบ JSON ที่อ่านได้") from error
    if not isinstance(value, dict):
        raise AIRRError("รูปแบบคำตอบจาก AIRR ไม่ถูกต้อง")
    return value


def inspect_graph(path: Path) -> dict[str, Any]:
    content = path.read_bytes()
    media_type = GRAPH_SUFFIXES[path.suffix.lower()]
    magic_ok = (
        media_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n")
        or media_type == "image/jpeg" and content.startswith(b"\xff\xd8\xff")
        or media_type == "image/webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    )
    if not magic_ok:
        raise AIRRError(f"เนื้อหาไฟล์ไม่ตรงกับชนิดภาพ: {path.name}")
    return {
        "filename": path.name,
        "media_type": media_type,
        "sha256": hashlib.sha256(content).hexdigest(),
        "content_base64": base64.b64encode(content).decode("ascii"),
    }


def build_submission(markdown_path: Path, graphs: list[Path]) -> tuple[dict[str, Any], dict[str, int]]:
    markdown = markdown_path.read_text(encoding="utf-8")
    inspection = inspect_highlights(markdown)
    return {
        "event_type": "ai_for_research_module_7_highlights",
        "submission_id": str(uuid4()),
        "client_submitted_at": datetime.now(timezone.utc).isoformat(),
        "artifact": {
            "filename": EXPECTED_FILENAME,
            "sha256": hashlib.sha256(markdown.encode("utf-8")).hexdigest(),
            "markdown": markdown,
            "highlight_count": inspection["highlight_count"],
            "chart_count": len(graphs),
            "ai_used": "yes",
            "evidence_confirmed": True,
            "conclusion_confirmed": True,
            "no_sensitive_data_confirmed": True,
        },
        "graphs": [inspect_graph(path) for path in graphs],
    }, inspection


def command_login(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    key = str(args.key or getpass.getpass("วาง AIRR Key (ข้อความจะไม่แสดง): ")).strip()
    if not key.startswith("airr_"):
        raise AIRRError("AIRR Key ต้องขึ้นต้นด้วย airr_")
    me = request_json("GET", f"{args.api_base.rstrip('/')}/me", key)
    write_private_json(config_path(workspace), {
        "schema_version": "airr.workspace.v1",
        "api_base": args.api_base.rstrip("/"),
        "api_key": key,
        "key_id": me.get("key_id"),
        "classroom_id": me.get("classroom_id"),
        "classroom_title": me.get("classroom_title"),
        "connected_at": datetime.now(timezone.utc).isoformat(),
    })
    print(f"AIRR CONNECTED · {me.get('classroom_title')} ({me.get('classroom_id')})")
    print(f"config={config_path(workspace)}")


def command_logout(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    path = config_path(workspace)
    if path.exists():
        path.unlink()
    print("AIRR DISCONNECTED · key บนเว็บยังใช้งานได้จนกว่าจะกดเพิกถอน")


def command_whoami(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    me = request_json("GET", f"{config['api_base']}/me", config["api_key"])
    print(f"AIRR · {me.get('classroom_title')} ({me.get('classroom_id')})")
    print(f"module-7-open={str(bool(me.get('class', {}).get('is_open'))).lower()}")


def command_check(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    path = highlights_path(workspace, args.file)
    graphs = graph_paths(workspace, args.graph)
    inspection = inspect_highlights(path.read_text(encoding="utf-8"))
    for graph in graphs:
        inspect_graph(graph)
    print(f"AIRR CHECK PASS · module-7 · {inspection['highlight_count']} highlights · {len(graphs)} graphs")
    print(f"highlights={path}")
    for graph in graphs:
        print(f"graph={graph.name} bytes={graph.stat().st_size}")


def receipt_path(workspace: Path) -> Path:
    return workspace / "module-07-work" / "airr-module-07-receipt.json"


def command_submit(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    path = highlights_path(workspace, args.file)
    graphs = graph_paths(workspace, args.graph)
    payload, inspection = build_submission(path, graphs)
    total = sum(graph.stat().st_size for graph in graphs)
    print(f"AIRR ตรวจผ่าน: {inspection['highlight_count']} highlights, {len(graphs)} กราฟ, ภาพรวม {total} bytes")
    print("AIRR จะส่ง highlights และกราฟให้ผู้สอน ไม่ส่งข้อมูลดิบ โค้ด หรือไฟล์อื่นใน workspace")
    if not args.yes and input("ยืนยันส่งงานผ่าน AIRR? [y/N] ").strip().lower() not in {"y", "yes"}:
        print("ยกเลิกการส่งงาน")
        return
    result = request_json("POST", f"{config['api_base']}/modules/module-7/submissions", config["api_key"], payload)
    if result.get("review_status") != "pending_review":
        raise AIRRError("AIRR รับงานแต่ไม่คืนสถานะ pending_review")
    receipt = {
        "schema_version": "airr.module-7-receipt.v1",
        "submission_id": result.get("submission_id"),
        "classroom_id": config.get("classroom_id"),
        "review_status": result.get("review_status"),
        "attempt_count": result.get("attempt_count"),
        "received_at": result.get("received_at"),
        "highlight_sha256": payload["artifact"]["sha256"],
        "graph_sha256": {item["filename"]: item["sha256"] for item in payload["graphs"]},
    }
    write_private_json(receipt_path(workspace), receipt)
    print(f"AIRR SUBMIT PASS · pending_review · attempt={receipt['attempt_count']}")
    print(f"receipt={receipt_path(workspace)}")


def command_status(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    result = request_json("GET", f"{config['api_base']}/modules/module-7/status", config["api_key"])
    submissions = result.get("submissions")
    if not isinstance(submissions, list):
        raise AIRRError("AIRR ไม่คืนรายการสถานะที่อ่านได้")
    print(f"AIRR · module-7 · completed={str(bool(result.get('module_completed'))).lower()} · attempts={len(submissions)}")
    for item in submissions:
        if not isinstance(item, dict):
            continue
        print(f"{item.get('received_at', '-')} · {item.get('review_status', '-')} · {item.get('submission_id', '-')}")
        if item.get("review_comment"):
            print(f"  feedback: {item['review_comment']}")


def add_module_files(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("module", choices=("module-7",))
    parser.add_argument("--file", help="ตำแหน่ง module-07-highlights.md")
    parser.add_argument("--graph", action="append", help="ระบุกราฟซ้ำได้ 1–5 ครั้ง; ค่าเริ่มต้นอ่าน module-07-work/figures")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="airr", description="AIRR — AI for Research & Review")
    root.add_argument("--workspace", help="โฟลเดอร์ ai-for-research-workspace; ค่าเริ่มต้นคือโฟลเดอร์ปัจจุบัน")
    root.add_argument("--api-base", default=DEFAULT_API_BASE, help=argparse.SUPPRESS)
    commands = root.add_subparsers(dest="command", required=True)
    login = commands.add_parser("login", help="เชื่อม VS Code ด้วย AIRR Key")
    login.add_argument("--key", help=argparse.SUPPRESS)
    login.set_defaults(handler=command_login)
    logout = commands.add_parser("logout", help="ลบ AIRR Key ออกจาก workspace นี้")
    logout.set_defaults(handler=command_logout)
    whoami = commands.add_parser("whoami", help="ดูคลาสที่เชื่อมกับ AIRR")
    whoami.set_defaults(handler=command_whoami)
    check = commands.add_parser("check", help="ตรวจ highlights และกราฟในเครื่อง")
    add_module_files(check)
    check.set_defaults(handler=command_check)
    submit = commands.add_parser("submit", help="ส่ง highlights และกราฟให้ผู้สอน")
    add_module_files(submit)
    submit.add_argument("--yes", action="store_true", help="ส่งโดยไม่ถามยืนยันซ้ำ")
    submit.set_defaults(handler=command_submit)
    status = commands.add_parser("status", help="ดูผลตรวจและ feedback")
    status.add_argument("module", choices=("module-7",))
    status.set_defaults(handler=command_status)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        args.handler(args)
    except (AIRRError, UnicodeDecodeError, OSError) as error:
        print(f"AIRR ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
