# SARa (Smart AI Radiology) — Test Plan

**Version:** 2.0  
**Date:** 2026-05-12  
**Project:** A20-App-076  
**Coverage:** Backend API · Frontend UI · Image Validation · Analysis Pipeline · Practice Sessions

---

## 1. Scope

This test plan covers every user-facing feature of the SARa platform end-to-end, using labeled medical images from `Data/Test Data/Medical Imagining/` as test fixtures. The dataset spans six imaging domains, three radiology modalities (X-ray, CT, MRI), and two analysis engines (VLM / GPT).

### Out of scope
- Supabase internal infrastructure
- HuggingFace Gradio Space uptime
- Third-party OpenAI availability

---

## 2. Test Environment

| Layer | Details |
|---|---|
| Backend | Django 4.x · DRF · `http://localhost:8000` |
| Frontend | React 18 + Vite · `http://localhost:5173` (or `2173`) |
| Database | Supabase (PostgreSQL) |
| Analysis VLM | MedGemma via Gradio (`ttnguyen6716/MedGemma-1.5-4B`) |
| Analysis GPT | GPT-4o / GPT-4o-mini via OpenAI API |
| Validation | GPT-4o Vision |

### Environment variables required

```
OPENAI_API_KEY=<set>
HF_API_KEY=<set>
SUPABASE_URL=<set>
SUPABASE_SERVICE_KEY=<set>
CORS_ALLOWED_ORIGINS includes http://localhost:5173 and http://localhost:2173
```

### Test accounts

| Account | Role | is_premium |
|---|---|---|
| `free@test.com` / `test123` | student | false |
| `premium@test.com` / `test123` | student | true |

---

## 3. Test Data Reference

