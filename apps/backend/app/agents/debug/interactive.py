"""
Interactive session với Socratic + Answer-Check Agent.
Chạy: python -m src.backend.agents.interactive
"""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

from .. import answer_check

sys.stdout.reconfigure(encoding="utf-8")

load_dotenv(Path(__file__).parents[3] / ".env")

from .. import socratic

DATA_DIR = Path(__file__).parent / "data"

STEPS = ["DESCRIBE", "REASONING", "DDx", "CONCLUSION"]


def load_data():
    with open(DATA_DIR / "cv_findings.json",  encoding="utf-8") as f:
        cv_findings = json.load(f)
    with open(DATA_DIR / "ground_truth.json", encoding="utf-8") as f:
        ground_truth = json.load(f)
    with open(DATA_DIR / "rubric.json",        encoding="utf-8") as f:
        rubric = json.load(f)
    return cv_findings, ground_truth, rubric


def print_step_answer(step_code: str, ground_truth: dict):
    gt = ground_truth.get(step_code, {})
    print(f"\n  {'─'*50}")
    print(f"  ĐÁP ÁN [{step_code}]")
    print(f"  {gt.get('expected_finding', '')}")
    print(f"  {'─'*50}\n")


def print_image_context():
    print("\n" + "="*60)
    print("CASE: X-quang ngực thẳng (PA view)")
    print("Bệnh nhân: Nữ, 50 tuổi, khó thở tiến triển 3 tuần")
    print("="*60)


def run_session():
    cv_findings, ground_truth, rubric = load_data()

    print_image_context()
    print("\nNhập 'skip' để bỏ qua bước, 'quit' để thoát.\n")

    previous_steps = []
    step_results   = []   # [{step, score, passed}]

    for step_index, step_code in enumerate(STEPS):
        print(f"\n{'─'*60}")
        print(f"Bước {step_index + 1}/{len(STEPS)}: {step_code}")
        print(f"{'─'*60}")

        current_question = socratic.get_opening_question(step_code, step_index)
        print(f"\nAgent: {current_question}\n")

        hint_count    = 0
        last_answer   = ""
        step_attempts = []   # accumulate answers within this step

        while True:
            try:
                user_input = input("Bạn: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nKết thúc session.")
                return

            if user_input.lower() == "quit":
                print("\nKết thúc session.")
                return

            if user_input.lower() == "skip":
                print("→ Bỏ qua bước này.\n")
                break

            if not user_input:
                continue

            # ── Intent classification ─────────────────────────────────────────
            classified = socratic.classify_and_respond(
                user_input=user_input,
                step_name=step_code,
                step_index=step_index,
                current_question=current_question,
            )
            intent   = classified["intent"]
            response = classified["response"]

            if intent in ("question", "chit-chat"):
                print(f"\nAgent: {response}\n")
                continue

            # ── Resolve answer ────────────────────────────────────────────────
            if intent == "revise" and last_answer:
                answer_to_eval = f"[Sửa lại] {user_input}"
            else:
                answer_to_eval = user_input

            last_answer = answer_to_eval
            step_attempts.append(answer_to_eval)

            # ── Evaluate (silent — no display yet) ───────────────────────────
            result = answer_check.evaluate(
                student_answer=answer_to_eval,
                step_code=step_code,
                step_index=step_index,
                rubric=rubric[step_code],
                answer_key=ground_truth[step_code],
                cv_findings=cv_findings,
                previous_steps=previous_steps,
                step_attempts=step_attempts[:-1],
                is_last_step=(step_index == len(STEPS) - 1),
            )

            if result["passed"]:
                # ── Pass: show full result ────────────────────────────────────
                score_bar = "█" * int(result["score"] * 10) + "░" * (10 - int(result["score"] * 10))
                print(f"\n  Score: [{score_bar}] {result['score']:.0%}  |  ✓ PASS")
                if result["positive_feedback"]:
                    print(f"  + {result['positive_feedback']}")
                if result["could_add"]:
                    print(f"  ~ Có thể bổ sung: {result['could_add']}")
                if result["next_step_preview"]:
                    print(f"\n  → {result['next_step_preview']}")
                print()
                step_results.append({"step": step_code, "score": result["score"], "passed": True})
                previous_steps.append({"step": step_code, "answer": " | ".join(step_attempts)})
                print_step_answer(step_code, ground_truth)
                break

            # ── Fail: generate hint THEN increment count ──────────────────────
            if hint_count >= 3:
                score_bar = "█" * int(result["score"] * 10) + "░" * (10 - int(result["score"] * 10))
                print(f"\n  Score: [{score_bar}] {result['score']:.0%}  |  ✗ FAIL")
                if result["positive_feedback"]:
                    print(f"  + {result['positive_feedback']}")
                if result["could_add"]:
                    print(f"  ~ Có thể bổ sung: {result['could_add']}")
                print(f"\n  [Đã nhận {hint_count} hint → chuyển bước tiếp theo]\n")
                step_results.append({"step": step_code, "score": result["score"], "passed": False})
                previous_steps.append({"step": step_code, "answer": " | ".join(step_attempts)})
                print_step_answer(step_code, ground_truth)
                break

            hint = socratic.get_hint(
                step_name=step_code,
                step_index=step_index,
                errors=result["errors"],
                hint_count=hint_count + 1,
                step_attempts=step_attempts,
            )
            hint_count += 1
            print(f"  [errors → hint #{hint_count}: {result['errors']}]")
            print(f"\nAgent: {hint}\n")

    # ── Session summary ───────────────────────────────────────────────────────
    total = sum(r["score"] for r in step_results)
    max_steps = len(step_results)
    avg = total / max_steps if max_steps else 0

    print("\n" + "="*60)
    print("KẾT QUẢ TOÀN SESSION")
    print("="*60)

    for r in step_results:
        bar    = "█" * int(r["score"] * 10) + "░" * (10 - int(r["score"] * 10))
        status = "✓" if r["passed"] else "✗"
        print(f"  {status} {r['step']:<12} [{bar}] {r['score']:.0%}")

    print(f"\n  Điểm trung bình: {avg:.0%}")
    print()

    print("ĐÁP ÁN CHUẨN TỪNG BƯỚC")
    print("─"*60)
    for step_code in STEPS:
        gt = ground_truth.get(step_code, {})
        print(f"\n[{step_code}]")
        print(f"  {gt.get('expected_finding', '')}")

    print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    run_session()
