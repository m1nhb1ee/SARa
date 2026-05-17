# SARa — AI Analysis Engine Evaluation Evidence Report

**Project:** A20-App-076 — SARa (Smart AI Radiology)  
**Report Date:** 2026-05-16  
**Source Data:** `Data/results/scores.csv`, `Data/results/average_eval.md`  
**Test Plan Reference:** `documents/TEST_PLAN.md` v2.0 (2026-05-12)  
**Evaluators:** GPT-5.4-mini (production engine) · MedGemma-1.5-4B via Gradio (VLM engine)

---

## 1. Executive Summary

22 radiology cases across 6 body domains and 3 imaging modalities (X-ray, CT, MRI) were evaluated against both the GPT-5.4-mini and MedGemma-1.5-4B analysis engines. Six cases were classified as STAT (life-threatening emergencies).

| Metric | GPT-5.4-mini | MedGemma-1.5-4B |
|---|---|---|
| STAT Recall | **0.833** (5/6) | **0.167** (1/6)* |
| Top-1 Accuracy | **0.273** (6/22) | **0.050** (1/20) |
| Avg Hallucinations/Case | **4.00** | **4.70** |
| Reasoning Fidelity (avg) | **0.782** | **0.480** |

*\*Note: A discrepancy exists between the summary (0.167) and the CSV raw data (0/6 for all STAT cases). See Section 8 for details.*

**Key findings:**
- GPT-5.4-mini substantially outperforms MedGemma across all four metrics.
- Both engines have critically low top-1 diagnostic accuracy (27% and 5% respectively) — insufficient for unsupervised clinical use.
- Both engines produced false-negative extracted findings ("no acute finding" / "Normal") for all evaluated neuro-hemorrhagic STAT cases, representing a severe patient-safety risk that must be explicitly communicated to users.
- Hallucination rates are high for both engines, with cross-organ confabulation observed (cardiac findings in abdominal cases, pulmonary findings in abdominal perforation cases).
- MedGemma was not evaluated on 2 of 22 cases (missing data); this should be resolved.

---

## 2. Evaluation Setup

### 2.1 Models Under Test

| Engine | Model | Tier | Test Plan Reference |
|---|---|---|---|
| GPT | GPT-5.4-mini (OpenAI API) | Premium | TC-UPLOAD-002, TC-ANAL-003 |
| VLM | MedGemma-1.5-4B (HF Gradio: `ttnguyen6716/MedGemma-1.5-4B`) | Free | TC-UPLOAD-001, TC-ANAL-001 |

### 2.2 Evaluation Metrics

| Metric | Definition |
|---|---|
| **STAT Recall** | Fraction of is_stat=1 cases where the model correctly flagged the case as a life-threatening emergency |
| **Top-1 Accuracy** | Fraction of all cases where the extracted primary diagnosis matches the ground-truth folder label |
| **Avg Hallucinations/Case** | Mean count of clinically unsubstantiated or contradicted statements per case report |
| **Reasoning Fidelity** | Normalized score [0–1] measuring structural and semantic alignment of the model's reasoning chain with the reference answer key |

### 2.3 Dataset

| Domain | Modality | Cases (n) | STAT Cases |
|---|---|---|---|
| Abdomen | CT, X-ray | 4 | 0 |
| Chest | X-ray | 6 | 1 (Pneumothorax) |
| Extremity | X-ray | 1 | 0 |
| Spine | MRI | 1 | 0 |
| MSK | X-ray | 3 | 0 |
| Neuro | CT | 6 | 5 |
| **Total** | | **22** | **6** |

MedGemma data was absent for 2 cases: `abdomen_003` (Duodenal perforation) and `neuro_002` (Glioblastoma NOS). All GPT data is complete.

---

## 3. Aggregate Results

Source: `Data/results/average_eval.md`

