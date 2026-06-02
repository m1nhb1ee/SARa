import os
import json
import time
import re
from openai import OpenAI
from .debug.logger import logger
from .config import LLM_PROVIDER, ANSWER_CHECK_MODEL
from app.observability import langfuse_obs


def _sanitize(s: str) -> str:
    return s.encode("utf-8", errors="replace").decode("utf-8")


def _safe_parse_llm_json(raw_text: str) -> dict:
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("Empty LLM response")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        candidate = match.group(0)
        candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError("Invalid JSON from LLM")


def _coerce_score(value) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(score, 1.0))


def _filter_error_codes(errors, valid_error_codes: list[str]) -> list[str]:
    valid = set(valid_error_codes)
    if not isinstance(errors, list):
        return []
    filtered = []
    for code in errors:
        if isinstance(code, str) and code in valid and code not in filtered:
            filtered.append(code)
    return filtered


def _filter_partial_fragments(items, errors: list[str]) -> list[dict]:
    wanted = set(errors)
    if not isinstance(items, list):
        return []
    filtered = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        code = item.get("error_code")
        if code not in wanted or code in seen:
            continue
        filtered.append({
            "error_code": code,
            "fragment": str(item.get("fragment") or ""),
        })
        seen.add(code)
    return filtered


def _filter_criterion_results(items, valid_error_codes: list[str]) -> list[dict]:
    valid = set(valid_error_codes)
    if not isinstance(items, list):
        return []
    filtered = []
    for item in items:
        if not isinstance(item, dict):
            continue
        code = item.get("error_code")
        if code not in valid:
            continue
        status = item.get("status")
        if status not in {"met", "partial", "missing"}:
            status = "missing"
        targets = item.get("missing_targets")
        if not isinstance(targets, list):
            targets = []
        clean_targets = []
        for target in targets[:3]:
            if not isinstance(target, dict):
                continue
            hint_levels = target.get("hint_levels")
            if not isinstance(hint_levels, dict):
                hint_levels = {}
            clean_targets.append({
                "target_id": str(target.get("target_id") or code),
                "status": str(target.get("status") or status),
                "safe_anchor": str(target.get("safe_anchor") or ""),
                "hint_levels": {
                    "1": str(hint_levels.get("1") or ""),
                    "2": str(hint_levels.get("2") or ""),
                    "3": str(hint_levels.get("3") or ""),
                },
            })
        evidence = item.get("student_evidence")
        if isinstance(evidence, str):
            evidence = [evidence] if evidence else []
        elif not isinstance(evidence, list):
            evidence = []
        filtered.append({
            "error_code": code,
            "status": status,
            "score_awarded": _coerce_score(item.get("score_awarded")),
            "student_evidence": [str(value) for value in evidence[:3]],
            "missing_targets": clean_targets,
        })
    return filtered


def _filter_hint_directives(items, errors: list[str]) -> list[dict]:
    wanted = set(errors)
    if not isinstance(items, list):
        return []
    filtered = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        code = item.get("error_code")
        if code not in wanted:
            continue
        target_id = str(item.get("target_id") or code)
        key = (code, target_id)
        if key in seen:
            continue
        do_not_reveal = item.get("do_not_reveal")
        if isinstance(do_not_reveal, str):
            do_not_reveal = [do_not_reveal]
        elif not isinstance(do_not_reveal, list):
            do_not_reveal = ["full diagnosis", "full expected finding"]
        filtered.append({
            "error_code": code,
            "target_id": target_id,
            "student_has": str(item.get("student_has") or ""),
            "missing_target": str(item.get("missing_target") or ""),
            "safe_anchor": str(item.get("safe_anchor") or ""),
            "safe_hint_level_1": str(item.get("safe_hint_level_1") or ""),
            "safe_hint_level_2": str(item.get("safe_hint_level_2") or ""),
            "safe_hint_level_3": str(item.get("safe_hint_level_3") or ""),
            "do_not_reveal": [str(value) for value in do_not_reveal[:5]],
        })
        seen.add(key)
    return filtered

# ── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
Persona:
You are a radiology education evaluator. You assess medical students' answers
at each step of a 4-step diagnostic pipeline. You are strict, objective,
and never reveal the full answer.

Rules:
- Evaluate only the current step, ignore other steps.
- If previous attempts are provided, grade the cumulative answer made from
  previous attempts plus the latest answer. Do not require the latest answer
  to repeat correct points already stated earlier.
- If the latest answer explicitly corrects a conflicting detail from an
  earlier attempt, prefer the latest version for that conflict; otherwise
  take the union of all findings.
