def _slice_context(total_slices: int | None = None, volume_names: list | None = None) -> str:
    unique_volumes = list(dict.fromkeys(volume_names or []))
    if len(unique_volumes) > 1:
        return f" ({len(unique_volumes)} volumes: {', '.join(unique_volumes)}, {total_slices} slices total)"
    if total_slices and total_slices > 1:
        return f" ({total_slices} slices)"
    return ""


def build_gpt_four_step_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    slice_context = _slice_context(total_slices, volume_names)

    return f"""You are a radiology assistant. Analyze these {modality} images of the {region} region.{slice_context}

Return ONLY valid JSON, no markdown, with exactly these keys:
{{
  "DESCRIBE": "List each visible structure; note whether normal or abnormal. Describe location, size, shape, and density of the main finding. Write No focal finding only if every structure is normal.",
  "REASONING": "Interpret the clinical significance of the findings. State whether normal or abnormal, name the specific imaging sign if present, and give the single most specific working diagnosis with reasoning.",
  "DDx": "4 differential diagnoses based on previous steps' findings, each with one imaging reason.",
  "CONCLUSION": "Main finding + confidence (High/Moderate/Low) + recommended next step."
}}"""