```
── Results summary ─────────────────────────────────────────────
  Cases evaluated : 22  (STAT: 6)

  Metric                           GPT-5.4-mini   MedGemma
  ────────────────────────────── ────────────── ──────────
  Recall (STAT cases)                     0.833      0.167
  Top-1 Accuracy                          0.273      0.050
  Avg Hallucinations/case                 4.000      4.700
  Reasoning Fidelity                      0.782      0.480
────────────────────────────────────────────────────────────────
```

### 3.1 Computation Verification

**GPT STAT Recall (0.833 = 5/6):**  
STAT cases: chest_009, neuro_001 (×2), neuro_004, neuro_005, neuro_003.  
GPT gpt_recall column: 1, 1, 1, 1, 1, **0** (neuro_003 SDH missed) → 5/6 = 0.833 ✓

**GPT Top-1 (0.273 = 6/22):**  
Correct top-1 cases: abdomen_001 (Pneumoperitoneum), chest_009 (Pneumothorax), extremity_001 (Greenstick), spine_001 (Lumbar disc), msk_001 (Osteosarcoma), neuro_002 (Glioblastoma) → 6/22 = 0.273 ✓

**GPT Avg Hallucinations (4.00):**  
Sum of gpt_halluc across 22 rows = 88; 88/22 = 4.000 ✓

**GPT Reasoning Fidelity (0.782):**  
All cases score 0.8 except neuro_001 (Basal ganglia, 0.6) and neuro_004 (SAH, 0.6); (20×0.8 + 2×0.6)/22 = 17.2/22 = 0.782 ✓

**MedGemma STAT Recall (summary: 0.167; CSV: 0.000):**  
⚠ Discrepancy detected — see Section 8.

**MedGemma Top-1 (0.050 = 1/20):**  
Only abdomen_001 (Pneumoperitoneum) has gemma_top1=1 → 1/20 = 0.050 ✓

**MedGemma Avg Hallucinations (4.70):**  
Sum of 20 non-null gemma_halluc values = 94; 94/20 = 4.70 ✓

**MedGemma Reasoning Fidelity (0.480):**  
Sum of 20 non-null gemma_fidelity values = 9.60; 9.60/20 = 0.480 ✓

---

## 4. Per-Domain Performance

### 5.4 Abdomen (4 cases · CT/X-ray · 0 STAT)

| Case ID | Title | Modality | GPT Top-1 | Gemma Top-1 | GPT Halluc | Gemma Halluc | GPT Fidelity | Gemma Fidelity |
|---|---|---|---|---|---|---|---|---|
| abdomen_001 | Acute appendicitis | CT | 0 | 0 | 2 | 7 | 0.8 | 0.6 |
| abdomen_003 | Duodenal perforation | X-ray, CT | 0 | N/A | 11 | N/A | 0.8 | N/A |
| abdomen_002 | Hepatocellular carcinoma | CT | 0 | 0 | 6 | 7 | 0.8 | 0.0 |
| abdomen_001 | Pneumoperitoneum | X-ray | **1** | **1** | 2 | 4 | 0.8 | 0.6 |
| **Domain avg** | | | **25%** | **33%** | **5.25** | **6.0** | **0.800** | **0.400** |

**Notable issues:**
- GPT extracted "Saddle pulmonary embolus" for Duodenal perforation — a gross cross-organ hallucination (thoracic finding in abdominal case); hallucination count of 11 is the highest single-case GPT value in the dataset.
- GPT extracted "left atrial appendage thrombus" for HCC — again cardiac hallucination in an abdominal case.
- MedGemma extracted "Cardiomegaly" for HCC — fidelity score 0.0 (complete reasoning failure).

### 4.2 Chest (6 cases · X-ray · 1 STAT)

