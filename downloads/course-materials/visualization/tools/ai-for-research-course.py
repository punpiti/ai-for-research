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
import subprocess
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
        workspace = next((item for item in candidates if (item / "tools").is_dir() or (item / "module-07-work").is_dir()), candidates[0])
    if not workspace.is_dir():
        raise AIRRError("ไม่พบ workspace; เปิด Terminal ที่โฟลเดอร์ ai-for-research-workspace")
    return workspace


def load_json(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file():
        raise AIRRError(f"ไม่พบ {label}: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AIRRError(f"{label} ไม่ใช่ JSON ที่อ่านได้") from error
    if not isinstance(value, dict):
        raise AIRRError(f"{label} ต้องเป็น JSON object")
    return value


def evaluation_path(workspace: Path, module: str, value: str | None) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    if module == "module-2":
        return workspace / "output" / "module-2-evaluation.json"
    return workspace / "output" / "module-3" / "module-3-evaluation.json"


def validate_evaluation(value: dict[str, Any], module: str) -> dict[str, Any]:
    common = {"ai_tool", "ai_turns", "retry_count", "completion_minutes", "token_source", "total_tokens", "completion_status", "difficulty_rating", "usefulness_rating", "hardest_step"}
    expected = common | ({"input_tokens", "output_tokens"} if module == "module-2" else set())
    if set(value) != expected:
        raise AIRRError(f"ไฟล์ evaluation ของ {module} มี field ไม่ครบหรือเกิน")
    if value["ai_tool"] not in {"codex", "claude", "openrouter", "other", "unknown"}:
        raise AIRRError("ai_tool ไม่ถูกต้อง")
    if value["completion_status"] not in {"completed", "completed_with_help", "could_not_complete"}:
        raise AIRRError("completion_status ไม่ถูกต้อง")
    for key, low, high in (("ai_turns", 1, 100), ("retry_count", 0, 50), ("completion_minutes", 1, 2400), ("difficulty_rating", 1, 5), ("usefulness_rating", 1, 5)):
        if isinstance(value[key], bool) or not isinstance(value[key], int) or not low <= value[key] <= high:
            raise AIRRError(f"{key} ต้องเป็นจำนวนเต็ม {low}–{high}")
    if value["token_source"] not in {"provider_reported", "learner_estimate", "not_available"}:
        raise AIRRError("token_source ไม่ถูกต้อง")
    total = value["total_tokens"]
    if value["token_source"] == "not_available" and total is not None or value["token_source"] != "not_available" and not isinstance(total, int):
        raise AIRRError("total_tokens ไม่สอดคล้องกับ token_source")
    return value


def run_local_validator(workspace: Path, module: str, artifact: Path, markdown: Path | None = None) -> None:
    validator = workspace / "tools" / f"validate-{module}.py"
    if not validator.is_file():
        raise AIRRError(f"ไม่พบ {validator}; รันตัวติดตั้ง course workspace รุ่นล่าสุด")
    command = [sys.executable, str(validator), str(artifact)]
    if module == "module-2":
        if markdown is None:
            raise AIRRError("Module 2 ต้องมีไฟล์ Markdown")
        command.append(str(markdown))
    else:
        command.extend(["--workspace", str(workspace)])
    result = subprocess.run(command, cwd=workspace, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode != 0:
        raise AIRRError((result.stderr or result.stdout or "LOCAL_CHECK FAIL").strip())


def module_payload(workspace: Path, args: argparse.Namespace) -> tuple[dict[str, Any], str]:
    now = datetime.now(timezone.utc).isoformat()
    if args.module == "module-1":
        path = Path(args.file).expanduser().resolve() if args.file else workspace / "output" / "module-1-progress.json"
        progress = load_json(path, "module-1-progress.json")
        required = {"schema_version", "module_id", "checks", "completion_status", "ai_tool", "completion_minutes", "token_source", "total_tokens"}
        if set(progress) != required or progress.get("schema_version") != "ai-for-research.module-1-progress.v1" or progress.get("module_id") != "module-1":
            raise AIRRError("module-1-progress.json ไม่ตรง schema ของ Module 1")
        return {"event_type": "ai_for_research_module_1_progress", "submission_id": str(uuid4()), "client_submitted_at": now, "progress": progress}, str(path)
    if args.module == "module-2":
        artifact_path = Path(args.file).expanduser().resolve() if args.file else workspace / "output" / "module-2-submission.json"
        markdown = Path(args.markdown).expanduser().resolve() if args.markdown else workspace / "output" / "module-2-conclusion.md"
        run_local_validator(workspace, "module-2", artifact_path, markdown)
        artifact = load_json(artifact_path, "module-2-submission.json")
        result = artifact["result"]
        levels = {level: sum(item["level"] == level for item in result["claims"]) for level in ("L1", "L2", "L3", "L4")}
        machine = {"passed": True, "claim_count": len(result["claims"]), "open_question_count": len(result["open_questions"]), "learner_addition_count": len(result["learner_additions"]), "level_counts": levels,
                   "formats_complete": True, "source_rules_pass": True, "prompt_rule_passed": True, "follow_up_prompts_present": True, "unanswered_questions_completed_by_learner": True, "learner_authorship_declared": True, "declaration_complete": True, "markdown_hash_match": True}
        progress = {"schema_version": artifact["schema_version"], "artifact_sha256": artifact["artifact"]["sha256"], "decision": result["decision"], "human_decision": result["human_decision"], "web_retrieval": result["web_retrieval"], "prompt_test": result["prompt_test"], "learner_answer_types": [item["answer_type"] for item in result["learner_additions"]]}
        evaluation = validate_evaluation(load_json(evaluation_path(workspace, "module-2", args.evaluation), "module-2-evaluation.json"), "module-2")
        return {"event_type": "ai_for_research_module_2_progress", "submission_id": str(uuid4()), "client_submitted_at": now, "module_evaluation": evaluation, "machine_check": machine, "progress": progress}, f"{artifact_path}, {markdown}"
    if args.module == "module-3":
        artifact_path = Path(args.file).expanduser().resolve() if args.file else workspace / "output" / "module-3" / "module-3-completion.json"
        run_local_validator(workspace, "module-3", artifact_path)
        progress = load_json(artifact_path, "module-3-completion.json")
        evaluation = validate_evaluation(load_json(evaluation_path(workspace, "module-3", args.evaluation), "module-3-evaluation.json"), "module-3")
        return {"event_type": "ai_for_research_module_3_progress", "submission_id": str(uuid4()), "client_submitted_at": now, "module_evaluation": evaluation, "progress": progress}, str(artifact_path)
    raise AIRRError("module ไม่รองรับ")


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
    for module, state in me.get("module_states", {}).items():
        if state.get("available"):
            suffix = "" if module == "module-1" else f" open={str(bool(state.get('is_open'))).lower()}"
            print(f"{module}{suffix}")


def command_init(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    if args.module == "module-1":
        path = workspace / "output" / "module-1-progress.json"
        value = {"schema_version": "ai-for-research.module-1-progress.v1", "module_id": "module-1", "checks": {"workspace_opened": False, "ai_connected": False, "folder_boundary_understood": False, "pdf_created_and_opened": False}, "completion_status": "completed", "ai_tool": "codex", "completion_minutes": 1, "token_source": "not_available", "total_tokens": None}
    elif args.module == "module-2":
        path = evaluation_path(workspace, "module-2", None)
        value = {"ai_tool": "codex", "ai_turns": 1, "retry_count": 0, "completion_minutes": 1, "token_source": "not_available", "input_tokens": None, "output_tokens": None, "total_tokens": None, "completion_status": "completed", "difficulty_rating": 3, "usefulness_rating": 3, "hardest_step": "none"}
    else:
        path = evaluation_path(workspace, "module-3", None)
        value = {"ai_tool": "codex", "ai_turns": 1, "retry_count": 0, "completion_minutes": 1, "token_source": "not_available", "total_tokens": None, "completion_status": "completed", "difficulty_rating": 3, "usefulness_rating": 3, "hardest_step": "none"}
    if path.exists() and not args.force:
        print(f"AIRR INIT SKIP · มีไฟล์อยู่แล้ว: {path}")
        return
    write_private_json(path, value)
    print(f"AIRR INIT PASS · {args.module}")
    print(f"edit={path}")


def command_check(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    if args.module != "module-7":
        _, source = module_payload(workspace, args)
        print(f"AIRR CHECK PASS · {args.module}")
        print(f"source={source}")
        print("ไม่มีเนื้อหางานถูกส่งออกจากเครื่อง")
        return
    path = highlights_path(workspace, args.file)
    graphs = graph_paths(workspace, args.graph)
    inspection = inspect_highlights(path.read_text(encoding="utf-8"))
    for graph in graphs:
        inspect_graph(graph)
    print(f"AIRR CHECK PASS · module-7 · {inspection['highlight_count']} highlights · {len(graphs)} graphs")
    print(f"highlights={path}")
    for graph in graphs:
        print(f"graph={graph.name} bytes={graph.stat().st_size}")


def receipt_path(workspace: Path, module: str) -> Path:
    if module == "module-7":
        return workspace / "module-07-work" / "airr-module-07-receipt.json"
    return workspace / ".airr" / f"{module}-receipt.json"


def command_submit(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    if args.module == "module-7":
        path = highlights_path(workspace, args.file)
        graphs = graph_paths(workspace, args.graph)
        payload, inspection = build_submission(path, graphs)
        total = sum(graph.stat().st_size for graph in graphs)
        print(f"AIRR ตรวจผ่าน: {inspection['highlight_count']} highlights, {len(graphs)} กราฟ, ภาพรวม {total} bytes")
        print("AIRR จะส่ง highlights และกราฟให้ผู้สอน ไม่ส่งข้อมูลดิบ โค้ด หรือไฟล์อื่นใน workspace")
    else:
        payload, source = module_payload(workspace, args)
        print(f"AIRR ตรวจผ่าน: {args.module} · {source}")
        print("AIRR จะส่งเฉพาะ progress summary และแบบประเมิน ไม่ส่งเนื้อหางานหรือไฟล์หลัก")
    if not args.yes and input("ยืนยันส่งงานผ่าน AIRR? [y/N] ").strip().lower() not in {"y", "yes"}:
        print("ยกเลิกการส่งงาน")
        return
    result = request_json("POST", f"{config['api_base']}/modules/{args.module}/submissions", config["api_key"], payload)
    if result.get("status") != "accepted" and not (args.module == "module-7" and result.get("review_status") == "pending_review"):
        raise AIRRError("AIRR ไม่คืนสถานะ accepted")
    receipt = {
        "schema_version": f"airr.{args.module}-receipt.v1",
        "submission_id": result.get("submission_id"),
        "classroom_id": config.get("classroom_id"),
        "status": result.get("status"),
        "attempt_count": result.get("attempt_count"),
        "received_at": result.get("received_at"),
    }
    if args.module == "module-7":
        receipt["review_status"] = result.get("review_status")
        receipt["highlight_sha256"] = payload["artifact"]["sha256"]
        receipt["graph_sha256"] = {item["filename"]: item["sha256"] for item in payload["graphs"]}
    target = receipt_path(workspace, args.module)
    write_private_json(target, receipt)
    print(f"AIRR SUBMIT PASS · {args.module} · attempt={receipt['attempt_count']}")
    print(f"receipt={target}")


def command_status(args: argparse.Namespace) -> None:
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    result = request_json("GET", f"{config['api_base']}/modules/{args.module}/status", config["api_key"])
    submissions = result.get("submissions")
    if not isinstance(submissions, list):
        raise AIRRError("AIRR ไม่คืนรายการสถานะที่อ่านได้")
    print(f"AIRR · {args.module} · completed={str(bool(result.get('module_completed'))).lower()} · attempts={len(submissions)}")
    for item in submissions:
        if not isinstance(item, dict):
            continue
        print(f"{item.get('received_at', '-')} · {item.get('review_status', '-')} · {item.get('submission_id', '-')}")
        if item.get("review_comment"):
            print(f"  feedback: {item['review_comment']}")


def add_module_files(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("module", choices=("module-1", "module-2", "module-3", "module-7"))
    parser.add_argument("--file", help="ตำแหน่งไฟล์หลักของโมดูล")
    parser.add_argument("--graph", action="append", help="ระบุกราฟซ้ำได้ 1–5 ครั้ง; ค่าเริ่มต้นอ่าน module-07-work/figures")
    parser.add_argument("--markdown", help="ตำแหน่ง module-2-conclusion.md")
    parser.add_argument("--evaluation", help="ตำแหน่งไฟล์ evaluation ของ Module 2 หรือ 3")


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
    init = commands.add_parser("init", help="สร้างไฟล์ progress/evaluation สำหรับแก้ใน VS Code")
    init.add_argument("module", choices=("module-1", "module-2", "module-3"))
    init.add_argument("--force", action="store_true", help="เขียนทับไฟล์เดิม")
    init.set_defaults(handler=command_init)
    check = commands.add_parser("check", help="ตรวจ highlights และกราฟในเครื่อง")
    add_module_files(check)
    check.set_defaults(handler=command_check)
    submit = commands.add_parser("submit", help="ส่ง highlights และกราฟให้ผู้สอน")
    add_module_files(submit)
    submit.add_argument("--yes", action="store_true", help="ส่งโดยไม่ถามยืนยันซ้ำ")
    submit.set_defaults(handler=command_submit)
    status = commands.add_parser("status", help="ดูผลตรวจและ feedback")
    status.add_argument("module", choices=("module-1", "module-2", "module-3", "module-7"))
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
