#!/usr/bin/env python3
"""Validate Module 2 artifacts locally without uploading their contents."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "ai-for-research.module-2-submission.v4"
FORMATS = {"pdf", "xlsx", "docx", "image", "web"}
LEVELS = {"L1", "L2", "L3", "L4"}
ANSWER_TYPES = {"evidence_based", "reasoned_judgment", "still_unknown"}


class ValidationError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def exact_keys(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    require(isinstance(value, dict), f"{label} ต้องเป็น object")
    missing = sorted(keys - set(value))
    unknown = sorted(set(value) - keys)
    require(not missing, f"{label} ขาด field: {', '.join(missing)}")
    require(not unknown, f"{label} มี field ที่ไม่รองรับ: {', '.join(unknown)}")
    return value


def bounded_text(value: Any, minimum: int, maximum: int, label: str) -> str:
    text = value.strip() if isinstance(value, str) else ""
    require(minimum <= len(text) <= maximum, f"{label} ต้องยาว {minimum}–{maximum} ตัวอักษร")
    return text


def bounded_count(value: Any, maximum: int, label: str) -> int:
    require(isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= maximum, f"{label} ต้องเป็นจำนวนเต็ม 0–{maximum}")
    return value


def validate_submission(payload: Any) -> dict[str, Any]:
    payload = exact_keys(payload, {"schema_version", "module_id", "artifact", "result", "declaration"}, "JSON ระดับบนสุด")
    require(payload["schema_version"] == SCHEMA_VERSION, "schema_version ไม่ตรงกับ Module 2 รุ่นปัจจุบัน")
    require(payload["module_id"] == "module-2", "module_id ต้องเป็น module-2")

    artifact = exact_keys(payload["artifact"], {"filename", "sha256"}, "artifact")
    require(artifact["filename"] == "module-2-conclusion.md", "artifact.filename ไม่ถูกต้อง")
    require(bool(re.fullmatch(r"[a-f0-9]{64}", str(artifact["sha256"]))), "artifact.sha256 ต้องเป็นเลขฐานสิบหกตัวพิมพ์เล็ก 64 ตัว")

    result = exact_keys(
        payload["result"],
        {"decision", "reason", "claims", "open_questions", "learner_additions", "formats_checked", "web_retrieval", "prompt_test", "human_decision"},
        "result",
    )
    require(result["decision"] in {"conditional_yes", "conditional_no", "insufficient_evidence"}, "result.decision ไม่ถูกต้อง")
    require(result["human_decision"] in {"accept_with_conditions", "reject", "need_more_evidence"}, "result.human_decision ไม่ถูกต้อง")
    require(result["web_retrieval"] in {"live", "fallback"}, "result.web_retrieval ต้องเป็น live หรือ fallback")
    bounded_text(result["reason"], 40, 800, "result.reason")

    claims = result["claims"]
    require(isinstance(claims, list) and 8 <= len(claims) <= 10, "result.claims ต้องมี 8–10 ข้อ")
    claim_ids: set[str] = set()
    observed_levels: set[str] = set()
    for index, raw_claim in enumerate(claims, 1):
        claim = exact_keys(raw_claim, {"id", "text", "level", "sources", "location"}, f"claim {index}")
        claim_id = str(claim["id"])
        require(bool(re.fullmatch(r"C(10|[1-9])", claim_id)) and claim_id not in claim_ids, "claim.id ต้องเป็น C1–C10 และห้ามซ้ำ")
        bounded_text(claim["text"], 10, 500, f"{claim_id}.text")
        require(claim["level"] in LEVELS, f"{claim_id}.level ต้องเป็น L1–L4")
        sources = claim["sources"]
        require(isinstance(sources, list) and len(sources) == len(set(sources)) and all(item in FORMATS for item in sources), f"{claim_id}.sources ไม่ถูกต้อง")
        location = claim["location"].strip() if isinstance(claim["location"], str) else ""
        if claim["level"] == "L4":
            require(not sources and not location, f"{claim_id} ระดับ L4 ต้องไม่มี source และ location")
        else:
            require(bool(sources) and len(location) >= 3, f"{claim_id} ระดับ L1–L3 ต้องมี source และ location")
            require(claim["level"] != "L3" or len(sources) >= 2, f"{claim_id} ระดับ L3 ต้องเชื่อมอย่างน้อยสองแหล่ง")
        claim_ids.add(claim_id)
        observed_levels.add(claim["level"])
    require(observed_levels == LEVELS, "claims ต้องครอบคลุม L1–L4")

    questions = result["open_questions"]
    require(isinstance(questions, list) and 1 <= len(questions) <= 3, "open_questions ต้องมี 1–3 ข้อ")
    question_ids: set[str] = set()
    for index, raw_question in enumerate(questions, 1):
        question = exact_keys(raw_question, {"id", "question", "missing_evidence", "next_prompt"}, f"open_question {index}")
        question_id = str(question["id"])
        require(bool(re.fullmatch(r"U[1-3]", question_id)) and question_id not in question_ids, "open_question.id ต้องเป็น U1–U3 และห้ามซ้ำ")
        bounded_text(question["question"], 15, 300, f"{question_id}.question")
        bounded_text(question["missing_evidence"], 15, 500, f"{question_id}.missing_evidence")
        bounded_text(question["next_prompt"], 30, 1000, f"{question_id}.next_prompt")
        question_ids.add(question_id)

    additions = result["learner_additions"]
    require(isinstance(additions, list) and len(additions) == len(questions), "learner_additions ต้องตอบ open_questions ครบทุกข้อ")
    addition_ids: set[str] = set()
    answered: set[str] = set()
    for index, raw_addition in enumerate(additions, 1):
        addition = exact_keys(raw_addition, {"id", "open_question_id", "answer_type", "learner_answer", "basis", "sources"}, f"learner_addition {index}")
        addition_id = str(addition["id"])
        require(bool(re.fullmatch(r"A[1-3]", addition_id)) and addition_id not in addition_ids, "learner_addition.id ต้องเป็น A1–A3 และห้ามซ้ำ")
        question_id = addition["open_question_id"]
        require(question_id in question_ids and question_id not in answered, f"{addition_id}.open_question_id ไม่ถูกต้องหรือซ้ำ")
        require(addition["answer_type"] in ANSWER_TYPES, f"{addition_id}.answer_type ไม่ถูกต้อง")
        bounded_text(addition["learner_answer"], 20, 500, f"{addition_id}.learner_answer")
        bounded_text(addition["basis"], 20, 500, f"{addition_id}.basis")
        sources = addition["sources"]
        require(isinstance(sources, list) and len(sources) == len(set(sources)) and all(item in FORMATS for item in sources), f"{addition_id}.sources ไม่ถูกต้อง")
        require(addition["answer_type"] != "evidence_based" or bool(sources), f"{addition_id} แบบ evidence_based ต้องมี source")
        addition_ids.add(addition_id)
        answered.add(question_id)

    formats_checked = result["formats_checked"]
    require(isinstance(formats_checked, list) and len(formats_checked) == 5 and set(formats_checked) == FORMATS, "formats_checked ต้องมีห้ารูปแบบอย่างละหนึ่งครั้ง")
    prompt = exact_keys(result["prompt_test"], {"round_1_traceable", "round_1_unsupported", "round_2_traceable", "round_2_unsupported"}, "prompt_test")
    counts = {key: bounded_count(value, 10, f"prompt_test.{key}") for key, value in prompt.items()}
    require(counts["round_1_traceable"] + counts["round_1_unsupported"] == len(claims), "ผลรวม Prompt รอบแรกต้องเท่ากับจำนวน claims")
    require(counts["round_2_traceable"] + counts["round_2_unsupported"] == len(claims), "ผลรวม Prompt รอบสองต้องเท่ากับจำนวน claims")
    no_regression = counts["round_2_traceable"] >= counts["round_1_traceable"] and counts["round_2_unsupported"] <= counts["round_1_unsupported"]
    improved = counts["round_2_traceable"] > counts["round_1_traceable"] and counts["round_2_unsupported"] < counts["round_1_unsupported"]
    perfect_first = counts["round_1_traceable"] == len(claims) and counts["round_1_unsupported"] == 0
    require(no_regression and (improved or perfect_first), "Prompt รอบสองต้องดีขึ้น หรือคงผลเดิมเมื่อรอบแรกสมบูรณ์")

    declaration = exact_keys(payload["declaration"], {"originals_preserved", "claims_checked_by_learner", "learner_additions_written_by_learner", "no_personal_data"}, "declaration")
    require(all(value is True for value in declaration.values()), "declaration ทุกข้อต้องเป็น true หลังผู้เรียนยืนยันจริง")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="ตรวจไฟล์ Module 2 ในเครื่อง โดยไม่อัปโหลดเนื้อหา")
    parser.add_argument("json_file", nargs="?", default="output/module-2-submission.json")
    parser.add_argument("markdown_file", nargs="?", default="output/module-2-conclusion.md")
    args = parser.parse_args()
    json_path = Path(args.json_file)
    markdown_path = Path(args.markdown_file)
    try:
        require(json_path.is_file(), f"ไม่พบไฟล์ {json_path}")
        require(markdown_path.is_file(), f"ไม่พบไฟล์ {markdown_path}")
        require(json_path.stat().st_size <= 64_000, "ไฟล์ JSON ต้องไม่เกิน 64 KB")
        require(markdown_path.stat().st_size <= 32_000, "ไฟล์ Markdown ต้องไม่เกิน 32 KB")
        payload = validate_submission(json.loads(json_path.read_text(encoding="utf-8")))
        markdown_bytes = markdown_path.read_bytes()
        require(len(markdown_bytes.decode("utf-8").strip()) >= 200, "Markdown ต้องมีเนื้อหาอย่างน้อย 200 ตัวอักษร")
        actual_hash = hashlib.sha256(markdown_bytes).hexdigest()
        require(actual_hash == payload["artifact"]["sha256"], "SHA-256 ใน JSON ไม่ตรงกับไฟล์ Markdown")
    except (OSError, UnicodeError, json.JSONDecodeError, ValidationError) as error:
        print(f"LOCAL_CHECK FAIL: {error}", file=sys.stderr)
        return 1

    result = payload["result"]
    print("LOCAL_CHECK PASS")
    print(json.dumps({
        "schema_version": payload["schema_version"],
        "claim_count": len(result["claims"]),
        "open_question_count": len(result["open_questions"]),
        "learner_addition_count": len(result["learner_additions"]),
        "artifact_sha256": payload["artifact"]["sha256"],
    }, ensure_ascii=False, indent=2))
    print("ไม่มีไฟล์หรือเนื้อหาถูกส่งออกจากเครื่อง")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