| Case ID | Title | Modality | Is STAT | GPT Recall | Gemma Recall | GPT Top-1 | Gemma Top-1 | GPT Halluc | Gemma Halluc | GPT Fidelity | Gemma Fidelity |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chest_008 | Acute pulmonary edema | X-ray | 0 | — | — | 0 | 0 | 7 | 3 | 0.8 | 0.6 |
| chest_008 | Community MRSA pneumonia | X-ray | 0 | — | — | 0 | 0 | 3 | 2 | 0.8 | 0.8 |
| chest_007 | Pleural effusion | X-ray | 0 | — | — | 0 | 0 | 4 | 4 | 0.8 | 0.4 |
| chest_006 | Pneumocystis pneumonia | X-ray | 0 | — | — | 0 | 0 | 2 | 2 | 0.8 | 0.8 |
| chest_009 | **Pneumothorax** | X-ray | **1** | **1** | **0** | **1** | **0** | 3 | 2 | 0.8 | 0.6 |
| chest_002 | Pulmonary tuberculosis | X-ray | 0 | — | — | 0 | 0 | 7 | 3 | 0.8 | 0.8 |
| **Domain avg** | | | | | | **17%** | **0%** | **4.33** | **2.67** | **0.800** | **0.667** |

**Notable issues:**
- GPT correctly identified Pneumothorax (STAT) and extracted "large left pneumothorax with mild tension physiology" — the only chest STAT case, handled correctly by GPT.
- MedGemma extracted "pneumonia" for Pneumothorax — missed the tension physiology urgency entirely (recall=0).
- Both models confused chest_007 with "pneumomediastinum" and "thymoma" — neither identified pleural effusion or T1b lung cancer.
- GPT hallucinated significantly on Acute pulmonary edema (7) and PTB (7).

### 4.3 Musculoskeletal (4 cases incl. spine · X-ray/MRI · 0 STAT)

| Case ID | Title | Modality | GPT Top-1 | Gemma Top-1 | GPT Halluc | Gemma Halluc | GPT Fidelity | Gemma Fidelity |
|---|---|---|---|---|---|---|---|---|
| extremity_001 | Greenstick fracture (radius/ulna) | X-ray | **1** | 0 | 4 | 2 | 0.8 | 0.4 |
| spine_001 | Lumbar disc herniation | MRI | **1** | 0 | 3 | 3 | 0.8 | 0.2 |
| msk_001 | Lumbar vertebral compression fracture | X-ray | 0 | 0 | 6 | 1 | 0.8 | 0.6 |
| msk_002 | Osteomyelitis (diabetic foot) | X-ray | 0 | 0 | 3 | 2 | 0.8 | 0.4 |
| msk_001 | Osteosarcoma | X-ray | **1** | 0 | 1 | 2 | 0.8 | 0.6 |
| **Domain avg** | | | **60%** | **0%** | **3.40** | **2.0** | **0.800** | **0.440** |

**Notable issues:**
- GPT performed best in this domain (3/5 top-1 correct).
- MedGemma extracted "Normal" for Lumbar disc herniation — fidelity 0.2.
- GPT extracted "osteosarcoma" for compression fracture and vice versa — both confused two MSK cases that share the same case_id (msk_001).
- MedGemma extracted "right lateral forefoot soft tissue injury with subcutaneous gas" for Osteomyelitis — missed the osseous infection diagnosis.

### 4.4 Neuro (6 cases · CT · 5 STAT)

