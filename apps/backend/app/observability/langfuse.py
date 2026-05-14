import logging
import os
from contextvars import ContextVar
from contextlib import contextmanager
from typing import Any, Iterator

logger = logging.getLogger(__name__)


LANGFUSE_ENABLED = os.getenv("LANGFUSE_ENABLED", "false").lower() in ("1", "true", "yes")
CAPTURE_RAW_IO = os.getenv("LANGFUSE_CAPTURE_RAW_IO", "false").lower() in ("1", "true", "yes")


def _load_client():
    if not LANGFUSE_ENABLED:
        return None
    try:
        from langfuse import get_client

        return get_client()
    except Exception as exc:
        logger.warning("Langfuse disabled: %s", exc)
        return None


_CLIENT = _load_client()
_CTX_USER_ID: ContextVar[str | None] = ContextVar("langfuse_user_id", default=None)
_CTX_SESSION_ID: ContextVar[str | None] = ContextVar("langfuse_session_id", default=None)
_CTX_METADATA: ContextVar[dict[str, Any]] = ContextVar("langfuse_metadata", default={})


def enabled() -> bool:
    return _CLIENT is not None


@contextmanager
def workflow_context(
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
):
    user_token = _CTX_USER_ID.set(str(user_id) if user_id else None)
    session_token = _CTX_SESSION_ID.set(str(session_id) if session_id else None)
    metadata_token = _CTX_METADATA.set(metadata or {})
    try:
        yield
    finally:
        _CTX_USER_ID.reset(user_token)
        _CTX_SESSION_ID.reset(session_token)
        _CTX_METADATA.reset(metadata_token)


def _short(value: Any, limit: int = 500) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        return value if len(value) <= limit else value[:limit] + "..."
    if isinstance(value, dict):
        return {k: _short(v, limit) for k, v in value.items()}
    if isinstance(value, list):
        return [_short(v, limit) for v in value[:20]]
    return value


def safe_text(value: Any, limit: int = 500) -> str:
    return _short(str(value or ""), limit)


def usage_from_openai(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", prompt_tokens + completion_tokens) or 0)
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }


def openai_cost_estimate(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    # Keep the current project estimate as fallback. Override here when pricing changes.
    return (prompt_tokens * 0.000005) + (completion_tokens * 0.000015)


def common_metadata(
    *,
    feature: str,
    agent_name: str | None = None,
    session_kind: str | None = None,
    case_id: str | None = None,
    step_code: str | None = None,
    step_index: int | None = None,
    attempt_number: int | None = None,
    provider: str | None = None,
    model: str | None = None,
    modality: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = {
        "feature": feature,
        "agent_name": agent_name,
        "session_kind": session_kind,
        "case_id": case_id,
        "step_code": step_code,
        "step_index": step_index,
        "attempt_number": attempt_number,
        "provider": provider,
        "model": model,
        "modality": modality,
        "app_version": os.getenv("APP_VERSION", "local"),
        "environment": os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "local")),
    }
    if extra:
        metadata.update(extra)
    return {k: v for k, v in metadata.items() if v is not None}


class Observation:
    def __init__(self, observation: Any = None):
        self._observation = observation

    def update(self, **kwargs: Any) -> None:
        if not self._observation:
            return
        try:
            self._observation.update(**kwargs)
        except Exception as exc:
            logger.debug("Langfuse update failed: %s", exc)

    def score(self, name: str, value: float | int | bool, comment: str | None = None, **kwargs: Any) -> None:
        if not _CLIENT:
            return
        try:
            _CLIENT.create_score(name=name, value=value, comment=comment, **kwargs)
        except Exception as exc:
            logger.debug("Langfuse score failed: %s", exc)


@contextmanager
def observation(
    name: str,
    *,
    as_type: str = "span",
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    input: Any = None,
) -> Iterator[Observation]:
    if not _CLIENT:
        yield Observation()
        return

    kwargs: dict[str, Any] = {
        "name": name,
        "as_type": as_type,
        "metadata": _short(metadata or {}),
    }
    if user_id:
        kwargs["user_id"] = str(user_id)
    if session_id:
        kwargs["session_id"] = str(session_id)
    if input is not None:
        kwargs["input"] = _short(input)
    inherited_user_id = _CTX_USER_ID.get()
    inherited_session_id = _CTX_SESSION_ID.get()
    inherited_metadata = _CTX_METADATA.get()
    if inherited_user_id and "user_id" not in kwargs:
        kwargs["user_id"] = inherited_user_id
    if inherited_session_id and "session_id" not in kwargs:
        kwargs["session_id"] = inherited_session_id
    if inherited_metadata:
        kwargs["metadata"] = {**_short(inherited_metadata), **kwargs.get("metadata", {})}

    try:
        with _CLIENT.start_as_current_observation(**kwargs) as obs:
            yield Observation(obs)
    except Exception as exc:
        logger.debug("Langfuse observation failed: %s", exc)
        yield Observation()


def trace_workflow(
    name: str,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    input: Any = None,
):
    return observation(
        name,
        as_type="agent",
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
        input=input,
    )


def span(
    name: str,
    *,
    metadata: dict[str, Any] | None = None,
    input: Any = None,
    as_type: str = "span",
    user_id: str | None = None,
    session_id: str | None = None,
):
    return observation(
        name,
        as_type=as_type,
        metadata=metadata,
        input=input,
        user_id=user_id,
        session_id=session_id,
    )


def generation(
    name: str,
    *,
    model: str,
    metadata: dict[str, Any] | None = None,
    input: Any = None,
    user_id: str | None = None,
    session_id: str | None = None,
):
    metadata = dict(metadata or {})
    user_id = user_id or metadata.pop("langfuse_user_id", None)
    session_id = session_id or metadata.pop("langfuse_session_id", None)
    return observation(
        name,
        as_type="generation",
        metadata={**metadata, "model": model},
        input=input if CAPTURE_RAW_IO else _short(input, 300),
        user_id=user_id,
        session_id=session_id,
    )


def update_generation(
    obs: Observation,
    *,
    response: Any,
    model: str,
    latency_ms: int,
    output: Any = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    usage = usage_from_openai(response)
    cost = openai_cost_estimate(model, usage["prompt_tokens"], usage["completion_tokens"])
    metrics = {
        **usage,
        "latency_ms": latency_ms,
        "cost_estimate_usd": cost,
    }
    obs.update(
        output=_short(output if CAPTURE_RAW_IO else safe_text(output, 500)),
        metadata={**(metadata or {}), **metrics},
    )
    return metrics


def update_current(**kwargs: Any) -> None:
    if not _CLIENT:
        return
    try:
        _CLIENT.update_current_observation(**kwargs)
    except Exception as exc:
        logger.debug("Langfuse current observation update failed: %s", exc)


def flush() -> None:
    if not _CLIENT:
        return
    try:
        _CLIENT.flush()
    except Exception as exc:
        logger.debug("Langfuse flush failed: %s", exc)
