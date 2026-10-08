#!/usr/bin/env python3
"""Validate Module 3 completion and artifact hashes locally; no network use."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "ai-for-research.module-3-completion.v1"
CHECK_KEYS = {"evidence_ready", "problem_statement_reviewed", "candidate_gap_reviewed", "reverse_search_completed", "learner_decision_recorded", "local_validator_passed"}
METRIC_KEYS = {"reference_count", "reference_verified_count", "reference_not_found_count", "reference_unresolved_count", "pdf_downloaded_count", "pdf_missing_count", "markdown_reference_count", "citation_count", "citation_without_reference_count", "citation_supported_count", "citation_partial_count", "citation_not_supported_count", "citation_not_checkable_count", "quartile_available_count", "quartile_not_applicable_count", "quartile_unresolved_count", "h_index_available_count", "h_index_not_applicable_count", "h_index_unresolved_count", "integrity_retracted_count", "integrity_expression_of_concern_count", "integrity_withdrawn_count", "integrity_corrected_count", "integrity_no_notice_count", "integrity_unresolved_count", "blind_spot_candidate_count", "blind_spot_already_known_count", "blind_spot_new_to_author_count", "blind_spot_rejected_count", "blind_spot_unresolved_count", "classification_dimension_count", "paper_classified_count", "opportunity_candidate_count", "opportunity_weakened_count", "opportunity_rejected_count", "opportunity_directly_aligned_count", "opportunity_extends_scope_count", "opportunity_tests_boundary_count", "opportunity_adjacent_count", "opportunity_unrelated_count", "opportunity_author_endorsed_count", "rq_candidate_count", "rq_dimension_count", "rq_ai_strong_count", "rq_ai_develop_count", "rq_ai_weak_count", "rq_review_agree_count", "rq_review_partly_agree_count", "rq_review_disagree_count", "rq_revised_rating_count", "rq_new_to_author_count", "rq_keep_count", "rq_revise_count", "rq_drop_count"}
FACULTY_FILES = {"refs.bib", "reference-status.csv", "reference-download-report.csv", "citation-audit.csv", "author-prior.md", "reference-quality.csv", "blind-spot-ledger.csv", "reference-quality-assessment.md", "paper-classification.csv", "research-map.md", "seed-problem-statement.md", "opportunity-alignment.csv", "research-opportunity-brief.md", "research-question-candidates.csv", "rq-rating-review.csv"}


class ValidationError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def exact(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    require(isinstance(value, dict), f"{label} ต้องเป็น object")
    require(set(value) == keys, f"{label} ต้องมี field: {', '.join(sorted(keys))}")
    return value


def count(value: Any, maximum: int, label: str) -> int:
    require(isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= maximum, f"{label} ต้องเป็นจำนวนเต็ม 0–{maximum}")
    return value


def validate(payload: Any, workspace: Path) -> dict[str, Any]:
    payload = exact(payload, {"schema_version", "module_id", "route", "checks", "metrics", "artifacts"}, "completion JSON")
    require(payload["schema_version"] == SCHEMA_VERSION and payload["module_id"] == "module-3", "schema/module ไม่ตรงกับ Module 3")
    require(payload["route"] in {"student", "faculty"}, "route ต้องเป็น student หรือ faculty")
    checks = exact(payload["checks"], CHECK_KEYS, "checks")
    require(all(value is True for value in checks.values()), "checks ทุกข้อต้องเป็น true หลังผู้เรียนยืนยันจริง")
    metrics = exact(payload["metrics"], METRIC_KEYS, "metrics")
    limits = {key: 5000 if "citation" in key else 1000 for key in METRIC_KEYS}
    limits["classification_dimension_count"] = 30
    for key in METRIC_KEYS:
        if key.startswith("blind_spot_"):
            limits[key] = 100
    for key in METRIC_KEYS:
        if key.startswith("opportunity_"):
            limits[key] = 4
        if key.startswith("rq_"):
            limits[key] = 12
    for key, value in metrics.items():
        count(value, limits[key], f"metrics.{key}")
    citation_sum = sum(metrics[key] for key in ("citation_supported_count", "citation_partial_count", "citation_not_supported_count", "citation_not_checkable_count"))
    require(citation_sum == metrics["citation_count"], "ผลรวมสถานะ citation ต้องเท่ากับ citation_count")
    reference_sum = sum(metrics[key] for key in ("reference_verified_count", "reference_not_found_count", "reference_unresolved_count"))
    require(reference_sum == metrics["reference_count"], "ผลรวมสถานะ reference ต้องเท่ากับ reference_count")
    quartile_sum = sum(metrics[key] for key in ("quartile_available_count", "quartile_not_applicable_count", "quartile_unresolved_count"))
    require(quartile_sum == metrics["reference_count"], "ผลรวมสถานะ quartile ต้องเท่ากับ reference_count")
    h_index_sum = sum(metrics[key] for key in ("h_index_available_count", "h_index_not_applicable_count", "h_index_unresolved_count"))
    require(h_index_sum == metrics["reference_count"], "ผลรวมสถานะ h-index ต้องเท่ากับ reference_count")
    integrity_sum = sum(metrics[key] for key in ("integrity_retracted_count", "integrity_expression_of_concern_count", "integrity_withdrawn_count", "integrity_corrected_count", "integrity_no_notice_count", "integrity_unresolved_count"))
    require(integrity_sum == metrics["reference_count"], "ผลรวมสถานะ publication integrity ต้องเท่ากับ reference_count")
    blind_spot_sum = sum(metrics[key] for key in ("blind_spot_already_known_count", "blind_spot_new_to_author_count", "blind_spot_rejected_count", "blind_spot_unresolved_count"))
    require(blind_spot_sum == metrics["blind_spot_candidate_count"], "ผลรวมสถานะ blind spot ต้องเท่ากับ blind_spot_candidate_count")
    require(metrics["citation_without_reference_count"] <= metrics["citation_not_checkable_count"], "citation_without_reference ต้องรวมอยู่ใน citation_not_checkable")
    require(metrics["markdown_reference_count"] <= metrics["pdf_downloaded_count"], "จำนวน reference Markdown ต้องไม่เกิน PDF ที่ดาวน์โหลดได้")
    opportunity_sum = sum(metrics[key] for key in ("opportunity_candidate_count", "opportunity_weakened_count", "opportunity_rejected_count"))
    require(payload["route"] != "faculty" or 1 <= opportunity_sum <= 4, "เส้นทาง faculty ต้องประเมิน opportunity 1–4 ข้อ")
    alignment_sum = sum(metrics[key] for key in ("opportunity_directly_aligned_count", "opportunity_extends_scope_count", "opportunity_tests_boundary_count", "opportunity_adjacent_count", "opportunity_unrelated_count"))
    require(alignment_sum == opportunity_sum, "ผลรวม paper-alignment relation ต้องเท่ากับจำนวน opportunity")
    require(metrics["opportunity_author_endorsed_count"] <= opportunity_sum, "จำนวน opportunity ที่ผู้เขียนรับรองต้องไม่เกินจำนวน opportunity")
    require(metrics["rq_dimension_count"] <= metrics["rq_candidate_count"], "จำนวนมิติ RQ ต้องไม่เกินจำนวน RQ")
    rq_ai_sum = sum(metrics[key] for key in ("rq_ai_strong_count", "rq_ai_develop_count", "rq_ai_weak_count"))
    require(rq_ai_sum == metrics["rq_candidate_count"], "ผลรวม band คะแนน AI ต้องเท่ากับจำนวน RQ")
    rq_review_sum = sum(metrics[key] for key in ("rq_review_agree_count", "rq_review_partly_agree_count", "rq_review_disagree_count"))
    require(rq_review_sum == metrics["rq_candidate_count"], "ผลรวมคำตอบต่อ rating ต้องเท่ากับจำนวน RQ")
    rq_decision_sum = sum(metrics[key] for key in ("rq_keep_count", "rq_revise_count", "rq_drop_count"))
    require(rq_decision_sum == metrics["rq_candidate_count"], "ผลรวมคำตัดสิน RQ ต้องเท่ากับจำนวน RQ")
    require(metrics["rq_revised_rating_count"] <= metrics["rq_review_partly_agree_count"] + metrics["rq_review_disagree_count"], "revised rating ต้องมาจาก partly agree หรือ disagree")
    require(metrics["rq_new_to_author_count"] <= metrics["rq_candidate_count"], "RQ ใหม่ต่อผู้เขียนต้องไม่เกินจำนวน RQ")
    require(payload["route"] != "faculty" or 4 <= metrics["rq_candidate_count"] <= 8, "เส้นทาง faculty ต้อง review RQ 4–8 ข้อ")

    artifacts = payload["artifacts"]
    require(isinstance(artifacts, list) and 2 <= len(artifacts) <= 20, "artifacts ต้องมี 2–20 รายการ")
    seen: set[str] = set()
    for index, artifact in enumerate(artifacts, 1):
        artifact = exact(artifact, {"path", "sha256"}, f"artifact {index}")
        relative = str(artifact["path"])
        require(bool(re.fullmatch(r"output/[A-Za-z0-9._/-]+", relative)) and ".." not in Path(relative).parts, f"artifact path ไม่ปลอดภัย: {relative}")
        require(relative not in seen, f"artifact path ซ้ำ: {relative}")
        expected_hash = str(artifact["sha256"])
        require(bool(re.fullmatch(r"[a-f0-9]{64}", expected_hash)), f"SHA-256 ไม่ถูกต้อง: {relative}")
        path = workspace / relative
        require(path.is_file() and path.stat().st_size > 0, f"ไม่พบหรือไฟล์ว่าง: {relative}")
        require(hashlib.sha256(path.read_bytes()).hexdigest() == expected_hash, f"SHA-256 ไม่ตรง: {relative}")
        seen.add(relative)
    names = {Path(path).name for path in seen}
    if payload["route"] == "faculty":
        require(FACULTY_FILES <= names, f"เส้นทาง faculty ขาดไฟล์: {', '.join(sorted(FACULTY_FILES - names))}")
    else:
        require("problem-gap-rq.md" in names, "เส้นทาง student ต้องมี problem-gap-rq.md")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="ตรวจ Module 3 ในเครื่องโดยไม่อัปโหลดงาน")
    parser.add_argument("completion_json", nargs="?", default="output/module-3/module-3-completion.json")
    parser.add_argument("--workspace", default=".")
    args = parser.parse_args()
    try:
        completion = Path(args.completion_json)
        require(completion.is_file(), f"ไม่พบไฟล์ {completion}")
        payload = validate(json.loads(completion.read_text(encoding="utf-8")), Path(args.workspace).resolve())
    except (OSError, UnicodeError, json.JSONDecodeError, ValidationError) as error:
        print(f"LOCAL_CHECK FAIL: {error}", file=sys.stderr)
        return 1
    metrics = payload["metrics"]
    print("LOCAL_CHECK PASS")
    print(json.dumps({"module_id": "module-3", "route": payload["route"], "artifact_count": len(payload["artifacts"]), "reference_count": metrics["reference_count"], "citation_count": metrics["citation_count"], "opportunity_candidate_count": metrics["opportunity_candidate_count"]}, ensure_ascii=False, indent=2))
    print("ไม่มีไฟล์หรือเนื้อหาถูกส่งออกจากเครื่อง")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
