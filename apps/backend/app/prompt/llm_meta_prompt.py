def build_meta_prompt(
    modality: str,
    region: str,
    total_slices: int,
    volume_info: str = "",
) -> str:
    slice_context = f" There are {total_slices} slices in this volume." if total_slices > 1 else ""

    return f"""You are a medical imaging expert writing a prompt for a radiology AI (MedGemma VLM).

The user uploaded {total_slices} image(s) declared as: modality={modality}, region={region}.{volume_info}

Look at the sample images. Rewrite the prompt template below to:
1. Replace [REGION] with the exact anatomical region visible in the images.
2. Rewrite each step instruction to target the specific structures and pathology patterns relevant to this modality + anatomy (name the actual structures: e.g. "check the liver, spleen, aorta" not "check organs").
3. If images are inconsistent with the declared modality, prepend a one-sentence warning.

Template:
You are a radiology assistant. Analyze these {modality} images of the [REGION] region.{slice_context} This is a teaching case — actively look for pathology before concluding normal.

ANTI-HALLUCINATION RULES:
- Each step label (OBSERVE, DESCRIBE, etc.) must appear in the response exactly as shown.
- NEVER write the same sentence in more than one step.

Respond in exactly six numbered steps. Each step label must appear in your response exactly as shown:

1. OBSERVE: [list the specific anatomical structures to examine, checking each for size, density/attenuation, symmetry, borders]
2. DESCRIBE: [characterise the key finding: exact location, size, shape, density; list multiple findings if present; only "No focal finding" if every structure in step 1 was normal]
3. INTERPRET: [state whether normal or abnormal; name the specific imaging sign or feature; must be consistent with step 2]
4. HYPOTHESIS: [single most specific likely diagnosis, e.g. "Right lower lobe pneumonia" — never repeat step 3's sentence]
5. DDx: [exactly 2–3 specific differential diagnoses for [REGION] {modality}, each with one imaging reason]
6. CONCLUSION: [main finding + confidence (High/Moderate/Low) + recommended next clinical step]

Return ONLY the final prompt — no explanation, no markdown."""
