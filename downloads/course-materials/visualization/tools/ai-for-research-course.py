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
MAX_MATERIAL_BYTES = 10 * 1024 * 1024
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
        # Progress/evaluation forms are created by AIRR itself (same as init), so the
        # learner never has to know about init: create it, then ask for the real answers.
        template = None
        if label == "module-1-progress.json":
            template = INIT_MODULE_1_PROGRESS
        elif label in ("module-2-evaluation.json", "module-3-evaluation.json"):
            template = INIT_EVALUATIONS[label.split("-evaluation")[0]]
        if template is not None and path.name == label:
            write_private_json(path, dict(template))
            raise AIRRError(f"AIRR สร้าง {label} ให้แล้วที่ {path} · ถามผู้เรียนทีละข้อแล้วแก้ค่าในไฟล์ให้ตรงกับคำตอบจริง จากนั้นสั่งคำสั่งเดิมอีกครั้ง")
        raise AIRRError(f"ไม่พบ {label}: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AIRRError(f"{label} ไม่ใช่ JSON ที่อ่านได้") from error
    if not isinstance(value, dict):
        raise AIRRError(f"{label} ต้องเป็น JSON object")
    return value


# Course workspace file map: each module keeps its files in module-0N-work/
# (input/original, input/markdown, output, notes). Older workspaces used
# top-level output/; those files are still found, with a notice.
MODULE_DIRS = {"module-1": "module-01-work", "module-2": "module-02-work", "module-3": "module-03-work", "module-4": "module-04-work"}
LEGACY_OUTPUT = {"module-1": Path("output"), "module-2": Path("output"), "module-3": Path("output") / "module-3"}


def module_output(workspace: Path, module: str) -> Path:
    return workspace / MODULE_DIRS[module] / "output"


def module_file(workspace: Path, module: str, name: str) -> Path:
    current = module_output(workspace, module) / name
    if current.exists():
        return current
    legacy = workspace / LEGACY_OUTPUT[module] / name
    if legacy.exists():
        print(f"AIRR NOTE · ใช้ไฟล์ตำแหน่งเดิม {legacy} ตำแหน่งมาตรฐานใหม่คือ {current}", file=sys.stderr)
        return legacy
    return current


def evaluation_path(workspace: Path, module: str, value: str | None) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    return module_file(workspace, module, f"{module}-evaluation.json")


INIT_MODULE_1_PROGRESS = {"schema_version": "ai-for-research.module-1-progress.v1", "module_id": "module-1", "checks": {"workspace_opened": False, "ai_connected": False, "folder_boundary_understood": False, "text_file_created_and_opened": False}, "completion_status": "could_not_complete", "ai_tool": "codex", "completion_minutes": 1, "token_source": "not_available", "total_tokens": None}

INIT_EVALUATIONS = {
    "module-2": {"ai_tool": "codex", "ai_turns": 1, "retry_count": 0, "completion_minutes": 1, "token_source": "not_available", "input_tokens": None, "output_tokens": None, "total_tokens": None, "completion_status": "completed", "difficulty_rating": 3, "usefulness_rating": 3, "hardest_step": "none"},
    "module-3": {"ai_tool": "codex", "ai_turns": 1, "retry_count": 0, "completion_minutes": 1, "token_source": "not_available", "total_tokens": None, "completion_status": "completed", "difficulty_rating": 3, "usefulness_rating": 3, "hardest_step": "none"},
}


def validate_evaluation(value: dict[str, Any], module: str) -> dict[str, Any]:
    if value == INIT_EVALUATIONS.get(module):
        raise AIRRError(f"{module}-evaluation.json ยังเป็นค่าตัวอย่างจาก airr init ให้แก้ ai_tool, ai_turns, completion_minutes, ความยาก ประโยชน์ และขั้นที่ยากที่สุดตามจริงก่อน")
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
        # Artifact paths are relative to the folder that holds output/:
        # module-03-work/ for the current layout, the workspace for the legacy one.
        root = artifact.parent.parent if artifact.parent.name == "output" else workspace
        command.extend(["--workspace", str(root)])
    result = subprocess.run(command, cwd=workspace, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode != 0:
        raise AIRRError((result.stderr or result.stdout or "LOCAL_CHECK FAIL").strip())


def module_payload(workspace: Path, args: argparse.Namespace) -> tuple[dict[str, Any], str]:
    now = datetime.now(timezone.utc).isoformat()
    if args.module == "module-1":
        path = Path(args.file).expanduser().resolve() if args.file else module_file(workspace, "module-1", "module-1-progress.json")
        progress = load_json(path, "module-1-progress.json")
        required = {"schema_version", "module_id", "checks", "completion_status", "ai_tool", "completion_minutes", "token_source", "total_tokens"}
        if set(progress) != required or progress.get("schema_version") != "ai-for-research.module-1-progress.v1" or progress.get("module_id") != "module-1":
            raise AIRRError("module-1-progress.json ไม่ตรง schema ของ Module 1")
        checks = progress.get("checks")
        if not isinstance(checks, dict) or not all(isinstance(item, bool) for item in checks.values()):
            raise AIRRError("checks ใน module-1-progress.json ต้องเป็น true/false")
        if progress.get("completion_status") != "could_not_complete" and not all(checks.values()):
            missing = ", ".join(name for name, done in checks.items() if not done)
            raise AIRRError(f"สถานะ {progress.get('completion_status')} ต้องติ๊กทุกข้อเป็น true ก่อน ยังไม่ผ่าน: {missing} (ถ้าทำไม่ครบ ให้ใช้ could_not_complete)")
        return {"event_type": "ai_for_research_module_1_progress", "submission_id": str(uuid4()), "client_submitted_at": now, "progress": progress}, str(path)
    if getattr(args, "short", False):
        if args.module not in SHORT_PATH_FILES:
            raise AIRRError("--short ใช้ได้กับ module-2 และ module-3 เท่านั้น")
        counts, paths = short_path_counts(workspace, args.module)
        evaluation = validate_evaluation(load_json(evaluation_path(workspace, args.module, args.evaluation), f"{args.module}-evaluation.json"), args.module)
        progress = {"schema_version": "ai-for-research.short-path-done.v1", "module_id": args.module, "path": "short", "line_counts": counts}
        return {"event_type": "ai_for_research_short_path_done", "submission_id": str(uuid4()), "client_submitted_at": now, "module_evaluation": evaluation, "progress": progress}, ", ".join(paths)
    if args.module == "module-2":
        artifact_path = Path(args.file).expanduser().resolve() if args.file else module_file(workspace, "module-2", "module-2-submission.json")
        markdown = Path(args.markdown).expanduser().resolve() if args.markdown else module_file(workspace, "module-2", "module-2-conclusion.md")
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
        artifact_path = Path(args.file).expanduser().resolve() if args.file else module_file(workspace, "module-3", "module-3-completion.json")
        run_local_validator(workspace, "module-3", artifact_path)
        progress = load_json(artifact_path, "module-3-completion.json")
        evaluation = validate_evaluation(load_json(evaluation_path(workspace, "module-3", args.evaluation), "module-3-evaluation.json"), "module-3")
        return {"event_type": "ai_for_research_module_3_progress", "submission_id": str(uuid4()), "client_submitted_at": now, "module_evaluation": evaluation, "progress": progress}, str(artifact_path)
    if args.module == "module-4":
        root = Path(args.file).expanduser().resolve() if args.file else workspace / "module-04-work"
        progress = module4_progress(workspace, root)
        return {"event_type": "ai_for_research_module_4_done", "submission_id": str(uuid4()), "client_submitted_at": now, "progress": progress}, str(root / "output")
    raise AIRRError("module ไม่รองรับ")


# Short paths used in the one-day workshop (lecture notes): files must exist and
# not be empty; only line counts are sent.
SHORT_PATH_FILES = {
    "module-2": {"meal_card": "module-02-work/output/meal-card.md", "learner_additions": "module-02-work/notes/learner-additions.md"},
    "module-3": {"author_prior": "module-03-work/output/author-prior.md", "diagnosis": "module-03-work/output/problem-statement-diagnosis.md",
                 "revision_table": "module-03-work/output/revision-table.md", "citation_for_m4": "module-03-work/output/citation-for-m4.md"},
}


def short_path_counts(workspace: Path, module: str) -> tuple[dict[str, int], list[str]]:
    counts, missing, paths = {}, [], []
    for key, relative in SHORT_PATH_FILES[module].items():
        path = workspace / relative
        lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()] if path.is_file() else []
        if not lines:
            missing.append(relative)
        counts[key] = len(lines)
        paths.append(str(path))
    if missing:
        raise AIRRError("ทางสั้นยังไม่ครบ ไฟล์ว่างหรือยังไม่มี: " + ", ".join(missing))
    return counts, paths


M4_REGISTER_COLUMNS = ("ref_no", "citation_key", "raw_reference", "openalex_id", "doi", "identity_check", "search_sources", "retracted",
                       "abstract_source", "local_fulltext", "cited_at", "citing_context", "support", "checked_against", "status", "decision", "reviewer")
M4_STATUSES = ("verified", "partially supported", "not supported", "not found", "outdated or superseded", "fabricated / phantom")


def m4_status(value: str) -> str:
    text = " ".join(value.strip().lower().replace("_", " ").split())
    if text.startswith("fabricated") or "phantom" in text:
        return "fabricated / phantom"
    if text.startswith("outdated") or "superseded" in text:
        return "outdated or superseded"
    if text.startswith("partially"):
        return "partially supported"
    if text.startswith("not supported"):
        return "not supported"
    if text.startswith("not found"):
        return "not found"
    if text.startswith("verified"):
        return "verified"
    return "other"


def module4_progress(workspace: Path, root: Path) -> dict[str, Any]:
    """Done-gateway summary for Module 4: checks that 4.1-4.3 produced their files
    and returns counts only. No reference text, abstracts or register rows leave the machine."""
    import csv
    import re
    output = root / "output"
    bib, manual = output / "refs.bib", output / "manual-download.md"
    register, summary = output / "citation-register.csv", output / "citation-register-summary.md"
    missing = [str(path.relative_to(workspace) if path.is_relative_to(workspace) else path) for path in (bib, manual, register, summary) if not path.is_file()]
    if missing:
        raise AIRRError("ยังไม่ครบ sub-module 4.1–4.3 ขาดไฟล์: " + ", ".join(missing))
    references = len(re.findall(r"^\s*@\w+\s*\{", bib.read_text(encoding="utf-8"), flags=re.MULTILINE))
    if references < 1:
        raise AIRRError(f"4.1 ยังไม่เสร็จ: ไม่พบ entry ใน {bib.name}")
    with register.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    headers = {str(name).strip().lower() for name in (rows[0].keys() if rows else [])}
    missing_columns = [name for name in M4_REGISTER_COLUMNS if name not in headers]
    if not rows or missing_columns:
        raise AIRRError("4.3 ยังไม่เสร็จ: citation-register.csv ต้องมีอย่างน้อย 1 แถว และมีทุกคอลัมน์ตาม citation-register-template.csv"
                        + (f" ขาด: {', '.join(missing_columns)}" if missing_columns else ""))
    if not [line for line in summary.read_text(encoding="utf-8").splitlines() if line.strip()]:
        raise AIRRError("4.3 ยังไม่เสร็จ: citation-register-summary.md ยังว่าง")
    status_counts = {name: 0 for name in (*M4_STATUSES, "other")}
    full_text = 0
    for row in rows:
        clean = {str(key).strip().lower(): str(value or "") for key, value in row.items() if key is not None}
        status_counts[m4_status(clean.get("status", ""))] += 1
        full_text += clean.get("checked_against", "").strip().lower().replace(" ", "_") == "full_text"
    if full_text < 1:
        raise AIRRError("4.3 ยังไม่เสร็จ: ต้องตรวจกับฉบับเต็มเองอย่างน้อย 1 รายการ และตั้ง checked_against เป็น full_text")
    pending = len(re.findall(r"^\s*[-*]\s*\[\s\]", manual.read_text(encoding="utf-8"), flags=re.MULTILINE))
    originals = root / "input" / "original"
    practice = "mock" if originals.is_dir() and any(item.name.startswith("mock-paper") for item in originals.iterdir()) else "own_work"
    return {
        "schema_version": "ai-for-research.module-4-done.v1", "module_id": "module-4", "practice": practice,
        "submodules": {"bibtex": True, "fulltext": True, "register": True},
        "counts": {"references": references, "register_rows": len(rows), "checked_full_text": full_text, "manual_download_pending": pending},
        "status_counts": status_counts,
    }


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


def request_bytes(url: str, api_key: str) -> bytes:
    request = Request(url, method="GET", headers={"User-Agent": "AIRR-VS-Code/1", "Authorization": f"Bearer {api_key}"})
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read(MAX_MATERIAL_BYTES + 1)
    except HTTPError as error:
        try:
            detail = json.loads(error.read(MAX_RESPONSE_BYTES).decode("utf-8")).get("detail")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            detail = None
        raise AIRRError(str(detail or f"AIRR ตอบ HTTP {error.code}")) from error
    except (URLError, TimeoutError, OSError) as error:
        raise AIRRError(f"เชื่อมต่อ AIRR ไม่ได้: {error}") from error
    if len(raw) > MAX_MATERIAL_BYTES:
        raise AIRRError("ไฟล์จาก AIRR ใหญ่ผิดปกติ")
    return raw


M4_RULE_FILES = ("citation-audit-rules.md", "citation-register-template.csv")


def command_materials(args: argparse.Namespace) -> None:
    """Fetch module practice files with the AIRR Key (the course pages are login-protected).

    Never overwrites a learner's practice paper or ZIP; course rule files are refreshed.
    """
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    if args.module == "module-2":
        targets = [("module-02-food-evidence.zip", workspace / "module-02-work" / "input" / "original" / "module-02-food-evidence.zip", False)]
    else:
        targets = [(name, workspace / "course-materials" / "module-04" / name, True) for name in M4_RULE_FILES]
        if args.thai:
            targets.append(("mock-paper-th.pdf", workspace / "module-04-work" / "thai-mock" / "input" / "original" / "mock-paper-th.pdf", False))
        else:
            targets.append(("mock-paper.pdf", workspace / "module-04-work" / "input" / "original" / "mock-paper.pdf", False))
    for name, target, replace in targets:
        if target.exists() and not replace:
            print(f"AIRR SKIP · มีไฟล์อยู่แล้ว: {target.relative_to(workspace)}")
            continue
        content = request_bytes(f"{config['api_base']}/modules/{args.module}/materials/{name}", config["api_key"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        print(f"AIRR GET · {target.relative_to(workspace)} ({len(content)} bytes)")
    print(f"AIRR MATERIALS PASS · {args.module}")


def ai_key_path() -> Path:
    # Outside the workspace on purpose: workspaces may be synced or committed.
    return Path.home() / ".airr" / "ai-key.txt"


def command_ai_key(args: argparse.Namespace) -> None:
    """Fetch this learner's OpenRouter key into a private file, never to stdout.

    The AI agent runs this command, so the key must not appear in its output.
    """
    path = ai_key_path()
    if args.clear:
        if path.exists():
            path.unlink()
            print(f"AIRR AI-KEY CLEARED · ลบ {path} แล้ว (key ที่ใส่ใน Cline ยังใช้ได้ตามปกติ)")
        else:
            print("AIRR AI-KEY CLEARED · ไม่มีไฟล์ key ค้างอยู่")
        return
    workspace = resolve_workspace(args.workspace)
    config = read_config(workspace)
    assert config is not None
    value = request_json("POST", f"{config['api_base']}/ai-key", config["api_key"], {})
    key = str(value.get("api_key", ""))
    if not re.fullmatch(r"sk-or-v1-[A-Za-z0-9]{32,128}", key):
        raise AIRRError("AIRR ส่ง AI key ที่รูปแบบไม่ถูกต้อง แจ้งผู้สอน")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        f"{key}\n\n"
        "# บรรทัดแรกคือ OpenRouter API key ของคุณ (ห้ามส่งต่อ ห้ามวางในแชต AI)\n"
        "# 1) คัดลอกบรรทัดแรก  2) วางในช่อง OpenRouter API Key ของ Cline\n"
        "# 3) ทดสอบส่งข้อความใน Cline ได้แล้ว ให้ AI รันคำสั่ง ai-key --clear เพื่อลบไฟล์นี้\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)
    if os.name != "nt":
        path.chmod(0o600)
    print(f"AIRR AI-KEY READY · {value.get('provider')} {value.get('label')} ({value.get('tier')})")
    print(f"file={path}")
    print("ห้ามแสดงหรืออ่านเนื้อหาไฟล์นี้ในแชต · ให้ผู้เรียนเปิดไฟล์เองใน VS Code แล้วคัดลอกบรรทัดแรกไปวางใน Cline")
    if args.open:
        try:
            subprocess.run(["code", "--reuse-window", str(path)], check=False, timeout=30,
                           shell=os.name == "nt")
        except (OSError, subprocess.SubprocessError):
            print("เปิด VS Code อัตโนมัติไม่ได้ · เปิดไฟล์ตาม path ด้านบนเอง")


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
        path = module_file(workspace, "module-1", "module-1-progress.json")
        value = dict(INIT_MODULE_1_PROGRESS)
    elif args.module == "module-2":
        path = evaluation_path(workspace, "module-2", None)
        value = dict(INIT_EVALUATIONS["module-2"])
    else:
        path = evaluation_path(workspace, "module-3", None)
        value = dict(INIT_EVALUATIONS["module-3"])
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
        if args.module == "module-4":
            counts = payload["progress"]["counts"]
            print(f"Module 4: {counts['references']} รายการอ้างอิง · ทะเบียน {counts['register_rows']} แถว · ตรวจฉบับเต็ม {counts['checked_full_text']} · รอดาวน์โหลดเอง {counts['manual_download_pending']}")
            print("AIRR จะส่งเฉพาะสถานะว่าเสร็จและจำนวนนับ ไม่ส่งรายการอ้างอิง abstract หรือทะเบียน")
        else:
            print("AIRR จะส่งเฉพาะ progress summary และแบบประเมิน ไม่ส่งเนื้อหางานหรือไฟล์หลัก")
    if not args.yes and input("ยืนยันส่งงานผ่าน AIRR? [y/N] ").strip().lower() not in {"y", "yes"}:
        print("ยกเลิกการส่งงาน")
        return
    endpoint = "done" if getattr(args, "short", False) else "submissions"
    result = request_json("POST", f"{config['api_base']}/modules/{args.module}/{endpoint}", config["api_key"], payload)
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


HELP_OVERVIEW = """AIRR — เครื่องมือเชื่อม workspace กับคลาส AI for Research

วิธีเรียก (ปกติให้ AI ใน VS Code รันให้ ไม่ต้องพิมพ์เอง)
  Windows:       tools/airr.ps1 <คำสั่ง> ...
  macOS / Linux: tools/airr.sh <คำสั่ง> ...

ลำดับใช้งานทั่วไป
  whoami  → ตรวจว่าเชื่อมกับคลาสไหน (ทำครั้งแรกหลังติดตั้ง)
  init    → สร้างไฟล์ progress/evaluation ของโมดูล แล้วแก้ใน VS Code
  check   → ตรวจไฟล์ในเครื่อง ยังไม่ส่งอะไร
  submit  → ส่งงานให้ผู้สอน (ถามยืนยันก่อนส่ง)
  status  → ดูผลตรวจและ feedback

คำสั่ง
  help [คำสั่ง]   อธิบายการใช้ AIRR หรือคำสั่งที่ระบุ
  whoami          ดูคลาสและบัญชีที่เชื่อมอยู่
  init MODULE     สร้างไฟล์เริ่มต้นของ module-1, module-2 หรือ module-3
  check MODULE    ตรวจไฟล์ในเครื่องก่อนส่ง
  submit MODULE   ส่งงานหรือสถานะให้ผู้สอน
  status MODULE   ดูผลตรวจ module-1/2/3/4/7
  materials MOD   ดาวน์โหลดไฟล์ฝึกของ module-2 หรือ module-4
  ai-key          รับ OpenRouter key ของคุณจากคลาส ลงไฟล์ส่วนตัวสำหรับวางใน Cline
  login / logout  เชื่อมหรือยกเลิก AIRR Key ใน workspace นี้ (ตัวติดตั้งทำให้แล้ว)

ความปลอดภัย
  - AIRR Key เก็บใน .airr/ ของ workspace ห้ามเปิดดู คัดลอก หรือส่งต่อ
  - ai-key ไม่แสดง key บนจอ · เก็บใน ~/.airr/ai-key.txt จนกว่าจะสั่ง ai-key --clear
  - check ไม่ส่งอะไรออกจากเครื่อง · submit ส่งเฉพาะสิ่งที่สรุปให้ดูก่อนยืนยัน

ดูรายละเอียดทีละคำสั่ง: help submit · ดูตัวเลือกทั้งหมด: <คำสั่ง> --help"""

HELP_TOPICS = {
    "help": "help [คำสั่ง]\n  แสดงคำอธิบายภาพรวม หรือคำอธิบายของคำสั่งที่ระบุ เช่น help init",
    "whoami": "whoami\n  ถาม server ว่า AIRR Key ของ workspace นี้ผูกกับบัญชีและคลาสใด และโมดูลไหนเปิดอยู่\n  ใช้ทดสอบหลังติดตั้ง ผู้สอนจะเห็นว่าคุณเชื่อมแล้ว\n  ไม่ส่งไฟล์ใด ๆ · ถ้าแจ้งว่าไม่มี key: สร้าง AIRR Key ในหน้าเว็บแล้วรันคำสั่งติดตั้งซ้ำ",
    "login": "login\n  เชื่อม workspace ด้วย AIRR Key (ระบบจะถามโดยไม่แสดงตัวอักษร)\n  ปกติไม่ต้องใช้ เพราะตัวติดตั้งเชื่อมให้แล้ว",
    "logout": "logout\n  ลบ AIRR Key ออกจาก workspace นี้ ใช้เมื่อเลิกใช้เครื่องหรือ key รั่ว\n  หลัง logout ต้องสร้าง key ใหม่และเชื่อมใหม่ก่อนส่งงาน",
    "init": "init module-1|module-2|module-3 [--force]\n  สร้างไฟล์ progress หรือ evaluation ของโมดูลใน module-0N-work/output/ ให้แก้ใน VS Code\n  ไม่เขียนทับไฟล์เดิม ยกเว้นใส่ --force · ไม่ติดต่อ server\n  ตัวอย่าง: init module-1",
    "check": "check MODULE [--file ...] [--graph ...]\n  ตรวจไฟล์ของโมดูลในเครื่องว่าครบตามรูปแบบก่อนส่ง ไม่ส่งอะไรออกจากเครื่อง\n  ตัวอย่าง: check module-1 · check module-7 --graph module-07-work/figures/fig1.png",
    "submit": "submit MODULE [--yes] [--short]\n  ส่งงานหรือสถานะของโมดูลให้ผู้สอน แสดงสรุปและถามยืนยันก่อนส่ง (--yes = ไม่ถามซ้ำ)\n  Module 1 ส่งเฉพาะเช็กลิสต์และเวลา ไม่ส่งไฟล์งาน · Module 7 ส่ง highlights และกราฟ 1–5 ภาพ\n  --short (Module 2/3) แจ้งว่าเสร็จด้วยจำนวนบรรทัด ไม่ส่งเนื้อหา\n  ตัวอย่าง: submit module-1",
    "status": "status module-1|module-2|module-3|module-4|module-7\n  ดูว่าผู้สอนได้รับงานแล้วหรือยัง ผลตรวจ และ feedback\n  ตัวอย่าง: status module-7",
    "ai-key": "ai-key [--open] [--clear]\n  รับ OpenRouter key ที่ผู้สอนจัดให้ (หนึ่งคนหนึ่ง key รันซ้ำได้ key เดิม) ลงไฟล์ ~/.airr/ai-key.txt\n  ไม่แสดง key บนจอ · --open เปิดไฟล์ใน VS Code · คัดลอกบรรทัดแรกไปวางใน Cline\n  ใส่ใน Cline และทดสอบได้แล้ว: ai-key --clear เพื่อลบไฟล์",
    "materials": "materials module-2|module-4 [--thai]\n  ดาวน์โหลดไฟล์ฝึกของโมดูลลง workspace (ถ้าติดตั้งพร้อม key ไฟล์จะมีอยู่แล้ว)\n  ตัวอย่าง: materials module-4 --thai",
}


def command_help(args: argparse.Namespace) -> None:
    topic = getattr(args, "topic", None)
    if not topic:
        print(HELP_OVERVIEW)
        return
    if topic not in HELP_TOPICS:
        raise AIRRError(f"ไม่รู้จักคำสั่ง {topic}; คำสั่งที่มี: {', '.join(HELP_TOPICS)}")
    print(HELP_TOPICS[topic])


def add_module_files(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("module", choices=("module-1", "module-2", "module-3", "module-4", "module-7"))
    parser.add_argument("--file", help="ตำแหน่งไฟล์หลักของโมดูล; Module 4 คือโฟลเดอร์งาน เช่น module-04-work/thesis-a")
    parser.add_argument("--graph", action="append", help="ระบุกราฟซ้ำได้ 1–5 ครั้ง; ค่าเริ่มต้นอ่าน module-07-work/figures")
    parser.add_argument("--markdown", help="ตำแหน่ง module-2-conclusion.md")
    parser.add_argument("--evaluation", help="ตำแหน่งไฟล์ evaluation ของ Module 2 หรือ 3")
    parser.add_argument("--short", action="store_true", help="Module 2 หรือ 3 ทางสั้นของวันอบรม: แจ้งว่าเสร็จด้วยจำนวนบรรทัดของไฟล์ ไม่ส่งเนื้อหา")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="airr", description="AIRR — AI for Research & Review", epilog="คำอธิบายภาษาไทยทีละขั้น: airr help")
    root.add_argument("--workspace", help="โฟลเดอร์ ai-for-research-workspace; ค่าเริ่มต้นคือโฟลเดอร์ปัจจุบัน")
    root.add_argument("--api-base", default=DEFAULT_API_BASE, help=argparse.SUPPRESS)
    commands = root.add_subparsers(dest="command", required=True)
    help_cmd = commands.add_parser("help", help="อธิบายการใช้ AIRR หรือคำสั่งที่ระบุ")
    help_cmd.add_argument("topic", nargs="?", help="ชื่อคำสั่ง เช่น submit")
    help_cmd.set_defaults(handler=command_help)
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
    materials = commands.add_parser("materials", help="ดาวน์โหลดไฟล์ฝึกของ Module 2 หรือ 4 ด้วย AIRR Key")
    materials.add_argument("module", choices=("module-2", "module-4"))
    materials.add_argument("--thai", action="store_true", help="Module 4: ดาวน์โหลดบทความจำลองภาษาไทยไปที่ module-04-work/thai-mock")
    materials.set_defaults(handler=command_materials)
    ai_key = commands.add_parser("ai-key", help="รับ OpenRouter key ของคุณลงไฟล์ส่วนตัว (ไม่แสดงบนจอ)")
    ai_key.add_argument("--open", action="store_true", help="เปิดไฟล์ key ใน VS Code")
    ai_key.add_argument("--clear", action="store_true", help="ลบไฟล์ key หลังใส่ใน Cline แล้ว")
    ai_key.set_defaults(handler=command_ai_key)
    status = commands.add_parser("status", help="ดูผลตรวจและ feedback")
    status.add_argument("module", choices=("module-1", "module-2", "module-3", "module-4", "module-7"))
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