- Score must be between 0.0 and 1.0.
- errors[] must only use the exact error_codes provided in the rubric for this step. No other codes allowed.
- feedback must be in Vietnamese, 1-2 sentences, hint direction only.
- criterion_results must describe grading state per rubric criterion:
  status is "met", "partial", or "missing"; score_awarded is normalized 0-1
  for that criterion; student_evidence lists only what the student actually said.
  For partial/missing criteria, include missing_targets[] so the backend can
  focus one sub-target at a time when a criterion has multiple acceptable parts.
- partial_answer_by_error must be filled when the student fails. Return one
  short, non-leaking fragment for each error_code in errors[]. Each fragment
  must align with that specific rubric error.
  These fragments are internal hint seeds, not final feedback. They may name
  one safe anatomic, imaging, or reasoning target needed for that criterion,
  but must not reveal the full expected finding, full diagnosis, or complete
  answer key.
  Ground fragments only in the rubric, answer_key, previous_steps, and the
  cumulative student answer. Never introduce a condition, mechanism, pathology,
  diagnosis, or imaging finding that is absent from those inputs. If no safe
  concrete target is available, use a generic criterion label instead.
- hint_directives must be filled when the student fails. Return one directive
  per missing/partial target that is useful for the next hint. The directives
  are internal only. They may include concrete safe imaging/anatomic anchors
  from answer_key or previous_steps (for example mass effect or midline shift),
  but must not reveal the full diagnosis, full expected finding, or complete
  answer key. Level 1 should be broad, level 2 should name the safe anchor or
  missing information type, and level 3 should state the missing criterion/target
  explicitly while still asking the student to complete the answer.
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
  "criterion_results": [
    {
      "error_code": "<rubric error code>",
      "status": "met" | "partial" | "missing",
      "score_awarded": <float 0.0-1.0 for this criterion>,
      "student_evidence": ["<what the cumulative student answer already includes>"],
      "missing_targets": [
        {
          "target_id": "<stable short id>",
          "status": "partial" | "missing",
          "safe_anchor": "<safe imaging/anatomic/reasoning anchor, not full answer>",
          "hint_levels": {
            "1": "<broad internal hint direction>",
            "2": "<more specific internal hint direction with safe anchor if available>",
            "3": "<explicit missing target/criterion, still not full answer>"
          }
        }
      ]
    }
  ],
  "partial_answer_by_error": [
    {"error_code": "<one error code>", "fragment": "<short non-leaking fragment>"}
  ],
  "hint_directives": [
    {
      "error_code": "<one error code from errors[]>",
      "target_id": "<matches a missing target id if available>",
      "student_has": "<brief summary of what the student has already covered>",
      "missing_target": "<one concrete missing target for this hint>",
      "safe_anchor": "<safe concrete anchor from answer_key/previous_steps/rubric when available>",
      "safe_hint_level_1": "<broad hint direction>",
      "safe_hint_level_2": "<specific hint direction>",
      "safe_hint_level_3": "<explicit criterion/target reveal without full answer>",
      "do_not_reveal": ["full diagnosis", "full expected finding"]
    }
  ],
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
    trace_metadata: dict | None = None,
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
            f"IMPORTANT CUMULATIVE SCORING RULE: Score the union of the previous "
            f"attempts above AND the latest answer below as one cumulative answer. "
            f"The student does not repeat what they already said; each new attempt "
            f"adds to their understanding. Do not mark a criterion missing if it "
            f"was already satisfied in any previous attempt. If the latest answer "
            f"explicitly corrects a conflicting earlier detail, prefer the latest "
            f"version for that conflict. positive_feedback MUST explicitly name "
            f"what was correct across the cumulative attempts, not just the latest one.\n"
        )

    cumulative_attempts = list(step_attempts or []) + [student_answer]
    cumulative_lines = "\n".join(
        f"  Attempt {i+1}: {answer}" for i, answer in enumerate(cumulative_attempts)
    )
    cumulative_answer_section = (
        "\nCUMULATIVE STUDENT ANSWER TO GRADE:\n"
        f"{cumulative_lines}\n"
        "Grade this cumulative answer as a single answer. The latest answer is not a replacement "
        "unless it explicitly corrects a conflicting earlier detail.\n"
    )

    # Extract valid error codes for this step from rubric criteria
    valid_error_codes = [c["error_code"] for c in rubric.get("criteria", []) if "error_code" in c]

    last_step_instruction = (
        "This is the FINAL step. next_step_preview must say "
        "'Bạn đã hoàn thành toàn bộ 4 bước phân tích. Chúc mừng!' — do NOT mention any next step."
        if is_last_step else ""
    )

    user_prompt = _sanitize(f"""Step: {step_code} (index {step_index})

Rubric:
{json.dumps(rubric, ensure_ascii=False)}

Valid error codes for this step (use ONLY these): {valid_error_codes}

Answer key (internal use only, do not expose the full answer):
{json.dumps(answer_key, ensure_ascii=False)}

CV findings (ground truth from image):
{json.dumps(cv_findings, ensure_ascii=True)}
{prev_section}{attempts_section}
Student answer (latest):
\"{student_answer}\"
{cumulative_answer_section}
Evaluate ONLY the cumulative student answer above.

{last_step_instruction}
Evaluate and return JSON.""")

    logger.log_event("TOOL_CALL", {
        "step": step_index,
        "tool": "evaluate_answer",
        "input": {"step_code": step_code, "answer_length": len(student_answer.split())}
    })

    start = time.time()
    with langfuse_obs.generation(
        "answer_check.evaluate",
        model=ANSWER_CHECK_MODEL,
        metadata=langfuse_obs.common_metadata(
            feature="practice",
            agent_name="answer_check",
            provider=LLM_PROVIDER,
            model=ANSWER_CHECK_MODEL,
            step_code=step_code,
            step_index=step_index,
            extra={
                **(trace_metadata or {}),
                "valid_error_codes": valid_error_codes,
                "previous_step_count": len(previous_steps or []),
                "attempt_count": len(step_attempts or []),
                "is_last_step": is_last_step,
            },
        ),
        input={
            "step_code": step_code,
            "student_answer_length": len(student_answer.split()),
            "rubric_criteria_count": len(rubric.get("criteria", [])),
        },
    ) as lf_generation:
        response = client.chat.completions.create(
            model=ANSWER_CHECK_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=1600,
            response_format={"type": "json_object"}
        )
    latency_ms = int((time.time() - start) * 1000)

    usage_metrics = langfuse_obs.usage_from_openai(response)
    usage = response.usage
    cost = langfuse_obs.openai_cost_estimate(
        ANSWER_CHECK_MODEL,
        usage_metrics["prompt_tokens"],
        usage_metrics["completion_tokens"],
    )

    logger.log_llm_metric(
        provider=LLM_PROVIDER,
        model=ANSWER_CHECK_MODEL,
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        latency_ms=latency_ms,
        cost_estimate=cost
    )
    logger.log_step_latency(step_index, "answer_check", "openai", latency_ms)

    json_parse_failed = False
    try:
        raw = _safe_parse_llm_json(response.choices[0].message.content or "")
    except Exception as exc:
        json_parse_failed = True
        logger.log_tool_result(
            step=step_index,
            tool="evaluate_answer",
            success=False,
            result_preview=f"JSON parse failed: {str(exc)}"
        )
        raw = {
            "score": 0.0,
            "passed": False,
            "errors": valid_error_codes[:1] if valid_error_codes else [],
            "feedback": "Hệ thống chấm điểm gặp lỗi định dạng phản hồi. Vui lòng thử lại.",
            "criterion_results": [],
            "partial_answer_by_error": [],
            "hint_directives": [],
            "positive_feedback": "",
            "could_add": "",
            "next_step_preview": "",
        }

    logger.log_tool_result(
        step=step_index,
        tool="evaluate_answer",
        success=True,
        result_preview=json.dumps(raw, ensure_ascii=False)
    )

    raw["score"] = _coerce_score(raw.get("score"))

    passed = raw["score"] >= 0.6   # never trust LLM's passed field — compute from score
    errors = [] if passed else raw.get("errors", [])   # errors must be empty when passed
    partial_answer_by_error = [] if passed else raw.get("partial_answer_by_error", [])
    criterion_results = _filter_criterion_results(raw.get("criterion_results", []), valid_error_codes)
    score = raw["score"]
    errors = [] if passed else _filter_error_codes(errors, valid_error_codes)
    partial_answer_by_error = [] if passed else _filter_partial_fragments(
        partial_answer_by_error,
        errors,
    )
    hint_directives = [] if passed else _filter_hint_directives(
        raw.get("hint_directives", []),
        errors,
    )
    langfuse_obs.update_generation(
        lf_generation,
        response=response,
        model=ANSWER_CHECK_MODEL,
        latency_ms=latency_ms,
        output={
            "score": score,
            "passed": passed,
            "errors": errors,
            "error_count": len(errors),
            "criterion_result_count": len(criterion_results),
            "hint_directive_count": len(hint_directives),
            "json_parse_failed": json_parse_failed,
        },
        metadata={
            "score": score,
            "passed": passed,
            "errors": errors,
            "error_count": len(errors),
            "criterion_result_count": len(criterion_results),
            "hint_directive_count": len(hint_directives),
            "json_parse_failed": json_parse_failed,
        },
    )
    return {
        "score":             score,
        "passed":            passed,
        "errors":            errors,
        "feedback":          "" if passed else raw.get("feedback", ""),
        "criterion_results": criterion_results,
        "partial_answer_by_error": partial_answer_by_error,
        "hint_directives":   hint_directives,
        "positive_feedback": raw.get("positive_feedback", ""),
        "could_add":         raw.get("could_add", ""),
        "next_step_preview": raw.get("next_step_preview", ""),
        "latency_ms":        latency_ms,
    }
