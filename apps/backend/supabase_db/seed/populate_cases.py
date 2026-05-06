# populate_cases.py
# Walks Data/ folder, reads each rubric_match.json, uploads images to Supabase
# Storage, and inserts cases + case_images + answer_keys into the database.
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

DATA_ROOT = Path(__file__).resolve().parents[4] / "Data"
BUCKET = "case_images"
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}

MODALITY_MAP = {"X-ray": "X-ray", "CT": "CT", "MRI": "MRI"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _collect_images(disease_dir: Path) -> list[tuple[Path, str]]:
    """Return (file_path, volume_name) for every image under disease_dir."""
    results = []
    for path in sorted(disease_dir.rglob("*")):
        if path.suffix.lower() not in IMAGE_EXTS:
            continue
        # volume_name = immediate parent if it differs from disease_dir
        parent = path.parent
        volume_name = parent.name if parent != disease_dir else "Default"
        results.append((path, volume_name))
    return results


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


def _build_answer_keys(expected: dict) -> list[dict]:
    """Map 5-field rubric_match structure → 4-step pipeline answer keys."""
    s1 = expected.get("step_1_observe", {})
    s2 = expected.get("step_2_describe", {})
    s3 = expected.get("step_3_reasoning", {})
    s4 = expected.get("step_4_differential_diagnosis", {})
    s5 = expected.get("step_5_conclusion", {})

    # OBSERVE: key abnormalities (step1) + location + characteristics (step2)
    obs_parts = []
    key_abn = s1.get("key_abnormalities", [])
    if key_abn:
        obs_parts.append("Key abnormalities: " + _format_list(key_abn))
    location = s2.get("location", [])
    if location:
        obs_parts.append("Location: " + _format_list(location))
    chars = s2.get("characteristics", [])
    if chars:
        obs_parts.append("Characteristics: " + _format_list(chars))
    associated = s2.get("associated_findings", [])
    if associated:
        obs_parts.append("Associated findings: " + _format_list(associated))
    negative = s2.get("negative_findings", [])
    if negative:
        obs_parts.append("Negative findings: " + _format_list(negative))
    observe_finding = ". ".join(obs_parts)
    observe_key_points = key_abn + location[:2]

    # REASONING: inference chain + working hypothesis
    chain = s3.get("inference_chain", [])
    hypothesis = s3.get("hypothesis", [])
    evidence_img = s3.get("evidence", {}).get("imaging", [])
    reasoning_parts = []
    if chain:
        reasoning_parts.append("Reasoning: " + _format_list(chain))
    if hypothesis:
        reasoning_parts.append("Working diagnosis: " + _format_list(hypothesis))
    reasoning_finding = ". ".join(reasoning_parts)
    reasoning_key_points = hypothesis + evidence_img[:2]

    # DDx: candidates formatted as ranked list
    candidates = s4.get("candidates", [])
    ddx_lines = []
    for c in candidates:
        diag = c.get("diagnosis", "")
        priority = c.get("priority", "")
        support = _format_list(c.get("supporting_evidence", []))
        ddx_lines.append(f"{diag} [{priority}]: {support}")
    ddx_finding = "; ".join(ddx_lines)
    ddx_key_points = [c.get("diagnosis", "") for c in candidates]

    # CONCLUSION
    diagnosis = s5.get("most_likely_diagnosis", "")
    justification = s5.get("justification", [])
    conclusion_finding = f"{diagnosis}. Justification: {_format_list(justification)}"
    conclusion_key_points = [diagnosis] + justification[:2]

    return [
        {
            "step_order": 0,
            "step_code": "OBSERVE",
            "expected_finding": observe_finding,
            "clinical_explanation": observe_finding,
            "key_points": [p for p in observe_key_points if p],
        },
        {
            "step_order": 1,
            "step_code": "REASONING",
            "expected_finding": reasoning_finding,
            "clinical_explanation": reasoning_finding,
            "key_points": [p for p in reasoning_key_points if p],
        },
        {
            "step_order": 2,
            "step_code": "DDx",
            "expected_finding": ddx_finding,
            "clinical_explanation": s4.get("prioritization_logic", [""])[0] if s4.get("prioritization_logic") else ddx_finding,
            "key_points": [p for p in ddx_key_points if p],
        },
        {
            "step_order": 3,
            "step_code": "CONCLUSION",
            "expected_finding": conclusion_finding,
            "clinical_explanation": conclusion_finding,
            "key_points": [p for p in conclusion_key_points if p],
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
        raw_modality = rubric.get("modality", "X-ray")
        modality = MODALITY_MAP.get(raw_modality, "X-ray")
        clinical_history_raw = rubric.get("clinical_history", [])
        clinical_history = (
            "; ".join(clinical_history_raw)
            if isinstance(clinical_history_raw, list)
            else str(clinical_history_raw)
        )
        disease_tag = (
            rubric.get("case_id", disease_dir.name)
            .lower()
            .replace(" ", "_")
            .replace("-", "_")
        )

        print(f"── {title} ({modality})")

        # Disease profile
        supabase.table("disease_profiles").upsert(
            {"disease_tag": disease_tag}, on_conflict="disease_tag"
        ).execute()

        # Collect + upload images
        images = _collect_images(disease_dir)
        uploaded: list[dict] = []
        for idx, (img_path, volume_name) in enumerate(images):
            try:
                url = _upload_image(img_path)
                uploaded.append({"url": url, "slice_index": idx, "volume_name": volume_name})
            except Exception as e:
                print(f"   ⚠ upload failed for {img_path.name}: {e}")

        # Insert case
        case_row = {
            "title": title,
            "modality": modality,
            "difficulty": "medium",
            "clinical_history": clinical_history,
            "tags": [disease_tag],
            "disease_tag": disease_tag,
            "status": "published",
            "source": "system",
        }
        result = supabase.table("cases").insert(case_row).execute()
        case_id = result.data[0]["id"]

        # Insert case_images
        for img in uploaded:
            supabase.table("case_images").insert({
                "case_id": case_id,
                "image_url": img["url"],
                "slice_index": img["slice_index"],
                "volume_name": img["volume_name"],
            }).execute()

        # Insert answer_keys
        answer_keys = _build_answer_keys(rubric.get("expected_output", {}))
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
