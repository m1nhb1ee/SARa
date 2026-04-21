import os
import time
from openai import OpenAI
from .logger import logger


def _sanitize(s: str) -> str:
    """Strip lone surrogate characters that break UTF-8 encoding."""
    return s.encode("utf-8", errors="replace").decode("utf-8")

# ── System Prompts ────────────────────────────────────────────────────────────

SYSTEM_PROMPT_OPENING = """
Persona:
You are a Socratic radiology teacher. You guide medical students to discover
findings themselves through open-ended questions.

Rules:
- Ask exactly ONE question per response.
- Question must be open-ended, cannot be answered with yes/no.
- Question must relate to the current pipeline step.
- Write in Vietnamese.

Capabilities:
- You know the current step name.
- You do not have access to the answer key or expected findings.

Constraints:
- Never state or imply the diagnosis.
- Never use disease names or specific pathology terms.
- Never ask about steps other than the current one.

Output format:
Return the question as plain text only. No explanation, no prefix.
"""

SYSTEM_PROMPT_HINT = """
Persona:
You are a Socratic radiology teacher giving a targeted hint to a student
who answered incorrectly. You guide without revealing the answer.

Rules:
- Ask exactly ONE question that targets a specific missing criterion.
- Increase specificity based on hint_count:
    hint_count=1 → gentle nudge toward the missing area
    hint_count=2 → point directly at the missing element
    hint_count=3 → reveal what was missing explicitly, then ask student to complete
- Write in Vietnamese.

Capabilities:
- You receive: step_name, errors[] as criterion codes, hint_count.
- You do not have access to the answer key.

Constraints:
- Never reveal the full expected answer.
- Never use diagnosis names or pathology terms.
- One question only, plain text.

Output format:
Return the question as plain text only. No explanation, no prefix.
"""

SYSTEM_PROMPT_CLASSIFY = """
Persona:
You are a Socratic radiology teacher reading a student's message during a
structured 6-step diagnostic pipeline session.

Task:
Classify the student's intent AND generate a response that keeps them engaged
in the learning process.

Intent definitions:
- "answer"    : Student is attempting to answer the current step question.
                Contains observations, findings, descriptions, interpretations,
                hypotheses, or diagnoses — even if incomplete or wrong.
- "revise"    : Student is correcting or clarifying their previous answer.
                Signals: "ý tôi là", "sửa lại", "thực ra", "không phải X mà Y",
                "đúng hơn là", "cho tôi sửa", or similar corrections.
- "question"  : Student is asking a conceptual or clarification question.
                Usually ends with "?" and contains a question word.
- "chit-chat" : Short acknowledgment, social response, or off-topic message.
                Examples: "ok", "hiểu rồi", "tiếp theo đi", "cảm ơn".

Response rules:
- "answer" / "revise": response must be empty string "".
  The pipeline will handle evaluation separately.
- "question": answer briefly in Vietnamese (2-3 sentences), then end with a
  follow-up question that steers the student back to the current step task.
  Do NOT reveal diagnosis or answer key.
- "chit-chat": respond warmly in 1 sentence, then re-engage with a Socratic
  question related to the current step — make the student want to think about
  the image again. Do NOT just repeat the original question verbatim.

Goal for question/chit-chat responses:
Always leave the student with something to think about or observe.
Never let the conversation dead-end without a learning nudge.

Capabilities:
- You know the current step name and the question already asked.
- You do NOT have access to the answer key or expected findings.

Output format:
Return pure JSON only, no markdown:
{
  "intent": "answer" | "revise" | "question" | "chit-chat",
  "response": "<string, empty for answer/revise>"
}
"""

# ── Tools Schema ─────────────────────────────────────────────────────────────

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_step_template",
            "description": "Lấy template câu hỏi cứng cho một bước pipeline. Dùng làm base prompt và fallback khi LLM fail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_name": {
                        "type": "string",
                        "description": "Tên bước: OBSERVE | DESCRIBE | INTERPRET | HYPOTHESIS | DDx | CONCLUSION"
                    }
                },
                "required": ["step_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_hint_count",
            "description": "Đọc Redis xem bước này đã hint mấy lần rồi",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string"},
                    "step_index": {"type": "integer"}
                },
                "required": ["session_id", "step_index"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_step_errors",
            "description": "Đọc errors[] từ lần Answer-Check gần nhất của bước đó",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string"},
                    "step_index": {"type": "integer"}
                },
                "required": ["session_id", "step_index"]
            }
        }
    }
]

# ── Fallback templates ────────────────────────────────────────────────────────

STEP_TEMPLATES = {
    "OBSERVE":    "Hãy quan sát toàn bộ hình ảnh. Bạn nhận thấy điều gì bất thường?",
    "DESCRIBE":   "Mô tả chi tiết những gì bạn thấy — vị trí, kích thước, mật độ, bờ.",
    "INTERPRET":  "Những phát hiện này có ý nghĩa lâm sàng gì?",
    "HYPOTHESIS": "Dựa trên những gì bạn thấy, giả thuyết chẩn đoán của bạn là gì?",
    "DDx":        "Ngoài giả thuyết chính, còn những chẩn đoán nào khác cần loại trừ?",
    "CONCLUSION": "Kết luận chẩn đoán cuối cùng của bạn là gì? Bạn tự tin ở mức nào?"
}

