def build_image_validation_prompt(
    declared_modality: str,
    declared_region: str,
    volume_info: str,
) -> str:
    region_field = (
        f'4. matches_declared_region (bool) - does the anatomical region visible match the declared region "{declared_region}"?'
        if declared_region else
        '4. matches_declared_region (bool) - set true (no region was declared, so no check needed).'
    )
    check_d = (
        f'D. Does every image show the declared anatomical region "{declared_region}"? '
        f'Set matches_declared_region=false for any image that clearly shows a different body part.'
        if declared_region else
        'D. No declared region to check — set matches_declared_region=true for all images.'
    )
    region_issue = (
        f'- Region mismatch: "Ảnh số {{n}} (volume: \'{{vol}}\') chụp vùng {{detected_region}}, '
        f'không khớp vùng khai báo ({declared_region}). Vui lòng upload ảnh đúng vùng cơ thể."'
        if declared_region else
        '- Region mismatch: (no declared region — skip this issue type)'
    )

    return f"""You are validating medical images uploaded to a radiology education platform.

Declared scan type: {declared_modality}
Declared anatomical region: {declared_region or '(not specified)'}
Image index → volume group: {volume_info}

For EACH image, classify:
1. is_medical (bool) - is this a real radiological scan? Set false for photos, screenshots, diagrams, or non-medical images.
2. type (string) - specific imaging technique, e.g. "X-ray PA chest", "CT axial brain non-contrast", "MRI T2 sagittal spine".
3. matches_declared_modality (bool) - does the image match the declared scan type "{declared_modality}"?
   X-ray/XRAY: plain radiograph. CT: any CT window/plane. MRI: any MRI sequence (T1/T2/FLAIR/DWI/ADC all count as MRI).
{region_field}
5. region (string) - anatomical region visible, e.g. "chest", "brain", "spine", "abdomen", "knee".

After classifying all images, check:
A. Does every image match the declared scan type?
B. Are all images the same general modality (X-ray vs CT vs MRI)? Different MRI sequences count as the SAME modality.
C. Within each volume group, do all images show the same anatomical region? Different slices of the same region are fine; images of completely different body parts are not.
{check_d}

Return ONLY valid JSON, no markdown:
{{
  "images": [
    {{"index": 0, "volume": "Default", "is_medical": true, "type": "MRI T2 axial brain", "matches_declared_modality": true, "matches_declared_region": true, "region": "brain"}},
    {{"index": 1, "volume": "Default", "is_medical": true, "type": "MRI T2 axial brain", "matches_declared_modality": true, "matches_declared_region": true, "region": "brain"}}
  ],
  "issues": []
}}

Populate "issues" (in Vietnamese) for each violation:
- Not medical: "Ảnh số {{n}} (volume: '{{vol}}') không phải ảnh y tế. Vui lòng chỉ upload ảnh chẩn đoán hình ảnh."
- Modality mismatch: "Ảnh số {{n}} (volume: '{{vol}}') không khớp loại ảnh khai báo ({declared_modality}): phát hiện {{actual_type}}. Vui lòng upload đúng loại ảnh."
- Mixed modality: "Ảnh số {{n}} và ảnh số {{m}} thuộc hai loại ảnh khác nhau ({{type_n}} / {{type_m}}). Vui lòng upload cùng 1 loại ảnh."
- Different region in same volume: "Volume '{{vol}}': ảnh số {{n}} ({{region_n}}) và ảnh số {{m}} ({{region_m}}) chụp vùng cơ thể khác nhau. Các slice trong cùng 1 volume phải cùng vùng cơ thể."
{region_issue}
"""


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
