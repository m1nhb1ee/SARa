STEP_CODES = ['DESCRIBE', 'REASONING', 'DDx', 'CONCLUSION']

# Legacy step_codes that may still exist in DB (from the 6-step pipeline)
# are folded into the canonical 4-step set on read.
_LEGACY_TO_CANONICAL = {
    'DESCRIBE': 'DESCRIBE',
    'INTERPRET': 'REASONING',
    'HYPOTHESIS': 'REASONING',
    'DDX': 'DDx',
    'ddx': 'DDx',
}

_CANONICAL_STEP_ORDER = {code: idx for idx, code in enumerate(STEP_CODES)}


def normalize_step_code(code: str | None) -> str | None:
    if code is None:
        return None
    if code in _CANONICAL_STEP_ORDER:
        return code
    return _LEGACY_TO_CANONICAL.get(code, code)


def canonical_step_order(code: str | None) -> int | None:
    canonical = normalize_step_code(code)
    return _CANONICAL_STEP_ORDER.get(canonical) if canonical else None


def index_by_canonical_step(rows: list[dict], code_field: str = 'step_code') -> dict[str, dict]:
    """Build a dict keyed by canonical step_code from DB rows.

    When two rows collapse to the same canonical step (e.g. INTERPRET and HYPOTHESIS
    both map to REASONING), the row with the lower step_order wins, then first-seen.
    """
    out: dict[str, dict] = {}
    for row in rows:
        canonical = normalize_step_code(row.get(code_field))
        if canonical is None or canonical not in _CANONICAL_STEP_ORDER:
            continue
        existing = out.get(canonical)
        if existing is None:
            out[canonical] = row
            continue
        new_order = row.get('step_order')
        old_order = existing.get('step_order')
        if isinstance(new_order, int) and isinstance(old_order, int) and new_order < old_order:
            out[canonical] = row
    return out