| Case ID | Title | Is STAT | GPT Recall | Gemma Recall | GPT Top-1 | Gemma Top-1 | GPT Extracted Finding | GPT Halluc | Gemma Halluc | GPT Fidelity | Gemma Fidelity |
|---|---|---|---|---|---|---|---|---|---|---|---|
| neuro_001 | Basal ganglia hemorrhage | **1** | **1** | **0** | 0 | 0 | "no acute focal finding in the imaged brain/upper neck region" | 1 | 12 | 0.6 | 0.2 |
| neuro_005 | Extradural hematoma | **1** | **1** | **0** | 0 | 0 | "left facial soft-tissue contusion/hematoma" | 3 | 7 | 0.8 | 0.8 |
| neuro_002 | Glioblastoma NOS | 0 | — | N/A | **1** | N/A | "glioblastoma" | 1 | N/A | 0.8 | N/A |
| neuro_001 | Intracranial hemorrhage | **1** | **1** | **0** | 0 | 0 | "no acute CT abnormality in the imaged brain/upper neck region" | 1 | 11 | 0.8 | 0.2 |
| neuro_004 | Subarachnoid hemorrhage | **1** | **1** | **0** | 0 | 0 | "no acute intracranial abnormality" | 5 | 9 | 0.6 | 0.2 |
| neuro_003 | Subdural hematoma | **1** | **0** | **0** | 0 | 0 | "left maxillary sinus mucous retention cyst" | 8 | 7 | 0.8 | 0.2 |
| **Domain avg** | | | **83%** | **0%** | **17%** | **0%** | | **3.17** | **9.20** | **0.733** | **0.320** |

**Critical safety finding — False Negative Neuro Emergencies:**

Despite achieving STAT recall=1 on 4 of 5 neuro STAT cases, GPT's extracted primary findings for brain hemorrhages were all false negative:

| STAT Case | Actual Diagnosis | GPT Extracted Finding | Assessment |
|---|---|---|---|
| Basal ganglia hemorrhage | Intraparenchymal hemorrhage | "no acute focal finding" | **FALSE NEGATIVE** |
| Intracranial hemorrhage | Hemorrhagic lesion | "no acute CT abnormality" | **FALSE NEGATIVE** |
| Subarachnoid hemorrhage | SAH | "no acute intracranial abnormality" | **FALSE NEGATIVE** |
| Extradural hematoma | EDH | "left facial soft-tissue contusion/hematoma" | **WRONG FINDING** |
| Subdural hematoma | SDH | "left maxillary sinus mucous retention cyst" | **WRONG FINDING + MISSED** |

MedGemma was equally poor, extracting "Normal" or "No focal finding" for all 5 neuro STAT cases.

MedGemma also shows the highest hallucination rates across the entire dataset in this domain (avg 9.20/case), with Basal ganglia reaching 12 and ICH reaching 11 — suggesting that both models generate extensive confabulatory content when failing to identify the correct pathology.

---

## 5. STAT Case Safety Analysis

This section focuses exclusively on the 6 is_stat=1 cases, which represent life-threatening emergencies where diagnostic failure has direct patient-safety implications.

| Case | Domain | GPT Recall | Gemma Recall | GPT Top-1 | Gemma Top-1 | Primary Risk |
|---|---|---|---|---|---|---|
| Pneumothorax (chest_009) | Chest | ✅ 1 | ❌ 0 | ✅ 1 | ❌ 0 | Tension physiology missed by Gemma |
| Basal ganglia hemorrhage (neuro_001) | Neuro | ✅ 1 | ❌ 0 | ❌ 0 | ❌ 0 | Both engines false-negative |
| Extradural hematoma (neuro_005) | Neuro | ✅ 1 | ❌ 0 | ❌ 0 | ❌ 0 | Both engines wrong finding |
| Intracranial hemorrhage (neuro_001) | Neuro | ✅ 1 | ❌ 0 | ❌ 0 | ❌ 0 | Both engines false-negative |
| Subarachnoid hemorrhage (neuro_004) | Neuro | ✅ 1 | ❌ 0 | ❌ 0 | ❌ 0 | Both engines false-negative |
| Subdural hematoma (neuro_003) | Neuro | ❌ 0 | ❌ 0 | ❌ 0 | ❌ 0 | **Both engines completely missed** |

**Summary:**

| | GPT-5.4-mini | MedGemma |
|---|---|---|
| STAT cases flagged as urgent | 5/6 (83.3%) | 0/6 (0.0%)* |
| STAT cases with correct extracted finding | 1/6 (Pneumothorax only) | 0/6 |
| Brain hemorrhage cases with correct finding | 0/5 (0%) | 0/5 (0%) |

