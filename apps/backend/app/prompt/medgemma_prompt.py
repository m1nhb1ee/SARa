def build_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    unique_volumes = list(dict.fromkeys(volume_names or []))
    if len(unique_volumes) > 1:
        slice_context = (
            f" ({len(unique_volumes)} volumes: {', '.join(unique_volumes)}, {total_slices} slices total)"
        )
    elif total_slices and total_slices > 1:
        slice_context = f" ({total_slices} slices)"
    else:
        slice_context = ""

    return f"""You are a radiology assistant. Analyze these {modality} images of the {region} region.{slice_context}

Respond in exactly six numbered steps. Begin each line with its label:

1. OBSERVE: List each visible structure; note whether normal or abnormal.
2. DESCRIBE: Location, size, shape, density of the main finding. Write "No focal finding" only if every structure in step 1 is normal.
3. INTERPRET: Normal or Abnormal? Name the specific imaging sign. Must be consistent with step 2.
4. HYPOTHESIS: Single most specific diagnosis. Do not repeat step 3.
5. DDx: Exactly 2–3 differential diagnoses for {region} {modality}, each with one imaging reason.
6. CONCLUSION: Main finding + confidence (High/Moderate/Low) + recommended next step."""
