"""
Test runner cho Answer-Check Agent và Socratic Agent.
Chạy: python -m src.backend.agents.test_runner
Data: src/backend/agents/data/cv_findings.json, ground_truth.json, rubric.json
"""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

from .. import answer_check

sys.stdout.reconfigure(encoding="utf-8")
from .. import socratic
from .logger import logger

load_dotenv(Path(__file__).parents[3] / ".env")

DATA_DIR = Path(__file__).parent / "data"
STEPS = ["OBSERVE", "DESCRIBE", "INTERPRET", "HYPOTHESIS", "DDx", "CONCLUSION"]

def load_data():
    with open(DATA_DIR / "cv_findings.json",  encoding="utf-8") as f:
        cv_findings = json.load(f)
    with open(DATA_DIR / "ground_truth.json", encoding="utf-8") as f:
        ground_truth = json.load(f)
    with open(DATA_DIR / "rubric.json",        encoding="utf-8") as f:
        rubric = json.load(f)
    return cv_findings, ground_truth, rubric

# ── Semantic equivalence answers — đúng nghĩa, khác từ ──────────────────────
# Mục tiêu: kiểm tra model có chấm theo nghĩa hay theo keyword cứng

SEMANTIC_ALT = {
    "OBSERVE": (
        # Không dùng 'mờ đục', 'mediastinal shift' — dùng ngôn ngữ thông thường
        "Bên trái tối hơn bên phải rất rõ, gần như toàn bộ trường phổi trái bị che. "
        "Tim và khí quản có vẻ bị đẩy lệch sang phía phổi còn sáng."
    ),
    "DESCRIBE": (
        # Không dùng 'meniscus sign', 'costophrenic angle' — mô tả hình dạng trực tiếp
        "Vùng trắng bên trái có đường viền trên cong lõm hướng lên, trông như hình lưỡi liềm. "
        "Góc dưới bên trái bị lấp hoàn toàn. Cấu trúc giữa ngực bị đẩy sang phải. "
        "Phổi phải vẫn thấy rõ, không có tổn thương."
    ),
    "INTERPRET": (
        # Không dùng 'pleural effusion', 'massive' — diễn giải bằng cơ chế
        "Có lẽ có dịch tích tụ bên khoang trái, lượng nhiều đến mức đẩy cấu trúc giữa sang phải. "
        "Diễn tiến chậm vài tuần phù hợp với nguyên nhân mạn tính hơn là nhiễm trùng cấp. "
        "Khó thở do phổi trái bị chèn ép dần."
    ),
    "HYPOTHESIS": (
        # Không dùng 'malignant', 'ung thư vú' — dùng mô tả lâm sàng gián tiếp
        "Bệnh nhân nữ 50 tuổi, dịch lượng lớn một bên, tiến triển nhiều tuần → "
        "nghĩ đến nguyên nhân từ khối u nhiều hơn là nhiễm trùng. "
        "Tuyến vú là vị trí cần tầm soát đầu tiên ở độ tuổi này."
    ),
    "DDx": (
        # Không dùng 'Light's criteria', 'chylothorax' — dùng mô tả thực chất
        "Ngoài khối u, cần nghĩ đến lao màng phổi vì phổ biến ở Việt Nam. "
        "Tràn máu sau chấn thương cần hỏi tiền sử. "
        "Suy tim hoặc xơ gan ít khả năng vì dịch một bên và lượng rất lớn. "
        "Cần chọc dò để xác định dịch tiết hay dịch thấm."
    ),
    "CONCLUSION": (
        # Không dùng 'malignant exudate', 'CECT' — dùng từ lay/clinical mô tả
        "Tràn dịch màng phổi trái lớn, nghi ngờ từ ung thư. "
        "Cần siêu âm vú, chọc dò chẩn đoán để xem protein và LDH dịch, "
        "và chụp cắt lớp toàn thân để tìm nguồn gốc khối u."
    ),
}

# ── Good answers (reference, should always pass) ─────────────────────────────

