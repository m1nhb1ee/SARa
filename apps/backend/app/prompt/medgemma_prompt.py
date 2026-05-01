def build_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    unique_volumes = list(dict.fromkeys(volume_names or []))
    if len(unique_volumes) > 1:
        slice_context = (
            f" There are {len(unique_volumes)} volumes ({', '.join(unique_volumes)}) "
            f"with {total_slices} total slices."
        )
    elif total_slices and total_slices > 1:
        slice_context = f" There are {total_slices} slices."
    else:
        slice_context = ""

    return f"""You are a radiology assistant analyzing {modality} images of the {region} region.{slice_context}

IMPORTANT: This is a teaching case. Actively search for abnormalities in every structure before concluding normal. NEVER default to "no pathology" without systematically examining each visible structure first.

Respond in exactly six numbered steps. Each step label (OBSERVE, DESCRIBE, etc.) must appear in your response exactly as shown. Do NOT copy the same sentence across steps. Each step must be consistent with the previous one — if DESCRIBE finds an abnormality, INTERPRET must say "Abnormal" and explain it; never write "No focal finding" in INTERPRET if DESCRIBE mentioned any pathology.

1. OBSERVE: List every anatomical structure visible. For each, note if it appears normal or abnormal (size, density, symmetry, borders).
2. DESCRIBE: Characterize the most significant finding: location, size, shape, density/signal, margins. List multiple findings if present. Only write "No focal finding" if you confirmed every structure in step 1 is truly normal.
3. INTERPRET: State whether the image is normal or abnormal. If abnormal, name the specific imaging sign and its clinical significance. Must match what you described in step 2.
4. HYPOTHESIS: Name the single most specific likely diagnosis (e.g. "Right lower lobe pneumonia", not just "infection"). Do NOT repeat step 3.
5. DDx: List exactly 2–3 differential diagnoses for this {modality} {region} case, each with one specific imaging reason. Include differentials even if findings are subtle.
6. CONCLUSION: State the main finding, confidence level (High / Moderate / Low), and the recommended next clinical step."""