# ── Agent ─────────────────────────────────────────────────────────────────────

def get_opening_question(step_name: str, step_index: int) -> str:
    """Câu hỏi mở đầu bước mới. Không cần errors[], không cần answer_key."""
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    user_prompt = _sanitize(f"Current step: {step_name}\nGenerate the opening question for this step.")

    logger.log_event("TOOL_CALL", {
        "step": step_index,
        "tool": "get_opening_question",
        "input": {"step_name": step_name}
    })

    start = time.time()
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_OPENING},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        latency_ms = int((time.time() - start) * 1000)
        usage = response.usage
        cost = (usage.prompt_tokens * 0.000005) + (usage.completion_tokens * 0.000015)

        logger.log_llm_metric("openai", "gpt-4o", usage.prompt_tokens,
                               usage.completion_tokens, latency_ms, cost)
        logger.log_step_latency(step_index, "socratic_opening", "openai", latency_ms)

        question = response.choices[0].message.content.strip()

        logger.log_tool_result(step_index, "get_opening_question", True, question)
        return question

    except Exception as e:
        logger.error(f"Socratic opening failed: {e}")
        return STEP_TEMPLATES.get(step_name, "Hãy tiếp tục với bước này.")


def get_hint(
    step_name: str,
    step_index: int,
    errors: list,
    hint_count: int,
    step_attempts: list | None = None,
) -> str:
    """
    Câu hỏi hint sau khi sinh viên fail.
    hint_count=1 → nhẹ, hint_count=2 → cụ thể, hint_count=3 → reveal criterion.
    step_attempts: các lần trả lời trước trong bước này để tránh hỏi lại điều đã nói.
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    attempts_context = ""
    if step_attempts:
        lines = "\n".join(f"  Attempt {i+1}: {a}" for i, a in enumerate(step_attempts))
        attempts_context = (
            f"\nWhat the student has already mentioned (DO NOT ask about these again):\n"
            f"{lines}\n"
            f"Focus your hint ONLY on criteria that are genuinely missing, "
            f"not on anything the student has already addressed.\n"
        )

    user_prompt = _sanitize(f"""Current step: {step_name}
Missing criteria (error codes): {errors}
Hint count: {hint_count}
{attempts_context}
Generate a targeted hint question.""")

    logger.log_event("TOOL_CALL", {
        "step": step_index,
        "tool": "get_hint",
        "input": {"step_name": step_name, "errors": errors, "hint_count": hint_count}
    })

    start = time.time()
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_HINT},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=150
        )
        latency_ms = int((time.time() - start) * 1000)
        usage = response.usage
        cost = (usage.prompt_tokens * 0.000005) + (usage.completion_tokens * 0.000015)

        logger.log_llm_metric("openai", "gpt-4o", usage.prompt_tokens,
                               usage.completion_tokens, latency_ms, cost)
        logger.log_step_latency(step_index, "socratic_hint", "openai", latency_ms)

        hint = response.choices[0].message.content.strip()

        logger.log_tool_result(step_index, "get_hint", True, hint)
        return hint

    except Exception as e:
        logger.error(f"Socratic hint failed: {e}")
        return STEP_TEMPLATES.get(step_name, "Hãy xem xét kỹ hơn và thử lại.")


def classify_and_respond(
    user_input: str,
    step_name: str,
    step_index: int,
    current_question: str,
) -> dict:
    """
    Classify user intent và generate response nếu cần.
    Returns: { intent: str, response: str }
    intent: "answer" | "revise" | "question" | "chit-chat"
    response: empty string khi intent là answer/revise.
    """
    import json as _json

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    user_prompt = _sanitize(f"""Current step: {step_name}
Current question asked: {current_question}
Student message: {user_input}

Classify intent and generate response.""")

    logger.log_event("TOOL_CALL", {
        "step": step_index,
        "tool": "classify_and_respond",
        "input": {"step_name": step_name, "message_length": len(user_input.split())}
    })

    start = time.time()
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_CLASSIFY},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.4,
            max_tokens=200,
            response_format={"type": "json_object"}
        )
        latency_ms = int((time.time() - start) * 1000)
        usage = response.usage
        cost = (usage.prompt_tokens * 0.000005) + (usage.completion_tokens * 0.000015)

        logger.log_llm_metric("openai", "gpt-4o", usage.prompt_tokens,
                               usage.completion_tokens, latency_ms, cost)
        logger.log_step_latency(step_index, "classify_intent", "openai", latency_ms)

        result = _json.loads(response.choices[0].message.content)
        intent = result.get("intent", "answer")
        resp   = result.get("response", "")

        logger.log_tool_result(step_index, "classify_and_respond", True,
                               f"intent={intent}")
        return {"intent": intent, "response": resp}

    except Exception as e:
        logger.error(f"classify_and_respond failed: {e}")
        return {"intent": "answer", "response": ""}
