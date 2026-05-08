def _slice_context(total_slices: int | None = None, volume_names: list | None = None) -> str:
    unique_volumes = list(dict.fromkeys(volume_names or []))
    if len(unique_volumes) > 1:
        return f" ({len(unique_volumes)} volumes: {', '.join(unique_volumes)}, {total_slices} slices total)"
    if total_slices and total_slices > 1:
        return f" ({total_slices} slices)"
    return ""


def build_two_step_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    slice_context = _slice_context(total_slices, volume_names)

    return f"""You are a radiology assistant. Analyze these {modality} images of the {region} region.{slice_context}

Respond in exactly two numbered steps. Begin each line with its label:

1. DESCRIBE: List each visible structure; note whether normal or abnormal. Describe location, size, shape, and density of the main finding. Write "No focal finding" only if every structure is normal.
2. REASONING: Interpret the clinical significance of the findings (Normal or Abnormal? Name the specific imaging sign). Then state the single most specific working diagnosis with reasoning."""


def build_four_step_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    slice_context = _slice_context(total_slices, volume_names)

    return f"""You are a radiology assistant. Analyze these {modality} images of the {region} region.{slice_context}

Respond in exactly four numbered steps. Begin each line with its label:

1. DESCRIBE: List each visible structure; note whether normal or abnormal. Describe location, size, shape, and density of the main finding. Write "No focal finding" only if every structure is normal.
2. REASONING: Interpret the clinical significance of the findings (Normal or Abnormal? Name the specific imaging sign). Then state the single most specific working diagnosis with reasoning.
3. DDx: Exactly 2-3 differential diagnoses based on previous steps' findings, each with one imaging reason.
4. CONCLUSION: Main finding + confidence (High/Moderate/Low) + recommended next step."""


def build_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
    steps: int = 4,
) -> str:
    if steps == 2:
        return build_two_step_analysis_prompt(modality, region, total_slices, volume_names)
    return build_four_step_analysis_prompt(modality, region, total_slices, volume_names)