*\*Discrepancy with summary file (0.167); see Section 8.*

**Interpretation:** Despite GPT's high STAT recall, the extracted findings for brain hemorrhagic emergencies are universally false negative. If the platform's urgency flagging relies on the recall signal independently from the extracted finding, users may see "urgent" without the specific diagnosis, which could be confusing. If it relies on the extracted finding, both engines fail to trigger appropriate alerts for neuro hemorrhages.

**Recommendation:** The SARa platform must display a non-waivable disclaimer on every analysis result that the AI finding has not been verified by a radiologist and must never be used as a sole clinical decision. STAT urgency logic should not rely on the extracted_finding field for neuro CT cases.

---

## 6. Hallucination Analysis

### 6.1 Distribution

| Range | GPT-5.4-mini Cases | MedGemma Cases |
|---|---|---|
| 0–2 | 8 cases | 8 cases |
| 3–5 | 9 cases | 5 cases |
| 6–8 | 4 cases | 3 cases |
| 9–12 | 1 case (11) | 4 cases |

### 6.2 Highest-Hallucination Cases

**GPT-5.4-mini:**

| Rank | Case | Hallucinations | Nature of Error |
|---|---|---|---|
| 1 | abdomen_003 Duodenal perforation | **11** | Extracted "Saddle pulmonary embolus" — wrong organ system |
| 2 | neuro_003 Subdural hematoma | **8** | Extracted sinus cyst; missed SDH entirely |
| 3 | chest_008 Acute pulmonary edema | **7** | Extracted "cavitary infection/reactivation TB" |
| 3 | chest_002 Pulmonary tuberculosis | **7** | Extracted "atypical/viral pneumonitis" |
| 5 | abdomen_002 HCC | **6** | Extracted "left atrial appendage thrombus" (cardiac) |
| 5 | msk_001 Compression fracture | **6** | Confused with Osteosarcoma |

**MedGemma:**

| Rank | Case | Hallucinations | Nature of Error |
|---|---|---|---|
| 1 | neuro_001 Basal ganglia hemorrhage | **12** | Extracted "Normal" — maximum false-negative |
| 2 | neuro_001 Intracranial hemorrhage | **11** | Extracted "No focal finding" |
| 3 | neuro_004 SAH | **9** | Extracted "No focal finding" |
| 4 | neuro_005 Extradural hematoma | **7** | Extracted "Small calcified lesion" |
| 4 | neuro_003 SDH | **7** | Extracted "Normal" |
| 4 | abdomen_001 Acute appendicitis | **7** | Extracted "perforated viscus" (wrong specificity) |
| 4 | abdomen_002 HCC | **7** | Extracted "Cardiomegaly" |

**Pattern observation:** MedGemma's hallucination problem concentrates heavily in neuro CT cases. GPT's hallucination problem concentrates in cases where the actual diagnosis is atypical or where the image set involves multi-modality (abdomen_003 was X-ray + CT).

### 6.3 Cross-Organ Confabulation Incidents

| Case | Model | Actual Region | Hallucinated Region | Extracted Finding |
|---|---|---|---|---|
| abdomen_003 (Duodenal perf.) | GPT | Abdomen | Thorax | "Saddle pulmonary embolus" |
| abdomen_002 (HCC) | GPT | Abdomen | Cardiac | "left atrial appendage thrombus" |
| abdomen_002 (HCC) | MedGemma | Abdomen | Cardiac | "Cardiomegaly" |

These represent the most dangerous hallucination type — the model's primary extracted finding is from an entirely wrong organ system.

---

## 7. Reasoning Fidelity Analysis

### 7.1 GPT-5.4-mini Fidelity

All 22 cases scored either 0.8 (20 cases) or 0.6 (2 cases). No case scored below 0.6, meaning GPT's reasoning chain structure is consistently present even when the diagnosis is incorrect.

