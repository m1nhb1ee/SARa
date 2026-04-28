def build_analysis_prompt(
    modality: str,
    region: str,
    total_slices: int | None = None,
) -> str:

    return f"""You are a radiology assistant. Analyze these {modality} images of the {region} region. There are {total_slices} slices in this volume. Analyze these images in six steps, each step must just be short:

1. OBSERVE: What structures are visible. 
2. DESCRIBE: Location, size, shape, and density of the key finding (or "No focal finding" if normal).
3. INTERPRET: State whether the image is normal or abnormal, and the reason in one sentence.
4. HYPOTHESIS: The single most likely diagnosis or "Normal study" if no abnormality.
5. DDx: List 2–3 differential diagnoses separated by semicolons, each with one brief reason.
6. CONCLUSION: Summarize the main finding and recommended next step. State confidence: High, Moderate, or Low."""
