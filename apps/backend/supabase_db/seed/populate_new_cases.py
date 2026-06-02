# populate_new_cases.py
# Walks Data/new data/new data/ folder, reads each rubric_match.json,
# uploads images to Supabase Storage, and inserts cases + case_images + answer_keys.
#
# Difficulty is auto-determined from distinct image volume count:
#   >4 volumes → difficult | 1 volume → easy | otherwise → medium
#
# Schema additions vs populate_cases.py: is_valid=True, is_exam=False
# Handles two rubric formats: with/without expected_output wrapper
import os
import uuid
import json
import mimetypes
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)

DATA_ROOT = Path(__file__).resolve().parents[4] / "Data" / "new data" / "new data"
BUCKET = "case_images"
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}

MODALITY_MAP = {
    "x-ray": "X-ray",
    "ct": "CT",
    "ctpa": "CT",
    "mri": "MRI",
}

REGION_FROM_CASE_ID = {
    "neuro":     "Brain",
    "chest":     "Chest",
    "abdomen":   "Abdomen",
    "msk":       "Musculoskeletal",
    "spine":     "Spine",
    "extremity": "Extremity",
}


def _derive_region(case_id: str, disease_dir: Path) -> str:
    prefix = case_id.split("_")[0].lower()
    if prefix in REGION_FROM_CASE_ID:
        return REGION_FROM_CASE_ID[prefix]
    for part in disease_dir.parts:
        key = part.lower()
        for map_key, region in REGION_FROM_CASE_ID.items():
            if key == map_key:
                return region
    return "General"


def _normalize_modality(raw: str) -> str:
    """Map raw modality string to an allowed DB value."""
    key = raw.strip().lower()
    if key in MODALITY_MAP:
        return MODALITY_MAP[key]
    for allowed_key, allowed_val in MODALITY_MAP.items():
        if allowed_key in key:
            return allowed_val
    return "Difference"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _collect_images(disease_dir: Path) -> list[tuple[Path, str]]:
    """Return (file_path, volume_name) for every image under disease_dir."""
    results = []
    for path in sorted(disease_dir.rglob("*")):
        if path.suffix.lower() not in IMAGE_EXTS:
            continue
        parent = path.parent
        volume_name = parent.name if parent != disease_dir else "Default"
        results.append((path, volume_name))
    return results


def _get_difficulty(images: list[tuple[Path, str]]) -> str:
    unique_volumes = len({volume for _, volume in images})
    if unique_volumes > 4:
        return "hard"
    if unique_volumes == 1:
        return "easy"
    return "medium"


def _upload_image(img_path: Path) -> str:
    """Upload image to Supabase Storage and return its public URL."""
    mime = mimetypes.guess_type(img_path.name)[0] or "image/jpeg"
    storage_key = f"seed/{uuid.uuid4()}{img_path.suffix.lower()}"
    with open(img_path, "rb") as f:
        data = f.read()
    supabase.storage.from_(BUCKET).upload(
        storage_key, data,
        file_options={"content-type": mime, "upsert": "true"},
    )
    return supabase.storage.from_(BUCKET).get_public_url(storage_key)


def _format_list(items) -> str:
    if not items:
        return ""
    if isinstance(items, list):
        return "; ".join(str(i) for i in items if i)
    return str(items)


# ── Answer key builders ────────────────────────────────────────────────────────

def _build_answer_keys(rubric: dict) -> list[dict]:
    """Dispatch to the correct builder based on rubric format."""
    expected = rubric.get("expected_output")
    if expected:
        return _build_from_expected_output(expected)
    return _build_from_top_level(rubric)