Lower-fidelity GPT cases:
- neuro_001 Basal ganglia hemorrhage (0.6) — reasoning contradicts the STAT nature of the case
- neuro_004 Subarachnoid hemorrhage (0.6) — reasoning concludes no intracranial finding on a hemorrhage case

### 7.2 MedGemma Fidelity

MedGemma fidelity varies widely (0.0–0.8), with significant clustering at low values for neuro cases:

| Score | Cases (n) | Domains |
|---|---|---|
| 0.0 | 1 | abdomen_002 (HCC) |
| 0.2 | 5 | spine_001, neuro_001 ×2, neuro_004, neuro_003 |
| 0.4 | 3 | chest_007, extremity_001, msk_002 |
| 0.6 | 5 | abdomen_001 ×2, chest_008, chest_009, msk_001 |
| 0.8 | 6 | chest_008 MRSA, chest_006, chest_002, msk_001, neuro_005 |

**Domain-level MedGemma fidelity:**

| Domain | Avg Fidelity (Gemma) |
|---|---|
| Neuro | 0.320 |
| Abdomen | 0.400 |
| MSK + Spine | 0.440 |
| Chest | 0.667 |

MedGemma is most reliable on chest X-ray cases and most unreliable on neuro CT.

---

## 8. Data Quality & Consistency Notes

### 8.1 MedGemma Missing Data

Two cases have no MedGemma evaluation data (all gemma_* fields empty):

| Case | Title | Modality | STAT |
|---|---|---|---|
| abdomen_003 | Duodenal perforation | X-ray + CT | No |
| neuro_002 | Glioblastoma NOS | CT | No |

**Action required:** Re-run MedGemma evaluation for these two cases. The multi-modality input (X-ray + CT) in abdomen_003 may be the cause of the failure.

### 8.2 Summary vs CSV Discrepancy — MedGemma STAT Recall

The `average_eval.md` summary reports MedGemma STAT recall = **0.167** (implying 1 of 6 STAT cases recalled). However, all 6 STAT case rows in `scores.csv` have `gemma_recall = 0`.

| Source | MedGemma STAT Recall |
|---|---|
| `average_eval.md` | 0.167 (1/6) |
| `scores.csv` raw data | 0.000 (0/6) |

**Action required:** Identify which STAT case was considered recalled in the summary computation and correct either the CSV or the summary. Until resolved, the more conservative figure (0.000) should be used in any reporting.

### 8.3 Duplicate case_id Usage

`abdomen_001` and `msk_001` and `neuro_001` each appear as the case_id for two distinct clinical cases. This is not necessarily an error (the same patient folder may contain multiple findings), but it creates ambiguity in case-level reporting and may complicate evaluation scripting.

### 8.4 GPT STAT Recall Paradox (Neuro)

GPT records STAT recall=1 for 4 of the 5 neuro STAT cases (Basal ganglia, Extradural, ICH, SAH) yet simultaneously extracts findings of "no acute finding" or "no acute CT abnormality" for 3 of those same cases. This is logically inconsistent: a model cannot correctly flag urgency while also concluding there is no acute finding.

Possible explanations:
1. The `gpt_recall` field captures urgency-flag behavior from a separate pipeline step (e.g., a classification prompt) that runs before the final extracted finding is generated.
2. There was an evaluation error in assigning recall=1.

**Action required:** Clarify the exact definition and measurement methodology for `gpt_recall` in the evaluation script.

---

## 9. Alignment with TEST_PLAN.md

The following test cases from the Test Plan directly relate to AI analysis engine quality:

