"""
SARa Agents — Django wrapper for src.backend.agents
Replaces MockAIAgent / OpenAIAgent with the proper socratic + answer_check agents.
"""
import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Add repo root so `src.backend.agents` is importable from within apps/backend
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

try:
    from src.backend.agents import socratic as _socratic
    from src.backend.agents import answer_check as _answer_check
    _AGENTS_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import SARa agents: {e}")
    _AGENTS_AVAILABLE = False

_RUBRIC_FILE = _REPO_ROOT / "src" / "backend" / "agents" / "data" / "rubric.json"

def _load_rubric() -> dict:
    try:
        with open(_RUBRIC_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load rubric.json: {e}")
        return {}

_RUBRIC = _load_rubric()


def classify_intent(
    user_input: str,
    step_code: str,
    step_index: int,
    current_question: str,
) -> dict:
    """
    Classify student intent before evaluation.
    Returns {'intent': 'answer'|'revise'|'question'|'chit-chat', 'response': str}
    """
    if not _AGENTS_AVAILABLE:
        return {"intent": "answer", "response": ""}
    try:
        return _socratic.classify_and_respond(
            user_input=user_input,
            step_name=step_code,
            step_index=step_index,
            current_question=current_question,
        )
    except Exception as e:
        logger.error(f"classify_intent error: {e}")
        return {"intent": "answer", "response": ""}


def evaluate_answer(
    student_answer: str,
    step_code: str,
    step_index: int,
    answer_key: dict,
    cv_findings: dict,
    previous_steps: list | None = None,
    step_attempts: list | None = None,
    is_last_step: bool = False,
) -> dict:
    """
    Evaluate student answer using the SARa rubric and answer_check agent.
    rubric is loaded from rubric.json — no DB lookup needed.
    """
    rubric = _RUBRIC.get(step_code, {})
    if not _AGENTS_AVAILABLE or not rubric:
        logger.warning(f"evaluate_answer fallback: agents={_AGENTS_AVAILABLE}, rubric_found={bool(rubric)}")
        return {
            "score": 0.5, "passed": False, "errors": [],
            "feedback": "Không thể đánh giá lúc này.",
            "positive_feedback": "", "could_add": "",
            "next_step_preview": "", "latency_ms": 0,
        }
    return _answer_check.evaluate(
        student_answer=student_answer,
        step_code=step_code,
        step_index=step_index,
        rubric=rubric,
        answer_key=answer_key,
        cv_findings=cv_findings,
        previous_steps=previous_steps,
        step_attempts=step_attempts,
        is_last_step=is_last_step,
    )


def get_socratic_hint(
    step_code: str,
    step_index: int,
    errors: list,
    hint_count: int,
    step_attempts: list | None = None,
) -> str:
    """
    Generate a Socratic hint after a failed evaluation.
    hint_count=1 gentle nudge, =2 direct, =3 reveals missing criterion.
    """
    if not _AGENTS_AVAILABLE:
        return "Hãy xem xét kỹ hơn và thử lại."
    try:
        return _socratic.get_hint(
            step_name=step_code,
            step_index=step_index,
            errors=errors,
            hint_count=hint_count,
            step_attempts=step_attempts,
        )
    except Exception as e:
        logger.error(f"get_socratic_hint error: {e}")
        return "Hãy xem xét kỹ hơn và thử lại."
