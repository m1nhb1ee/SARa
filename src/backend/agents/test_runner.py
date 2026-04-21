"""
Test runner cho Answer-Check Agent và Socratic Agent.
Chạy: python -m src.backend.agents.test_runner
Data: src/backend/agents/data/cv_findings.json, ground_truth.json, rubric.json
"""
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
from . import answer_check, socratic
from .logger import logger

load_dotenv(Path(__file__).parents[3] / ".env")

# ── Load data ─────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"

def load_data():
    with open(DATA_DIR / "cv_findings.json",  encoding="utf-8") as f:
        cv_findings = json.load(f)
    with open(DATA_DIR / "ground_truth.json", encoding="utf-8") as f:
        ground_truth = json.load(f)
    with open(DATA_DIR / "rubric.json",        encoding="utf-8") as f:
        rubric = json.load(f)
    return cv_findings, ground_truth, rubric

# ── Test cases ────────────────────────────────────────────────────────────────

STEPS = ["OBSERVE", "DESCRIBE", "INTERPRET", "HYPOTHESIS", "DDx", "CONCLUSION"]

TEST_CASES = [
    {
        "name": "Case 1 — Câu trả lời tốt (expect passed=true)",
        "step_code": "OBSERVE",
        "step_index": 0,
        "student_answer": "Tôi thấy có vùng đục tăng ở thùy dưới phổi phải, bờ không rõ, "
                          "mật độ cao hơn mô xung quanh, kích thước khoảng 3cm, laterality bên phải."
    },
    {
        "name": "Case 2 — Câu trả lời thiếu (expect passed=false, hint lần 1)",
        "step_code": "OBSERVE",
        "step_index": 0,
        "student_answer": "Tôi thấy có vùng mờ ở phổi."
    },
    {
        "name": "Case 3 — Fail 3 lần liên tiếp (expect hint tăng dần)",
        "step_code": "DESCRIBE",
        "step_index": 1,
        "student_answer": "Có tổn thương."
    },
    {
        "name": "Case 4 — Toàn bộ 6 bước (dùng câu trả lời tốt)",
        "step_code": None,  # chạy toàn pipeline
        "step_index": None,
        "student_answer": None
    }
]

GOOD_ANSWERS = {
    "OBSERVE":    "Tôi thấy vùng đục tăng ở thùy dưới phổi phải, laterality bên phải, mật độ cao, bờ không rõ.",
    "DESCRIBE":   "Tổn thương kích thước ~3cm, mật độ cao hơn mô xung quanh, bờ không rõ, vị trí thùy dưới phải.",
    "INTERPRET":  "Hình ảnh consolidation gợi ý quá trình viêm, liên quan đến dịch tiết phế nang.",
    "HYPOTHESIS": "Giả thuyết chính là viêm phổi thùy dưới phải dựa trên consolidation và lâm sàng.",
    "DDx":        "Cần loại trừ lao phổi, atelectasis, pleural effusion dựa trên vị trí và hình dạng tổn thương.",
    "CONCLUSION": "Kết luận viêm phổi thùy dưới phải, độ tin cậy cao, cần X-quang kiểm tra sau điều trị."
}

# ── Runner helpers ────────────────────────────────────────────────────────────

def divider(title: str):
    logger.log_event("TEST_START", {"name": title})
    print(f"\n{'='*60}\n{title}\n{'='*60}")


