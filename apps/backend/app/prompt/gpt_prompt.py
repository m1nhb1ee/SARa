def _slice_context(total_slices: int | None = None, volume_names: list | None = None) -> str:
    unique_volumes = list(dict.fromkeys(volume_names or []))
    if len(unique_volumes) > 1:
        return f" ({len(unique_volumes)} volumes: {', '.join(unique_volumes)}, {total_slices} slices total)"
    if total_slices and total_slices > 1:
        return f" ({total_slices} slices)"
    return ""


def build_gpt_final_steps_prompt(modality: str, region: str, raw_vlm_output: str) -> str:
    return f"""You are a radiology assistant completing a case answer key.

Modality: {modality}
Region: {region}

--- VLM OUTPUT ---
{raw_vlm_output}
--- END VLM OUTPUT ---

The VLM output above may use any format (e.g. FINDINGS/IMPRESSION/REASONING/FINAL ANSWER, or numbered lists, or free text). Extract and consolidate:
- DESCRIBE = all structural observations (from FINDINGS, IMPRESSION, or equivalent sections)
- REASONING = clinical interpretation and working diagnosis (from REASONING or equivalent)
Use ONLY information present in the VLM output. Do not invent findings.

Return ONLY valid JSON, no markdown. All values must be plain strings (not arrays or objects):
{{
  "DESCRIBE": "<string> Consolidated structural observations from the VLM output.",
  "REASONING": "<string> Consolidated clinical interpretation and working diagnosis from the VLM output.",
  "DDx": "<string> 4 differential diagnoses based on the findings with one imaging reason each.",
  "CONCLUSION": "<string> Main finding + confidence (High/Moderate/Low) + recommended next step."
}}"""


def build_gpt_four_step_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    slice_context = _slice_context(total_slices, volume_names)

    return f"""You are a radiology assistant. Analyze these {modality} images of the {region} region.{slice_context}

Return ONLY valid JSON, no markdown. All values must be plain strings (not arrays or objects):
{{
  "DESCRIBE": "<string> List each visible structure; note whether normal or abnormal. Describe location, size, shape, and density of the main finding. Write No focal finding only if every structure is normal.",
  "REASONING": "<string> Interpret the clinical significance of the findings. State whether normal or abnormal, name the specific imaging sign if present, and give the single most specific working diagnosis with reasoning.",
  "DDx": "<string> 4 differential diagnoses based on previous steps' findings, each with one imaging reason.",
  "CONCLUSION": "<string> Main finding + confidence (High/Moderate/Low) + recommended next step."
}}"""