def _build_from_expected_output(expected: dict) -> list[dict]:
    """Build answer keys from expected_output.step_* structure."""
    s2 = expected.get("step_2_describe", {})
    s3 = expected.get("step_3_reasoning", {})
    s4 = expected.get("step_4_differential_diagnosis", {})
    s5 = expected.get("step_5_conclusion", {})

    location = s2.get("location", [])
    chars = s2.get("characteristics", [])
    associated = s2.get("associated_findings", [])
    negative = s2.get("negative_findings", [])
    obs_parts = []
    if location:
        obs_parts.append("Location: " + _format_list(location))
    if chars:
        obs_parts.append("Characteristics: " + _format_list(chars))
    if associated:
        obs_parts.append("Associated findings: " + _format_list(associated))
    if negative:
        obs_parts.append("Negative findings: " + _format_list(negative))
    observe_finding = ". ".join(obs_parts)

    chain = s3.get("inference_chain", [])
    hypothesis = s3.get("hypothesis", [])
    evidence_img = s3.get("evidence", {}).get("imaging", [])
    reasoning_parts = []
    if chain:
        reasoning_parts.append("Reasoning: " + _format_list(chain))
    if hypothesis:
        reasoning_parts.append("Working diagnosis: " + _format_list(hypothesis))
    reasoning_finding = ". ".join(reasoning_parts)

    candidates = s4.get("candidates", [])
    ddx_lines = [
        f"{c.get('diagnosis', '')} [{c.get('priority', '')}]: {_format_list(c.get('supporting_evidence', []))}"
        for c in candidates
    ]
    ddx_finding = "; ".join(ddx_lines)
    prioritization = s4.get("prioritization_logic", [])

    diagnosis = s5.get("most_likely_diagnosis", "")
    justification = s5.get("justification", [])
    conclusion_finding = f"{diagnosis}. Justification: {_format_list(justification)}"

    return [
        {
            "step_order": 0, "step_code": "DESCRIBE",
            "expected_finding": observe_finding,
            "clinical_explanation": observe_finding,
            "key_points": [p for p in location[:2] + chars[:2] if p],
        },
        {
            "step_order": 1, "step_code": "REASONING",
            "expected_finding": reasoning_finding,
            "clinical_explanation": reasoning_finding,
            "key_points": [p for p in hypothesis + evidence_img[:2] if p],
        },
        {
            "step_order": 2, "step_code": "DDx",
            "expected_finding": ddx_finding,
            "clinical_explanation": prioritization[0] if prioritization else ddx_finding,
            "key_points": [c.get("diagnosis", "") for c in candidates if c.get("diagnosis")],
        },
        {
            "step_order": 3, "step_code": "CONCLUSION",
            "expected_finding": conclusion_finding,
            "clinical_explanation": conclusion_finding,
            "key_points": [p for p in [diagnosis] + justification[:2] if p],
        },
    ]


def _build_from_top_level(rubric: dict) -> list[dict]:
    """Build answer keys from top-level step_* keys (no expected_output wrapper)."""
    s2 = rubric.get("step_2_description", {})
    s3 = rubric.get("step_3_reasoning", {})
    s4 = rubric.get("step_4_differential_diagnosis", [])
    s5 = rubric.get("step_5_conclusion", {})

    location = s2.get("location", [])
    img_chars = s2.get("imaging_characteristics", [])
    associated = s2.get("associated_findings", [])
    obs_parts = []
    if location:
        obs_parts.append("Location: " + _format_list(location))
    if img_chars:
        obs_parts.append("Characteristics: " + _format_list(img_chars))
    if associated:
        obs_parts.append("Associated findings: " + _format_list(associated))
    observe_finding = ". ".join(obs_parts)

    evidence = s3.get("evidence", [])
    hypothesis = s3.get("hypothesis", [])
    reasoning_parts = []
    if evidence:
        reasoning_parts.append("Evidence: " + _format_list(evidence))
    if hypothesis:
        reasoning_parts.append("Working diagnosis: " + _format_list(hypothesis))
    reasoning_finding = ". ".join(reasoning_parts)

    candidates = s4 if isinstance(s4, list) else []
    ddx_lines = [
        f"{c.get('diagnosis', '')}: {_format_list(c.get('supporting_features', []))}"
        for c in candidates
    ]
    ddx_finding = "; ".join(ddx_lines)

    diagnosis = s5.get("most_likely_diagnosis", "")
    justification = s5.get("justification", [])
    conclusion_finding = f"{diagnosis}. Justification: {_format_list(justification)}"

    return [
        {
            "step_order": 0, "step_code": "DESCRIBE",
            "expected_finding": observe_finding,
            "clinical_explanation": observe_finding,
            "key_points": [p for p in location[:2] + img_chars[:2] if p],
        },
        {
            "step_order": 1, "step_code": "REASONING",
            "expected_finding": reasoning_finding,
            "clinical_explanation": reasoning_finding,
            "key_points": [p for p in hypothesis + (evidence[:2] if isinstance(evidence, list) else []) if p],
        },
        {
            "step_order": 2, "step_code": "DDx",
            "expected_finding": ddx_finding,
            "clinical_explanation": ddx_finding,
            "key_points": [c.get("diagnosis", "") for c in candidates if c.get("diagnosis")],
        },
        {
            "step_order": 3, "step_code": "CONCLUSION",
            "expected_finding": conclusion_finding,
            "clinical_explanation": conclusion_finding,
            "key_points": [p for p in [diagnosis] + justification[:2] if p],
        },
    ]