| Test Case | Area | Verdict from Eval Data |
|---|---|---|
| TC-ANAL-003 | GPT 4-step analysis covers all fields | **Partial** — fields present but CONCLUSION quality poor for neuro hemorrhage |
| TC-ANAL-006 | Brain tumor analysis mentions relevant findings | **Pass for Glioblastoma** (neuro_002, top-1 correct, halluc=1) |
| TC-ANAL-007 | Pneumonia CT analysis mentions consolidation | **Not directly tested** — no pneumonia CT case in scores.csv |
| TC-ANAL-008 | Normal case recognized as normal | **Concern** — engines generate detailed pathology descriptions for cases where no pathology was found (inverse problem: calling abnormal as normal seen in neuro) |
| TC-PRAC-002 | DESCRIBE step: bone fracture | **Supportive** — GPT correctly described Greenstick (extremity_001, top-1 correct) |
| TC-PRAC-005 | CONCLUSION step: brain tumor | **Supportive** — Glioblastoma conclusion was correct |
| TC-VAL-001–004 | Valid radiology image acceptance | **Not directly evaluated** — scores.csv tests model output quality, not validation pipeline |

---

## 10. Conclusions & Recommendations

### 10.1 Comparative Assessment

GPT-5.4-mini is the significantly stronger analysis engine across all evaluated metrics and is the correct choice as the premium-tier engine. MedGemma-1.5-4B shows insufficient performance for clinical-educational use as-is, with near-zero top-1 accuracy and complete failure on all neuro STAT cases.

### 10.2 Recommendations

**P0 — Safety-critical (implement before any production release):**

1. **Neuro CT disclaimer:** Add a mandatory, non-dismissible warning on all CT brain analysis results from both engines stating that the AI consistently fails to detect intracranial hemorrhage and that a radiologist must review any neuro CT.
2. **STAT flagging logic audit:** Do not rely on extracted_finding text for urgency detection in neuro cases. If the platform has a separate STAT classifier, evaluate it independently.
3. **Resolve STAT recall paradox:** Clarify whether GPT genuinely flagged brain hemorrhage cases as urgent while extracting "no acute finding" — this is a critical safety logic gap.

**P1 — Data integrity (resolve before next evaluation cycle):**

4. Re-run MedGemma on abdomen_003 and neuro_002 to fill the 2 missing rows.
5. Reconcile the MedGemma STAT recall discrepancy between summary (0.167) and CSV (0.000).
6. Document the exact `gpt_recall` measurement methodology.

**P2 — Model improvement:**

7. Consider fine-tuning or prompt engineering for cross-organ hallucination cases (abdomen cases producing cardiac/pulmonary findings).
8. Evaluate MedGemma on a larger neuro CT dataset with varied hemorrhage subtypes before using it in any clinical-educational context involving brain imaging.
9. Target top-1 accuracy improvement for both engines, particularly in chest non-STAT (currently 0% for both) and abdomen.

---

## Appendix A — Full Case-Level Data