All images are sourced from `Data/Test Data/Medical Imagining/`. Each subfolder name is the ground-truth diagnosis label. Images are split into `Test/` (or `Testing/`) and `Train/` (or `Training/`) sets — use the **Test/** set unless otherwise noted.

### 3.1 Bone Break Classification — X-ray · region: extremity

**Path:** `Data/Test Data/Medical Imagining/Bone Break Classification/`

| ID | Folder | Images in Test/ | Sample File |
|---|---|---|---|
| BB-01 | `Avulsion fracture/Test/` | 14 | `000002_png.rf.c3e00ebc2db78bc94e644c3f6605dad0.jpg` |
| BB-02 | `Comminuted fracture/Test/` | 14 | `images94_jpg.rf.1be75680f0289a4d2bcc8d0c112a3453.jpg` |
| BB-03 | `Fracture Dislocation/Test/` | 19 | *(any .jpg in folder)* |
| BB-04 | `Greenstick fracture/Test/` | 16 | `0-_jumbo_jpeg.rf.f83148ed2e6771e243f98f5595db6b9c.jpg` |
| BB-05 | `Hairline Fracture/Test/` | 10 | `0-_jumbo_jpeg.rf.d39588df830d194c0cda3b800664160b.jpg` |
| BB-06 | `Impacted fracture/Test/` | 9 | *(any .jpg in folder)* |
| BB-07 | `Longitudinal fracture/Test/` | 12 | *(any .jpg in folder)* |
| BB-08 | `Oblique fracture/Test/` | 16 | *(any .jpg in folder)* |
| BB-09 | `Pathological fracture/Test/` | 18 | *(any .jpg in folder)* |
| BB-10 | `Spiral Fracture/Test/` | 12 | `0-_jumbo_jpeg.rf.7645898c0465d33bcd71ee0ddb847e0a.jpg` |

### 3.2 Brain Tumor Classification — MRI · region: brain

**Path:** `Data/Test Data/Medical Imagining/Brain Tumor Classification/Testing/`

| ID | Folder | Sample File |
|---|---|---|
| BT-01 | `glioma/` | `Te-glTr_0000.jpg` |
| BT-02 | `meningioma/` | `Te-meTr_0000.jpg` |
| BT-03 | `notumor/` | `Te-noTr_0000.jpg` |
| BT-04 | `pituitary/` | `Te-piTr_0000.jpg` |

### 3.3 Lung Cancer Classification — CT · region: chest

**Path:** `Data/Test Data/Medical Imagining/Lung Cancer Classification/test/`

| ID | Folder | Sample Files |
|---|---|---|
| LC-01 | `adenocarcinoma/` | `000108 (3).png`, `000109 (2).png` |
| LC-02 | `large.cell.carcinoma/` | *(any .png in folder)* |
| LC-03 | `normal/` | *(any .png in folder)* |
| LC-04 | `squamous.cell.carcinoma/` | *(any .png in folder)* |

### 3.4 Pneumonia — CT · region: chest

**Path:** `Data/Test Data/Medical Imagining/Pneumonia/CT/`

| ID | Files |
|---|---|
| PN-01 | `000002 (4).png`, `000002 (6).png` |

### 3.5 Renal Malignancy Classification — CT · region: abdomen

**Path:** `Data/Test Data/Medical Imagining/Renal Malignancy Classification/CT-KIDNEY-DATASET-Normal-Cyst-Tumor-Stone/CT-KIDNEY-DATASET-Normal-Cyst-Tumor-Stone/`

| ID | Folder | Sample File |
|---|---|---|
| RM-01 | `Cyst/` | `Cyst- (1).jpg` |
| RM-02 | `Normal/` | `Normal- (1).jpg` |
| RM-03 | `Stone/` | `Stone- (1).jpg` |
| RM-04 | `Tumor/` | `Tumor- (1).jpg` |

### 3.6 Skin Lesions Classification — Dermoscopy · (non-radiology)

**Path:** `Data/Test Data/Medical Imagining/Skin Lesions Classification/test/`

| ID | Folder | Sample File | Note |
|---|---|---|---|
| SL-01 | `benign/` | `1.jpg` | Used for negative validation tests |
| SL-02 | `malignant/` | `1.jpg` | Used for negative validation tests |

> Skin dermoscopy images are medical in nature but are **not** radiology (X-ray/CT/MRI). They are used exclusively to test modality-mismatch and non-standard-modality rejection.

---

## 4. Test Cases

### 4.1 Authentication

---

#### TC-AUTH-001 — Register new user

**Feature:** `POST /api/v1/auth/register/`

| | |
|---|---|
| **Preconditions** | Email not yet registered |
| **Steps** | POST `{ "email": "newuser@test.com", "password": "test123", "full_name": "Test User" }` |
| **Expected** | 201 · `{ user: { id, email, full_name, role }, access_token, refresh_token, expires_at }` |
| **Negative** | POST with `password` length < 6 → 400 with validation error |

---

#### TC-AUTH-002 — Login and check is_premium flag

**Feature:** `POST /api/v1/auth/login/`

| | |
|---|---|
| **Preconditions** | Accounts `free@test.com` and `premium@test.com` exist |
| **Steps** | 1. POST free credentials → verify `user.is_premium = false`<br>2. POST premium credentials → verify `user.is_premium = true` |
| **Expected** | 200 · user object contains `is_premium` boolean matching database value |
| **Negative** | Wrong password → 401 |

---

#### TC-AUTH-003 — Me endpoint returns is_premium

**Feature:** `GET /api/v1/auth/me/`

| | |
|---|---|
| **Steps** | GET with `Authorization: Bearer <token>` for each account |
| **Expected** | 200 · `{ id, email, full_name, role, is_premium }` — matches login response |
| **Negative** | No token → 401 |

---

#### TC-AUTH-004 — Logout invalidates session

**Feature:** `POST /api/v1/auth/logout/`

| | |
|---|---|
| **Steps** | 1. POST logout<br>2. Try GET `/api/v1/auth/me/` with same token |
| **Expected** | Logout: 200 `{ success: true }` · Me after logout: 401 |

---

#### TC-AUTH-005 — CORS from frontend origins

| | |
|---|---|
| **Steps** | Make any authenticated API call from browser frontend on `localhost:5173` and `localhost:2173` |
| **Expected** | No CORS errors · `Access-Control-Allow-Origin` header present |

---

### 4.2 Image Validation

These tests exercise `classify_and_validate_images` (GPT-4o Vision) which runs before any image is stored.

---

#### TC-VAL-001 — Accept valid X-ray (bone fracture)

**Test data:** BB-04 `Greenstick fracture/Test/` · modality=`XRAY` · region=`extremity`

| | |
|---|---|
| **Steps** | Upload 1–3 X-ray images with matching modality and region |
| **Expected** | `validation.valid = true` · all images: `is_medical=true`, `matches_declared_modality=true`, `matches_declared_region=true` · upload proceeds |

---

#### TC-VAL-002 — Accept valid MRI (brain tumor)

**Test data:** BT-01 `glioma/Te-glTr_0000.jpg` · modality=`MRI` · region=`brain`

| | |
|---|---|
| **Steps** | Upload MRI image with matching modality and region |
| **Expected** | `valid = true` · `type` contains "MRI" · no issues |

---

#### TC-VAL-003 — Accept valid CT (lung)

**Test data:** LC-01 `adenocarcinoma/000108 (3).png` and `000109 (2).png` · modality=`CT` · region=`chest`

| | |
|---|---|
| **Steps** | Upload 2 CT chest slices as one volume |
| **Expected** | `valid = true` · both images accepted · case created |

---

#### TC-VAL-004 — Accept valid CT (kidney)

**Test data:** RM-04 `Tumor/Tumor- (1).jpg` · modality=`CT` · region=`abdomen`

| | |
|---|---|
| **Steps** | Upload kidney CT image · declare region=`abdomen` |
| **Expected** | `valid = true` · `region` detected as abdomen/kidney |

---

#### TC-VAL-005 — Reject non-radiology image (skin dermoscopy)

**Test data:** SL-01 `Skin Lesions Classification/test/benign/1.jpg` · modality=`XRAY`

| | |
|---|---|
| **Steps** | Upload dermoscopy skin image and declare modality=XRAY |
| **Expected** | 422 · `error_type = "not_medical"` OR `"modality_mismatch"` · Vietnamese issue message |

---

#### TC-VAL-006 — Reject modality mismatch (MRI declared as X-ray)

**Test data:** BT-02 `meningioma/Te-meTr_0000.jpg` · declared modality=`XRAY`

| | |
|---|---|
| **Steps** | Upload MRI brain image but declare modality=XRAY |
| **Expected** | 422 · `error_type = "modality_mismatch"` · issue message: "không khớp loại ảnh khai báo (XRAY): phát hiện MRI" |

---

#### TC-VAL-007 — Reject declared region mismatch

**Test data:** RM-01 `Cyst/Cyst- (1).jpg` (kidney CT) · modality=`CT` · declared region=`brain`

| | |
|---|---|
| **Steps** | Upload kidney CT but declare region=`brain` |
| **Expected** | 422 · `error_type = "region_mismatch"` · issue message: "không khớp vùng khai báo (brain)" |

---

#### TC-VAL-008 — Reject mixed modality in same upload

**Test data:** BB-01 X-ray + BT-01 MRI in one request

| | |
|---|---|
| **Steps** | Upload one bone X-ray and one brain MRI in the same request · declare modality=`XRAY` |
| **Expected** | 422 · `error_type = "mixed_modality"` · issue identifies both image indices |

---

#### TC-VAL-009 — Reject mixed region within a volume

**Test data:** BB-04 Greenstick X-ray (extremity) + LC-01 adenocarcinoma CT (chest) assigned to same `volume_name=Default`

| | |
|---|---|
| **Steps** | Upload both images · assign the same `volume_name` |
| **Expected** | 422 · `error_type = "mixed_region"` OR `"mixed_modality"` · issue message identifies the region difference |

---

#### TC-VAL-010 — Accept multi-volume upload (same modality, different sequences)

**Test data:** Multiple lung CT slices from LC-01 and LC-02 split into two volumes

| | |
|---|---|
| **Steps** | Upload 2 images as `volume_name=Volume_A` and 2 as `volume_name=Volume_B` · modality=`CT` · region=`chest` |
| **Expected** | `valid = true` · 4 `case_images` rows with correct `volume_name` values |

---

#### TC-VAL-011 — Skip validation gracefully when OPENAI_API_KEY absent

| | |
|---|---|
| **Steps** | Temporarily unset `OPENAI_API_KEY` · upload any image from BB-04 |
| **Expected** | Upload proceeds (validation skipped) · warning in server log · no 422 returned |

---

#### TC-VAL-012 — Reject more than 20 images

| | |
|---|---|
| **Test data** | 21 images from `BB-01/Test/` (14 available — supplement with any others) |
| **Steps** | Submit 21 image files in one request |
| **Expected** | 400 · `error = "too_many_images"` · `max_images` in response |

---

### 4.3 Image Upload & Case Creation

---

#### TC-UPLOAD-001 — Full upload with VLM engine (free tier)

**Test data:** BB-04 `Greenstick fracture/Test/` · 2 images · free user

| | |
|---|---|
| **Preconditions** | Logged in as free user · `engine` auto-set to `vlm` |
| **Steps** | Upload X-ray images · modality=`XRAY` · region=`extremity` · title=`Greenstick Fracture Test` |
| **Expected** | 201 · `engine=vlm` · `findings.answer_key` has DESCRIBE, REASONING, DDx, CONCLUSION (all plain strings) |
| **DB check** | Rows inserted in `cases`, `case_images`, `answer_keys`, `upload_sessions` |

---

#### TC-UPLOAD-002 — Full upload with GPT engine (premium tier)

**Test data:** BT-01 `glioma/Te-glTr_0000.jpg` · premium user

| | |
|---|---|
| **Preconditions** | Logged in as premium user · `engine` auto-set to `gpt` |
| **Steps** | Upload MRI image · modality=`MRI` · region=`brain` |
| **Expected** | 201 · `engine=gpt` · 4-step analysis from GPT-4o Vision · no `llm_completion_raw` field |

---

#### TC-UPLOAD-003 — Engine routing matches tier

| | |
|---|---|
| **Steps** | 1. Login as free → check `formData.engine = vlm` in network request<br>2. Login as premium → check `formData.engine = gpt` |
| **Expected** | Engine value set automatically by `engineForUser(is_premium)` — user sees no engine selector |

---

#### TC-UPLOAD-004 — Multi-volume CT upload

**Test data:** LC-01 adenocarcinoma CT — 4 slices split into 2 volumes

| | |
|---|---|
| **Steps** | Upload `000108 (3).png` and `000109 (2).png` as `volume_name=Series_A` · `000109 (4).png` and `000109 (5).png` as `volume_name=Series_B` · modality=`CT` · region=`chest` |
| **Expected** | 201 · 4 `case_images` rows with correct `volume_name` · `slice_index` stored |

---

#### TC-UPLOAD-005 — Title auto-generated when omitted

| | |
|---|---|
| **Steps** | Upload without title (or `title=Untitled Case`) |
| **Expected** | Response title = `findings.title` from AI (e.g. `CT Case – GPT`) not "Untitled Case" |

---

#### TC-UPLOAD-006 — Unsupported file format rejected

| | |
|---|---|
| **Test data** | Rename any test image to `.pdf` or `.tiff` |
| **Steps** | Attempt upload with unsupported extension |
| **Expected** | 400 · error lists accepted formats: jpg, jpeg, png, bmp, gif |

---

### 4.4 Analysis Pipeline

---

#### TC-ANAL-001 — VLM pipeline returns all 4 step codes as strings

**Test data:** BB-08 `Oblique fracture/Test/` · engine=`vlm`

| | |
|---|---|
| **Steps** | Upload X-ray and complete analysis |
| **Expected** | `answer_key` keys = `[DESCRIBE, REASONING, DDx, CONCLUSION]` · all values are strings, not lists or dicts |

---

#### TC-ANAL-002 — LLM completion normalizes DDx from VLM (not an array)

**Test data:** BB-02 `Comminuted fracture/Test/` · engine=`vlm`

| | |
|---|---|
| **Steps** | Upload with VLM engine · inspect `answer_key.DDx` |
| **Expected** | DDx is a plain string (e.g. `"Comminuted fracture; Stress fracture; Pathological fracture; Normal variant"`) — not a JSON array or Python repr `[{...}]` |

---

#### TC-ANAL-003 — GPT 4-step analysis covers all fields

**Test data:** RM-04 `Tumor/Tumor- (1).jpg` · engine=`gpt` · modality=`CT` · region=`abdomen`

| | |
|---|---|
| **Steps** | Upload with engine=gpt |
| **Expected** | All 4 `answer_key` fields non-empty · CONCLUSION contains a confidence level (High/Moderate/Low) and a recommended next step |

---

#### TC-ANAL-004 — Mock fallback when HF token absent

| | |
|---|---|
| **Steps** | Unset `HF_API_KEY` · upload BB-05 `Hairline Fracture/Test/` with engine=vlm |
| **Expected** | 201 · `answer_key` contains modality-appropriate mock text · server logs "HF_TOKEN không được set — dùng mock mode" |

---

#### TC-ANAL-005 — Analyze-image endpoint (no case creation)

**Test data:** BT-03 `notumor/Te-noTr_0000.jpg` · modality=`MRI` · region=`brain`

| | |
|---|---|
| **Steps** | POST `/api/v1/uploaded-cases/analyze-image/` with image · no `case_id` |
| **Expected** | 200 · findings returned · no new row in `cases` or `upload_sessions` |

---

#### TC-ANAL-006 — Brain tumor analysis mentions relevant findings

**Test data:** BT-01 `glioma/Te-glTr_0000.jpg` · engine=`gpt`

| | |
|---|---|
| **Steps** | Upload glioma MRI with engine=gpt |
| **Expected** | DESCRIBE mentions ring-enhancement, mass, or edema · DDx includes glioma or high-grade tumor · CONCLUSION includes MRI or biopsy recommendation |

---

#### TC-ANAL-007 — Pneumonia CT analysis

**Test data:** PN-01 `Pneumonia/CT/000002 (4).png` · modality=`CT` · region=`chest`

| | |
|---|---|
| **Steps** | Upload CT pneumonia image |
| **Expected** | DESCRIBE mentions consolidation, opacity, or infiltrate · DDx includes pneumonia |

---

#### TC-ANAL-008 — Normal case recognized as normal

**Test data:** LC-03 `normal/` (any CT) · engine=`gpt`

| | |
|---|---|
| **Steps** | Upload normal lung CT |
| **Expected** | DESCRIBE does not fabricate abnormalities · CONCLUSION states no focal finding or normal study |

---

### 4.5 Case Management

---

#### TC-CASE-001 — List uploaded cases

| | |
|---|---|
| **Steps** | GET `/api/v1/uploaded-cases/` with auth token after uploading at least 2 cases |
| **Expected** | Array of upload sessions · each item has `case_id`, `modality`, `created_at`, `images` grouped by `volume_name` |

---

#### TC-CASE-002 — Retrieve single case

| | |
|---|---|
| **Steps** | GET `/api/v1/uploaded-cases/{upload_session_id}/` |
| **Expected** | Full case data · only accessible by the uploading user |

---

#### TC-CASE-003 — Delete uploaded case (cascade)

| | |
|---|---|
| **Steps** | 1. Upload BB-01 case · note upload_session_id<br>2. DELETE `/api/v1/uploaded-cases/{id}/`<br>3. Check DB + Supabase Storage |
| **Expected** | 200 `{ deleted: true }` · rows removed from `sessions`, `answer_keys`, `case_images`, `cases`, `upload_sessions` · storage file deleted |

---

#### TC-CASE-004 — Cannot delete another user's case

| | |
|---|---|
| **Steps** | User A uploads case · User B attempts DELETE with User B's token |
| **Expected** | 403 Forbidden |

---

#### TC-CASE-005 — Delete non-existent case

| | |
|---|---|
| **Steps** | DELETE `/api/v1/uploaded-cases/00000000-0000-0000-0000-000000000000/` |
| **Expected** | 404 |

---

### 4.6 Practice Session

---

#### TC-PRAC-001 — Start practice session from uploaded case

**Test data:** Any previously created case (e.g. BB-04 Greenstick fracture)

| | |
|---|---|
| **Steps** | POST `/api/v1/uploaded-cases/{id}/start_practice/` |
| **Expected** | Session created · images displayed in viewer · first step (DESCRIBE) prompted |

---

#### TC-PRAC-002 — DESCRIBE step: bone fracture

**Test data:** BB-02 `Comminuted fracture/` case already uploaded

| | |
|---|---|
| **Steps** | Submit: "Multiple bone fragments visible in the distal radius. Fracture line with comminution pattern. No soft tissue swelling visible." |
| **Expected** | Score > 0 · feedback confirms fragment/comminuted observations · step advances |
| **Negative** | Submit "Normal X-ray, no findings" → low/zero score · feedback hints at missed fracture |

---

#### TC-PRAC-003 — REASONING step: lung cancer CT

**Test data:** LC-01 `adenocarcinoma/` case

| | |
|---|---|
| **Steps** | Submit: "Irregular spiculated mass in the left lower lobe suggesting primary malignancy. No mediastinal lymphadenopathy." |
| **Expected** | Score reflects alignment with adenocarcinoma reasoning · clinical interpretation shown |

---

#### TC-PRAC-004 — DDx step accepts plain-text differential

**Test data:** RM-04 `Tumor/` renal CT case

| | |
|---|---|
| **Steps** | Submit: "Renal cell carcinoma; Oncocytoma; Metastasis; Renal abscess" |
| **Expected** | Feedback shows which differentials match expected · DDx accepted as plain string |

---

#### TC-PRAC-005 — CONCLUSION step: brain tumor

**Test data:** BT-01 `glioma/` MRI case

| | |
|---|---|
| **Steps** | Submit: "Findings consistent with high-grade glioma. High confidence. Recommend urgent neurosurgery referral and MRI spectroscopy." |
| **Expected** | Score awarded · feedback reflects expected conclusion for glioma · confidence level recognized |

---

#### TC-PRAC-006 — Complete full 4-step session

**Test data:** RM-03 `Stone/` renal CT case

| | |
|---|---|
| **Steps** | Complete DESCRIBE → REASONING → DDx → CONCLUSION sequentially |
| **Expected** | Session marked complete · total score computed · session record updated |

---

#### TC-PRAC-007 — Image viewer: zoom, fullscreen, multi-slice

**Test data:** LC-01 adenocarcinoma multi-volume upload (Series_A + Series_B from TC-UPLOAD-004)

| | |
|---|---|
| **Steps** | Open case in DiagnosisSession · zoom in/out · toggle fullscreen · switch between volumes |
| **Expected** | Zoom works without layout break · fullscreen toggles correctly · volume switching shows correct images |

---

#### TC-PRAC-008 — Re-attempt session from scratch

| | |
|---|---|
| **Steps** | Complete a session · navigate away · start same case again |
| **Expected** | New session record created · previous answers not pre-filled · progress stats increment |

---

### 4.7 Answer Key

---

#### TC-AK-001 — Fetch answer key after upload

**Test data:** BB-09 `Pathological fracture/` case

| | |
|---|---|
| **Steps** | GET `/api/v1/uploaded-cases/{id}/findings/` |
| **Expected** | 200 · `answer_keys` array with `step_code`, `expected_finding`, `clinical_explanation` for each of DESCRIBE, REASONING, DDx, CONCLUSION |

---

#### TC-AK-002 — Answer key values are plain strings

**Test data:** BT-04 `pituitary/` MRI case uploaded with GPT engine

| | |
|---|---|
| **Steps** | Fetch findings · inspect each `expected_finding` value |
| **Expected** | All 4 values are strings · DDx does not start with `[` · no embedded `{` objects |

---

### 4.8 Performance & Analytics

---

#### TC-PERF-001 — Performance page shows session history

| | |
|---|---|
| **Steps** | Complete 2+ sessions using different modality cases (e.g. BB-04 XRAY + BT-01 MRI) · open Performance page |
| **Expected** | Sessions listed · score breakdown per step visible · modality/difficulty groupings shown |

---

#### TC-PERF-002 — Dashboard progress stats update

| | |
|---|---|
| **Steps** | Upload 3 cases · complete 1 session · open Dashboard |
| **Expected** | Stats: total cases ≥ 3 · done = 1 · in progress or not started reflects remaining |

---

### 4.9 Frontend UI & Navigation

---

#### TC-UI-001 — Engine selection is automatic and hidden

| | |
|---|---|
| **Steps** | Login as free user · open UploadPage · inspect outgoing network request |
| **Expected** | `engine=vlm` sent automatically · no engine toggle exposed in UI |

---

#### TC-UI-002 — Validation error surfaced in Vietnamese

**Test data:** SL-02 `malignant/1.jpg` (skin dermoscopy) declared as XRAY

| | |
|---|---|
| **Steps** | Upload dermoscopy image via UploadPage |
| **Expected** | Vietnamese error message displayed ("không phải ảnh y tế" or "không khớp loại ảnh khai báo") · upload button re-enabled · no partial state |

---

#### TC-UI-003 — Modality options map correctly to backend

| | |
|---|---|
| **Steps** | Open UploadPage · inspect modality dropdown |
| **Expected** | Options: X-ray → `XRAY`, CT → `CT`, MRI → `MRI` · maps correctly to backend serializer choices |

---

#### TC-UI-004 — Multi-volume upload with volume name fields

**Test data:** LC-01 adenocarcinoma CT — 4 slices

| | |
|---|---|
| **Steps** | Add 4 images · assign `Series_A` and `Series_B` volume labels |
| **Expected** | Each image shows a volume name input · different groups submitted as separate volumes |

---

#### TC-UI-005 — CORS: frontend on port 2173 can call API

| | |
|---|---|
| **Steps** | Run frontend on port 2173 (`--port 2173`) · perform login and upload |
| **Expected** | No CORS error in browser console · requests succeed normally |

---

### 4.10 Regression Checks

After any code change run these spot checks before merging:

| Check | How to verify |
|---|---|
| DDx is always a plain string | Upload any case · inspect `answer_key.DDx` in response — must not start with `[` |
| VLM + LLM completion produces 4 steps | Upload with engine=vlm · count `answer_key` keys = 4 |
| GPT engine skips LLM completion | Upload with engine=gpt · verify `llm_completion_raw` is absent |
| `is_premium` in login response | Login with both accounts · check `user.is_premium` boolean |
| CORS covers port 2173 | Browser dev tools on port 2173 — no preflight error |
| Validation failure returns 422 not 400 | Upload SL-01 skin image · check status code |
| Delete cascades storage file | Upload then delete BB-01 case · check Supabase Storage bucket is empty |

---

## 5. Test Execution Order

Run in this order to avoid state dependencies:

1. **TC-AUTH-001 → TC-AUTH-005** — create accounts first
2. **TC-VAL-001 → TC-VAL-012** — validation only, no storage side effects
3. **TC-UPLOAD-001 → TC-UPLOAD-006** — creates cases used by later tests
4. **TC-ANAL-001 → TC-ANAL-008** — depends on upload pipeline working
5. **TC-CASE-001 → TC-CASE-005** — list/retrieve/delete (TC-CASE-003 is destructive, run last)
6. **TC-PRAC-001 → TC-PRAC-008** — requires uploaded cases
7. **TC-AK-001 → TC-AK-002**
8. **TC-PERF-001 → TC-PERF-002** — requires completed sessions
9. **TC-UI-001 → TC-UI-005**
10. **Regression checks**
