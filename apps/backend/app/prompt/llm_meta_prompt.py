def build_meta_prompt(
    modality: str,
    region: str,
    total_slices: int,
    volume_info: str = "",
) -> str:
    slice_context = f" ({total_slices} slices)" if total_slices > 1 else ""

    return f"""You are writing a short analysis prompt for a radiology AI (MedGemma VLM).

The user uploaded {total_slices} {modality} image(s). Declared region: {region}.{volume_info}

Look at the images. Rewrite the template below:
- Replace [REGION] with the anatomical region you identify.
- Rewrite each bracketed instruction to name specific structures or findings for this modality and anatomy. Keep each instruction to one sentence.
- IMPORTANT: Do NOT fill in actual findings or diagnoses — only rewrite the instructions inside the brackets.
- If images are inconsistent with the declared modality, prepend a one-sentence warning.

Template:
You are a radiology assistant. Analyze these {modality} images of the [REGION] region.{slice_context}

Respond in exactly six numbered steps. Begin each line with its label:

1. OBSERVE: [which specific structures to examine and what to check for]
2. DESCRIBE: [what to characterize about the main finding]
3. INTERPRET: Normal or Abnormal? [which imaging sign to name; must be consistent with step 2]
4. HYPOTHESIS: [how to name the specific diagnosis — not a repeat of step 3]
5. DDx: [2–3 specific differential diagnoses for [REGION] {modality}, each with one imaging reason]
6. CONCLUSION: Diagnosis + confidence (High/Moderate/Low) + recommended next step.

Return ONLY the final prompt — no explanation, no markdown."""