| # | case_id | Title | Modality | STAT | GPT Recall | G Recall | GPT Top1 | G Top1 | GPT Extracted | G Extracted | GPT Halluc | G Halluc | GPT Fidelity | G Fidelity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | abdomen_001 | Acute appendicitis | CT | 0 | — | — | 0 | 0 | perforated hollow viscus | perforated viscus | 2 | 7 | 0.8 | 0.6 |
| 2 | abdomen_003 | Duodenal perforation | X-ray, CT | 0 | — | — | 0 | N/A | Saddle pulmonary embolus | N/A | 11 | N/A | 0.8 | N/A |
| 3 | abdomen_002 | Hepatocellular carcinoma | CT | 0 | — | — | 0 | 0 | left atrial appendage thrombus | Cardiomegaly | 6 | 7 | 0.8 | 0.0 |
| 4 | abdomen_001 | Pneumoperitoneum | X-ray | 0 | — | — | **1** | **1** | perforated abdominal viscus with pneumoperitoneum | perforated viscus | 2 | 4 | 0.8 | 0.6 |
| 5 | chest_008 | Acute pulmonary edema | X-ray | 0 | — | — | 0 | 0 | cavitary infection/reactivation tuberculosis | pneumonia | 7 | 3 | 0.8 | 0.6 |
| 6 | chest_008 | Community MRSA pneumonia | X-ray | 0 | — | — | 0 | 0 | cavitary infection/reactivation tuberculosis | pneumonia | 3 | 2 | 0.8 | 0.8 |
| 7 | chest_007 | Pleural effusion | X-ray | 0 | — | — | 0 | 0 | pneumomediastinum | thymoma | 4 | 4 | 0.8 | 0.4 |
| 8 | chest_006 | Pneumocystis pneumonia | X-ray | 0 | — | — | 0 | 0 | viral bronchiolitis/viral pneumonitis | pulmonary edema | 2 | 2 | 0.8 | 0.8 |
| 9 | chest_009 | **Pneumothorax** | X-ray | **1** | **1** | 0 | **1** | 0 | large left pneumothorax with mild tension physiology | pneumonia | 3 | 2 | 0.8 | 0.6 |
| 10 | chest_002 | Pulmonary tuberculosis | X-ray | 0 | — | — | 0 | 0 | atypical/viral pneumonitis | Interstitial Lung Disease | 7 | 3 | 0.8 | 0.8 |
| 11 | chest_007 | T1b apical lung cancer | X-ray + CT | 0 | — | — | 0 | 0 | pneumomediastinum | thymoma | 5 | 4 | 0.8 | 0.6 |
| 12 | extremity_001 | Greenstick fractures | X-ray | 0 | — | — | **1** | 0 | left radial diaphyseal greenstick fracture | Distal radius fracture | 4 | 2 | 0.8 | 0.4 |
| 13 | spine_001 | Lumbar disc herniation | MRI | 0 | — | — | **1** | 0 | degenerative disc herniation | Normal | 3 | 3 | 0.8 | 0.2 |
| 14 | msk_001 | Lumbar compression fracture | X-ray | 0 | — | — | 0 | 0 | osteosarcoma | osteomyelitis | 6 | 1 | 0.8 | 0.6 |
| 15 | msk_002 | Osteomyelitis (diabetic foot) | X-ray | 0 | — | — | 0 | 0 | rt. lateral forefoot soft tissue injury + subcut. gas | Normal | 3 | 2 | 0.8 | 0.4 |
| 16 | msk_001 | Osteosarcoma | X-ray | 0 | — | — | **1** | 0 | osteosarcoma | osteomyelitis | 1 | 2 | 0.8 | 0.6 |
| 17 | neuro_001 | **Basal ganglia hemorrhage** | CT | **1** | **1** | 0 | 0 | 0 | no acute focal finding in the imaged brain/upper neck region | Normal | 1 | 12 | 0.6 | 0.2 |
| 18 | neuro_005 | **Extradural hematoma** | CT | **1** | **1** | 0 | 0 | 0 | left facial soft-tissue contusion/hematoma | Small calcified lesion | 3 | 7 | 0.8 | 0.8 |
| 19 | neuro_002 | Glioblastoma NOS | CT | 0 | — | — | **1** | N/A | glioblastoma | N/A | 1 | N/A | 0.8 | N/A |
| 20 | neuro_001 | **Intracranial hemorrhage** | CT | **1** | **1** | 0 | 0 | 0 | no acute CT abnormality in the imaged brain/upper neck region | No focal finding. Normal. | 1 | 11 | 0.8 | 0.2 |
| 21 | neuro_004 | **Subarachnoid hemorrhage** | CT | **1** | **1** | 0 | 0 | 0 | no acute intracranial abnormality | No focal finding | 5 | 9 | 0.6 | 0.2 |
| 22 | neuro_003 | **Subdural hematoma** | CT | **1** | **0** | 0 | 0 | 0 | left maxillary sinus mucous retention cyst | Normal | 8 | 7 | 0.8 | 0.2 |

*Bold = STAT case. G = MedGemma. N/A = not evaluated.*

---

*Report generated: 2026-05-16 · Source files: `Data/results/scores.csv`, `Data/results/average_eval.md`, `documents/TEST_PLAN.md`*
