import os
import json
import time
from openai import OpenAI
from .logger import logger


def _sanitize(s: str) -> str:
    return s.encode("utf-8", errors="replace").decode("utf-8")

# ── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
Persona:
You are a radiology education evaluator. You assess medical students' answers
at each step of a 6-step diagnostic pipeline. You are strict, objective,
and never reveal the full answer.

Rules:
- Evaluate only the current step, ignore other steps.
- Score must be between 0.0 and 1.0.
- errors[] must only use the exact error_codes provided in the rubric for this step. No other codes allowed.
- feedback must be in Vietnamese, 1-2 sentences, hint direction only.
- positive_feedback must always be filled — explicitly reference what the student
  said correctly, including referencing their previous steps if relevant.
  If nothing was correct, write an encouraging note on what direction to focus.
- could_add must always be filled — name 1-2 specific things the student could
  have added or improved — do not reveal full answer key.
- next_step_preview must be 1 sentence describing what the NEXT step will ask,
  without revealing the expected answer. Always fill this field.

Capabilities:
- You receive: student_answer, rubric, answer_key, cv_findings.
- You also receive previous_steps[] — earlier answers the student gave.
  Use these to write richer positive_feedback that connects across steps.
- You may use answer_key internally to evaluate but must never expose it.

Constraints:
- Never output the expected_finding or key_points directly.
- Never use disease names or diagnosis terms in feedback or positive_feedback.
- Never output anything outside the JSON schema below.

Output format:
Return pure JSON, no markdown:
{
  "score": <float 0.0-1.0>,
  "passed": <bool>,
  "errors": [<use only the error_codes defined in the rubric criteria for this step>],
  "feedback": "<Vietnamese, 1-2 sentences when failed, no answer leak>",
  "positive_feedback": "<Vietnamese, what student got right — only when passed>",
  "could_add": "<Vietnamese, 1-2 things to make answer more complete — only when passed>",
  "next_step_preview": "<Vietnamese, 1 sentence preview of next step — only when passed>"
}
"""

# ── Tools Schema ─────────────────────────────────────────────────────────────

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_rubric",
            "description": "Lấy rubric chấm điểm cho một bước trong pipeline",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id":    {"type": "string", "description": "ID của case"},
                    "step_index": {"type": "integer", "description": "Thứ tự bước 0-5"}
                },
                "required": ["case_id", "step_index"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_answer_key",
            "description": "Lấy đáp án chuẩn cho một bước. Chỉ Answer-Check Agent được dùng tool này.",
            "parameters": {
                "type": "object",
                "properties": {
                    "case_id":    {"type": "string", "description": "ID của case"},
                    "step_index": {"type": "integer", "description": "Thứ tự bước 0-5"}
                },
                "required": ["case_id", "step_index"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_step_attempt",
            "description": "Ghi kết quả chấm điểm vào step_attempts",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id":  {"type": "string"},
                    "step_index":  {"type": "integer"},
                    "score":       {"type": "number"},
                    "errors":      {"type": "array", "items": {"type": "string"}},
                    "feedback":    {"type": "string"},
                    "latency_ms":  {"type": "integer"}
                },
                "required": ["session_id", "step_index", "score", "errors", "feedback", "latency_ms"]
            }
        }
    }
]

# ── Agent ─────────────────────────────────────────────────────────────────────

def evaluate(
    student_answer: str,
    step_code: str,
    step_index: int,
    rubric: str,
    answer_key: dict,
    cv_findings: dict,
    previous_steps: list | None = None,
    step_attempts: list | None = None,
    is_last_step: bool = False,
) -> dict:
    """
    Gọi GPT-4o chấm điểm câu trả lời sinh viên.
    Trả về: { score, passed, errors[], feedback, positive_feedback, could_add, next_step_preview, latency_ms }
    previous_steps:  [{"step": "OBSERVE", "answer": "..."}] — các bước đã hoàn thành
    step_attempts:   ["attempt 1 text", "attempt 2 text"] — các lần thử trong bước hiện tại
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    prev_section = ""
    if previous_steps:
        lines = "\n".join(
            f"  [{p['step']}]: {p['answer']}" for p in previous_steps
        )
        prev_section = f"\nPrevious steps (context only, do not re-evaluate):\n{lines}\n"

    attempts_section = ""
    if step_attempts:
        lines = "\n".join(f"  Attempt {i+1}: {a}" for i, a in enumerate(step_attempts))
        attempts_section = (
            f"\nStudent's previous attempts at this step:\n"
            f"{lines}\n"
            f"IMPORTANT: Treat all attempts as ONE cumulative answer. "
            f"The student does not repeat what they already said — each new attempt "
            f"adds to their understanding. Score based on the UNION of all findings "
            f"mentioned across all attempts. positive_feedback MUST explicitly name "
            f"what was correct from each attempt, not just the latest one.\n"
        )

    # Extract valid error codes for this step from rubric criteria
    valid_error_codes = [c["error_code"] for c in rubric.get("criteria", []) if "error_code" in c]

    last_step_instruction = (
        "This is the FINAL step. next_step_preview must say "
        "'Bạn đã hoàn thành toàn bộ 6 bước phân tích. Chúc mừng!' — do NOT mention any next step."
        if is_last_step else ""
    )

    user_prompt = _sanitize(f"""Step: {step_code} (index {step_index})

Rubric:
{json.dumps(rubric, ensure_ascii=False)}

Valid error codes for this step (use ONLY these): {valid_error_codes}

Answer key (internal use only, do not expose):
expected_finding: {answer_key.get("expected_finding")}

CV findings (ground truth from image):
{json.dumps(cv_findings, ensure_ascii=True)}
{prev_section}{attempts_section}
Student answer (latest):
\"{student_answer}\"

{last_step_instruction}
Evaluate and return JSON.""")

    logger.log_event("TOOL_CALL", {
        "step": step_index,
        "tool": "evaluate_answer",
        "input": {"step_code": step_code, "answer_length": len(student_answer.split())}
    })

    start = time.time()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt}
        ],
        temperature=0.1,
        max_tokens=300,
        response_format={"type": "json_object"}
    )
    latency_ms = int((time.time() - start) * 1000)

    usage = response.usage
    cost = (usage.prompt_tokens * 0.000005) + (usage.completion_tokens * 0.000015)

    logger.log_llm_metric(
        provider="openai",
        model="gpt-4o",
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        latency_ms=latency_ms,
        cost_estimate=cost
    )
    logger.log_step_latency(step_index, "answer_check", "openai", latency_ms)

    raw = json.loads(response.choices[0].message.content)

    logger.log_tool_result(
        step=step_index,
        tool="evaluate_answer",
        success=True,
        result_preview=json.dumps(raw, ensure_ascii=False)
    )

    passed = raw["score"] >= 0.6   # never trust LLM's passed field — compute from score
    errors = [] if passed else raw.get("errors", [])   # errors must be empty when passed
    return {
        "score":             raw["score"],
        "passed":            passed,
        "errors":            errors,
        "feedback":          "" if passed else raw.get("feedback", ""),
        "positive_feedback": raw.get("positive_feedback", ""),
        "could_add":         raw.get("could_add", ""),
        "next_step_preview": raw.get("next_step_preview", ""),
        "latency_ms":        latency_ms,
    }