GOOD_ANSWERS = {
    "OBSERVE": (
        "Toàn bộ phổi trái mờ đục, phổi phải sáng bình thường. "
        "Có sự bất đối xứng rõ rệt giữa 2 bên. Trung thất lệch sang phải."
    ),
    "DESCRIBE": (
        "Large left-sided pleural effusion với meniscus sign rõ ràng. "
        "Bờ trên vùng mờ hình lõm hướng lên. Góc sườn hoành trái bị xóa. "
        "Mediastinal shift sang phải. Phổi phải còn sáng."
    ),
    "INTERPRET": (
        "Dịch tích tụ lớn trong khoang màng phổi trái đẩy trung thất sang phải — massive pleural effusion. "
        "Diễn tiến chậm gợi ý nguyên nhân mạn tính. Dịch tự do theo meniscus."
    ),
    "HYPOTHESIS": (
        "Nữ 50 tuổi + massive pleural effusion + diễn tiến chậm → malignant pleural effusion. "
        "Breast cancer là nguyên nhân hàng đầu cần loại trừ."
    ),
    "DDx": (
        "Malignant exudate (breast ca, lung ca, lymphoma) là khả năng cao nhất. "
        "Loại trừ: tuberculous empyema, chylothorax, haemothorax. "
        "Phân biệt exudate vs transudate bằng Light's criteria."
    ),
    "CONCLUSION": (
        "Large left-sided pleural effusion, most likely malignant exudate. "
        "Cần: khám vú, diagnostic thoracentesis với Light's criteria, CECT toàn thân."
    ),
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def divider(title: str):
    logger.log_event("TEST_START", {"name": title})
    print(f"\n{'='*60}\n{title}\n{'='*60}")

def check(step_code, step_index, answer, cv_findings, ground_truth, rubric,
          previous_steps=None, step_attempts=None):
    result = answer_check.evaluate(
        student_answer=answer,
        step_code=step_code,
        step_index=step_index,
        rubric=rubric[step_code],
        answer_key=ground_truth[step_code],
        cv_findings=cv_findings,
        previous_steps=previous_steps or [],
        step_attempts=step_attempts or [],
        is_last_step=(step_index == len(STEPS) - 1),
    )
    print(f"  score={result['score']:.2f}  passed={result['passed']}  errors={result['errors']}")
    print(f"  feedback: {result['feedback']}")
    if result["positive_feedback"]:
        print(f"  +  {result['positive_feedback']}")
    return result

# ── Group A: Semantic equivalence — đúng nghĩa, khác từ ──────────────────────

def test_semantic_observe(cv, gt, rubric):
    divider("SEM-1 | OBSERVE — lay terms, không dùng 'mờ đục'/'mediastinal shift'")
    r = check("OBSERVE", 0, SEMANTIC_ALT["OBSERVE"], cv, gt, rubric)
    print(f"  → {'✓ PASS (model chấm theo nghĩa)' if r['passed'] else '✗ FAIL (model bị anchor vào keyword)'}")

def test_semantic_describe(cv, gt, rubric):
    divider("SEM-2 | DESCRIBE — mô tả hình dạng, không dùng 'meniscus sign'")
    r = check("DESCRIBE", 1, SEMANTIC_ALT["DESCRIBE"], cv, gt, rubric)
    print(f"  → {'✓ PASS' if r['passed'] else '✗ FAIL'}")

def test_semantic_interpret(cv, gt, rubric):
    divider("SEM-3 | INTERPRET — cơ chế đúng, không dùng 'pleural effusion'")
    r = check("INTERPRET", 2, SEMANTIC_ALT["INTERPRET"], cv, gt, rubric)
    print(f"  → {'✓ PASS' if r['passed'] else '✗ FAIL'}")

def test_semantic_hypothesis(cv, gt, rubric):
    divider("SEM-4 | HYPOTHESIS — hướng đúng, không dùng 'malignant'")
    r = check("HYPOTHESIS", 3, SEMANTIC_ALT["HYPOTHESIS"], cv, gt, rubric)
    print(f"  → {'✓ PASS' if r['passed'] else '✗ FAIL'}")

def test_semantic_ddx(cv, gt, rubric):
    divider("SEM-5 | DDx — liệt kê đúng + lý luận, không dùng 'Light's criteria'")
    r = check("DDx", 4, SEMANTIC_ALT["DDx"], cv, gt, rubric)
    print(f"  → {'✓ PASS' if r['passed'] else '✗ FAIL'}")

def test_semantic_conclusion(cv, gt, rubric):
    divider("SEM-6 | CONCLUSION — đúng hướng, không dùng 'malignant exudate'/'CECT'")
    r = check("CONCLUSION", 5, SEMANTIC_ALT["CONCLUSION"], cv, gt, rubric)
    print(f"  → {'✓ PASS' if r['passed'] else '✗ FAIL'}")

# ── Group B: Score gate & hint flow ──────────────────────────────────────────

def test_good_answer_passes(cv, gt, rubric):
    divider("GATE-1 | Answer tốt phải pass — tất cả 6 bước")
    for i, step_code in enumerate(STEPS):
        r = check(step_code, i, GOOD_ANSWERS[step_code], cv, gt, rubric)
        assert r["passed"], f"FAIL: {step_code} good answer không pass, score={r['score']}"
    print("\n✓ PASS — tất cả 6 bước pass với good answer")

def test_empty_answer_fails(cv, gt, rubric):
    divider("GATE-2 | Answer rỗng phải fail với score thấp")
    for i, step_code in enumerate(STEPS):
        r = check(step_code, i, ".", cv, gt, rubric)
        assert not r["passed"], f"FAIL: {step_code} answer rỗng vẫn pass"
        assert r["score"] < 0.3, f"FAIL: {step_code} score={r['score']} quá cao cho answer rỗng"
    print("\n✓ PASS — tất cả bước fail đúng với answer rỗng")

def test_noise_answer_fails(cv, gt, rubric):
    divider("GATE-3 | Answer hoàn toàn sai topic (ung thư não ở bước ngực)")
    for step_code, step_index in [("OBSERVE", 0), ("DDx", 4)]:
        r = check(step_code, step_index, "Tôi thấy khối u ở não, vùng trán trái.", cv, gt, rubric)
        assert not r["passed"], f"FAIL: {step_code} noise answer vẫn pass"
    print("\n✓ PASS — noise answer fail đúng")

def test_hint_count_increments_after_hint(cv, gt, rubric):
    divider("GATE-4 | hint_count chỉ tăng SAU KHI hint được generate")
    weak_answer = "Có gì đó bất thường."
    hint_count = 0
    for attempt in range(1, 4):
        r = check("OBSERVE", 0, weak_answer, cv, gt, rubric)
        if not r["passed"]:
            hint = socratic.get_hint("OBSERVE", 0, r["errors"], hint_count + 1)
            hint_count += 1
            print(f"  hint #{hint_count}: {hint[:60]}...")
            if hint_count >= 3:
                print("  → force advance")
                break
    assert hint_count == 3, f"FAIL: hint_count={hint_count}, expected 3"
    print("\n✓ PASS")

def test_accumulate_across_attempts(cv, gt, rubric):
    divider("GATE-5 | Accumulate attempts — score phải tăng khi thêm info đúng")
    attempt_1 = "Phổi trái bất thường."
    attempt_2 = "Toàn bộ trường phổi trái trắng, phổi phải sáng bình thường."

    r1 = check("OBSERVE", 0, attempt_1, cv, gt, rubric, step_attempts=[])
    r2 = check("OBSERVE", 0, attempt_2, cv, gt, rubric, step_attempts=[attempt_1])
    assert r2["score"] >= r1["score"], \
        f"FAIL: score không tăng khi thêm info đúng ({r1['score']:.2f} → {r2['score']:.2f})"
    print(f"\n✓ PASS — score tăng từ {r1['score']:.2f} → {r2['score']:.2f}")

# ── Group C: Failure modes ────────────────────────────────────────────────────

def test_answer_leak_detection(cv, gt, rubric):
    """
    Failure mode 1: Socratic hint không được leak diagnosis keyword.
    Kiểm tra hint không chứa các từ trong answer_key.
    """
    divider("LEAK-1 | Socratic hint không được chứa diagnosis keyword")
    leak_keywords = [
        "pleural effusion", "malignant", "breast cancer", "ung thư vú",
        "mesothelioma", "lymphoma", "tuberculous", "Light's criteria"
    ]
    weak_answer = "Tôi thấy bên trái có vấn đề."
    r = check("OBSERVE", 0, weak_answer, cv, gt, rubric)

    leaked = []
    for _ in range(3):  # test 3 hints
        hint = socratic.get_hint("OBSERVE", 0, r["errors"], 1)
        print(f"  hint: {hint}")
        for kw in leak_keywords:
            if kw.lower() in hint.lower():
                leaked.append(kw)

    if leaked:
        print(f"\n  ⚠ LEAK DETECTED: {leaked}")
    else:
        print("\n✓ PASS — không phát hiện leak")

def test_premature_diagnosis_penalized(cv, gt, rubric):
    """
    Failure mode đặc biệt: sinh viên kết luận chẩn đoán ở bước INTERPRET.
    Rubric INTERPRET có penalty nếu jump to conclusion.
    """
    divider("RUBRIC-1 | INTERPRET — kết luận sớm phải bị trừ điểm")
    premature = (
        "Đây là malignant pleural effusion do breast cancer. "
        "Cần nhập viện ngay và làm biopsy."
    )
    r = check("INTERPRET", 2, premature, cv, gt, rubric)
    assert not r["passed"] or r["score"] < 0.8, \
        "FAIL: premature diagnosis ở INTERPRET không bị penalize đủ"
    print(f"\n  score={r['score']:.2f} — {'✓ penalized đúng' if r['score'] < 0.8 else '✗ không penalize'}")

def test_partial_answer_partial_score(cv, gt, rubric):
    """
    Failure mode 2: mô tả đúng nhưng thiếu một số criteria → score trung bình.
    """
    divider("RUBRIC-2 | Partial answer → partial score (0.3–0.6)")
    partial_answers = {
        "DESCRIBE": "Có vùng mờ bên trái, bờ cong, góc dưới bị xóa.",  # thiếu size + mediastinal shift
        "DDx":      "Có thể là lao hoặc ung thư.",                       # thiếu reasoning + dangerous dx
        "CONCLUSION": "Tràn dịch màng phổi trái.",                       # thiếu justification + management
    }
    for step_code, answer in partial_answers.items():
        step_index = STEPS.index(step_code)
        r = check(step_code, step_index, answer, cv, gt, rubric)
        in_range = 0.25 <= r["score"] <= 0.65
        print(f"  {step_code}: score={r['score']:.2f} → {'✓ partial score đúng range' if in_range else '✗ ngoài range'}")

# ── Group D: Full pipeline ────────────────────────────────────────────────────

def test_full_pipeline_good(cv, gt, rubric):
    divider("PIPE-1 | Full pipeline 6 bước — good answers")
    previous_steps = []
    all_passed = True
    for i, step_code in enumerate(STEPS):
        q = socratic.get_opening_question(step_code, i)
        print(f"\n[{step_code}] Q: {q[:60]}...")
        r = check(step_code, i, GOOD_ANSWERS[step_code], cv, gt, rubric,
                  previous_steps=previous_steps)
        previous_steps.append({"step": step_code, "answer": GOOD_ANSWERS[step_code]})
        if not r["passed"]:
            print(f"  ⚠ {step_code} không pass với good answer")
            all_passed = False
    logger.log_agent_finish(6, "finish", "Full pipeline good answers")
    print(f"\n{'✓ PASS — tất cả bước pass' if all_passed else '⚠ Một số bước cần xem lại rubric'}")

def test_full_pipeline_semantic(cv, gt, rubric):
    divider("PIPE-2 | Full pipeline 6 bước — semantic alt answers")
    previous_steps = []
    results = {}
    for i, step_code in enumerate(STEPS):
        r = check(step_code, i, SEMANTIC_ALT[step_code], cv, gt, rubric,
                  previous_steps=previous_steps)
        previous_steps.append({"step": step_code, "answer": SEMANTIC_ALT[step_code]})
        results[step_code] = r["passed"]

    passed_count = sum(results.values())
    print(f"\n  Kết quả: {passed_count}/6 bước pass với semantic alt answers")
    for step_code, passed in results.items():
        print(f"  {'✓' if passed else '✗'} {step_code}")
    if passed_count < 4:
        print("  ⚠ Model đang anchor vào keyword — cần review rubric/prompt")

# ── Main ──────────────────────────────────────────────────────────────────────

SUITES = {
    "sem":   [test_semantic_observe, test_semantic_describe, test_semantic_interpret,
              test_semantic_hypothesis, test_semantic_ddx, test_semantic_conclusion],
    "gate":  [test_good_answer_passes, test_empty_answer_fails, test_noise_answer_fails,
              test_hint_count_increments_after_hint, test_accumulate_across_attempts],
    "fail":  [test_answer_leak_detection, test_premature_diagnosis_penalized,
              test_partial_answer_partial_score],
    "pipe":  [test_full_pipeline_good, test_full_pipeline_semantic],
}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=list(SUITES.keys()) + ["all"], default="all",
                        help="sem | gate | fail | pipe | all")
    args = parser.parse_args()

    cv_findings, ground_truth, rubric = load_data()
    kwargs = dict(cv=cv_findings, gt=ground_truth, rubric=rubric)

    suites_to_run = list(SUITES.values()) if args.suite == "all" else [SUITES[args.suite]]
    for suite in suites_to_run:
        for test_fn in suite:
            try:
                test_fn(**kwargs)
            except AssertionError as e:
                print(f"\n✗ AssertionError: {e}")
            except Exception as e:
                print(f"\n✗ ERROR: {e}")

    print("\n\n✅ Test runner hoàn thành. Xem trace tại logs/")