# ── Main ───────────────────────────────────────────────────────────────────────

def run():
    rubric_files = sorted(DATA_ROOT.rglob("rubric_match.json"))
    print(f"Found {len(rubric_files)} cases in {DATA_ROOT}\n")

    total_cases = 0
    total_images = 0

    for rubric_path in rubric_files:
        disease_dir = rubric_path.parent

        with open(rubric_path, encoding="utf-8") as f:
            rubric = json.load(f)

        title = rubric.get("title", disease_dir.name)
        modality = _normalize_modality(rubric.get("modality", "X-ray"))
        clinical_history_raw = rubric.get("clinical_history", [])
        clinical_history = (
            "; ".join(clinical_history_raw)
            if isinstance(clinical_history_raw, list)
            else str(clinical_history_raw)
        )
        case_id_tag = rubric.get("case_id", disease_dir.name)
        disease_tag = (
            case_id_tag
            .lower()
            .replace(" ", "_")
            .replace("-", "_")
        )
        region = _derive_region(case_id_tag, disease_dir)
        subtitle = f"{region} {modality}"

        images = _collect_images(disease_dir)
        difficulty = _get_difficulty(images)
        unique_volumes = len({v for _, v in images})

        print(f"── {title} | {subtitle} | {len(images)} images | {unique_volumes} volumes | difficulty: {difficulty}")

        supabase.table("disease_profiles").upsert(
            {"disease_tag": disease_tag}, on_conflict="disease_tag"
        ).execute()

        uploaded: list[dict] = []
        for idx, (img_path, volume_name) in enumerate(images):
            try:
                url = _upload_image(img_path)
                uploaded.append({"url": url, "slice_index": idx, "volume_name": volume_name})
            except Exception as e:
                print(f"   ⚠ upload failed for {img_path.name}: {e}")

        case_row = {
            "title": subtitle,
            "disease_name": title,
            "modality": modality,
            "difficulty": difficulty,
            "clinical_history": clinical_history,
            "tags": [disease_tag],
            "disease_tag": disease_tag,
            "status": "published",
            "source": "system",
            "is_valid": True,
            "is_exam": False,
        }
        result = supabase.table("cases").insert(case_row).execute()
        case_id = result.data[0]["id"]

        for img in uploaded:
            supabase.table("case_images").insert({
                "case_id": case_id,
                "image_url": img["url"],
                "slice_index": img["slice_index"],
                "volume_name": img["volume_name"],
            }).execute()

        answer_keys = _build_answer_keys(rubric)
        for ak in answer_keys:
            supabase.table("answer_keys").insert({
                "case_id": case_id, **ak
            }).execute()

        total_cases += 1
        total_images += len(uploaded)
        print(f"   ✓ case {case_id} | {len(uploaded)} images | 4 answer keys")

    print(f"\nDone. {total_cases} cases, {total_images} images inserted.")


if __name__ == "__main__":
    run()
