"""
SARa Agents — Django wrapper for src.backend.agents
Replaces MockAIAgent / OpenAIAgent with the proper socratic + answer_check agents.
"""
import logging

logger = logging.getLogger(__name__)

try:
    from app.agents import socratic as _socratic
    from app.agents import answer_check as _answer_check
    _AGENTS_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import SARa agents: {e}")
    _AGENTS_AVAILABLE = False

_RUBRIC_CACHE: dict | None = None


def _get_rubric() -> dict:
    """Fetch rubric from Supabase, cached for the lifetime of the process."""
    global _RUBRIC_CACHE
    if _RUBRIC_CACHE is not None:
        return _RUBRIC_CACHE
    try:
        from app.core.supabase_client import get_supabase
        sb = get_supabase()
        rows = sb.table('step_rubrics').select(
            'step_code, question, criterion_label, max_score, error_code, pass_score, scoring_guide'
        ).execute()

        rubric: dict = {}
        for row in (rows.data or []):
            step = row['step_code']
            if step not in rubric:
                rubric[step] = {
                    'question':      row.get('question', ''),
                    'pass_score':    row.get('pass_score') or 0.6,
                    'criteria':      [],
                    'scoring_guide': '',
                }
            rubric[step]['criteria'].append({
                'label':      row.get('criterion_label', ''),
                'max_score':  row.get('max_score', 1),
                'error_code': row.get('error_code', ''),
            })
            if row.get('scoring_guide'):
                rubric[step]['scoring_guide'] += row['scoring_guide'] + ' '

        for step_data in rubric.values():
            step_data['total_max'] = sum(c['max_score'] for c in step_data['criteria'])
            step_data['scoring_guide'] = step_data['scoring_guide'].strip()

        _RUBRIC_CACHE = rubric
        logger.info(f"Rubric loaded from Supabase: {list(rubric.keys())}")
        return rubric
    except Exception as e:
        logger.error(f"Failed to load rubric from Supabase: {e}")
        return {}


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
    Evaluate student answer using the SARa rubric loaded from Supabase.
    """
    rubric = _get_rubric().get(step_code, {})
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