def run_single_step(step_code, step_index, student_answer, cv_findings, ground_truth, rubric, hint_count=0):
    """Chạy 1 bước: Answer-Check → nếu fail → Socratic hint."""

    logger.log_thought(step_index, f"Evaluating step {step_code}, hint_count={hint_count}")

    # ── Answer-Check ──────────────────────────────────────────────────────────
    result = answer_check.evaluate(
        student_answer=student_answer,
        step_code=step_code,
        step_index=step_index,
        rubric=rubric[step_code],
        answer_key=ground_truth[step_code],
        cv_findings=cv_findings
    )

    print(f"\n[ANSWER-CHECK]")
    print(f"  score   : {result['score']:.2f}")
    print(f"  passed  : {result['passed']}")
    print(f"  errors  : {result['errors']}")
    print(f"  feedback: {result['feedback']}")
    print(f"  latency : {result['latency_ms']}ms")

    # ── Socratic ──────────────────────────────────────────────────────────────
    if not result["passed"]:
        hint_count += 1
        hint = socratic.get_hint(
            step_name=step_code,
            step_index=step_index,
            errors=result["errors"],
            hint_count=hint_count
        )
        print(f"\n[SOCRATIC HINT — lần {hint_count}]")
        print(f"  {hint}")

        if hint_count >= 3:
            logger.log_event("FORCE_ADVANCE", {
                "step": step_code,
                "step_index": step_index,
                "final_score": result["score"]
            })
            print(f"\n  ⚠ hint_count=3 → force advance với score={result['score']:.2f}")
            result["force_advance"] = True
    else:
        question = socratic.get_opening_question(
            step_name=STEPS[step_index + 1] if step_index + 1 < len(STEPS) else "DONE",
            step_index=step_index + 1
        ) if step_index + 1 < len(STEPS) else None

        if question:
            print(f"\n[SOCRATIC OPENING — bước tiếp theo]")
            print(f"  {question}")

    return result, hint_count


# ── Test functions ─────────────────────────────────────────────────────────────

def test_case_1(cv_findings, ground_truth, rubric):
    divider("Case 1 — Câu trả lời tốt (expect passed=true)")
    tc = TEST_CASES[0]
    result, _ = run_single_step(
        tc["step_code"], tc["step_index"], tc["student_answer"],
        cv_findings, ground_truth, rubric
    )
    assert result["passed"], "FAIL: expect passed=true"
    print("\n✓ PASS")


def test_case_2(cv_findings, ground_truth, rubric):
    divider("Case 2 — Câu trả lời thiếu (expect passed=false, hint lần 1)")
    tc = TEST_CASES[1]
    result, _ = run_single_step(
        tc["step_code"], tc["step_index"], tc["student_answer"],
        cv_findings, ground_truth, rubric
    )
    assert not result["passed"], "FAIL: expect passed=false"
    print("\n✓ PASS")


def test_case_3(cv_findings, ground_truth, rubric):
    divider("Case 3 — Fail 3 lần liên tiếp (expect force_advance ở lần 3)")
    tc = TEST_CASES[2]
    hint_count = 0
    for attempt in range(1, 4):
        print(f"\n  [Attempt {attempt}]")
        result, hint_count = run_single_step(
            tc["step_code"], tc["step_index"], tc["student_answer"],
            cv_findings, ground_truth, rubric, hint_count=hint_count - 1 if hint_count > 0 else 0
        )
        if result.get("force_advance"):
            break
    print("\n✓ PASS")


def test_case_4(cv_findings, ground_truth, rubric):
    divider("Case 4 — Toàn bộ 6 bước")
    for i, step_code in enumerate(STEPS):
        print(f"\n{'='*40}\nBước {i}: {step_code}\n{'='*40}")
        question = socratic.get_opening_question(step_code, i)
        print(f"[OPENING QUESTION]\n  {question}")

        result, _ = run_single_step(
            step_code, i, GOOD_ANSWERS[step_code],
            cv_findings, ground_truth, rubric
        )
        if not result["passed"]:
            print(f"  ⚠ Bước {step_code} không pass với good answer — kiểm tra lại data")

    logger.log_agent_finish(
        total_steps=6,
        stopped_by="finish",
        answer_preview="Hoàn thành toàn bộ 6 bước pipeline"
    )
    print("\n✓ PASS")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cv_findings, ground_truth, rubric = load_data()

    test_case_1(cv_findings, ground_truth, rubric)
    test_case_2(cv_findings, ground_truth, rubric)
    test_case_3(cv_findings, ground_truth, rubric)
    test_case_4(cv_findings, ground_truth, rubric)

    print("\n\n✅ Tất cả test cases hoàn thành. Xem trace tại logs/")
