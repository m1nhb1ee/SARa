# Smart AI Radiology Backend — API Endpoints

## Base URL
```
http://localhost:8000/api/v1/
```

## Authentication

All protected endpoints require a Supabase JWT passed as a Bearer token:

```
Authorization: Bearer <access_token>
```

Tokens are obtained from `/auth/login/` or `/auth/register/`. All IDs are UUIDs (strings).

---

## Auth Endpoints

### Register
```
POST /auth/register/
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Nguyễn Văn A"
}
```

**Response 201 — email confirmation disabled (immediate login):**
```json
{
  "user": { "id": "<uuid>", "email": "user@example.com", "role": "student" },
  "access_token": "<jwt>",
  "refresh_token": "<token>",
  "expires_at": 1713178800
}
```

**Response 201 — email confirmation required:**
```json
{
  "message": "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.",
  "requires_confirmation": true
}
```

**Errors:** `400` missing fields / password too short, `409` email already registered

---

### Login
```
POST /auth/login/
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "user": { "id": "<uuid>", "email": "user@example.com", "role": "student" },
  "access_token": "<jwt>",
  "refresh_token": "<token>",
  "expires_at": 1713178800
}
```

**Error 401:** `{ "error": "Email hoặc mật khẩu không đúng" }`

---

### Get Current User
```
GET /auth/me/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "user": { "id": "<uuid>", "email": "user@example.com", "role": "student" }
}
```

---

### Logout
```
POST /auth/logout/
```

Client-side only — clears local token. Response: `{ "success": true }`

---

## Cases

### List Cases
```
GET /cases/
Authorization: Bearer <token>
```

**Query parameters:**
- `modality` — `XRAY` | `CT` | `MRI`
- `difficulty` — `easy` | `medium` | `hard`
- `disease_tag` — filter by disease profile name
- `status` — session status filter

**Response 200:**
```json
{
  "cases": [
    {
      "id": "<uuid>",
      "title": "Viêm phổi điển hình",
      "modality": "X-ray",
      "difficulty": "medium",
      "clinical_history": "Bệnh nhân 45 tuổi, ho sốt 3 ngày",
      "images": [
        {
          "volume_name": "Default",
          "slices": [
            { "image_url": "https://<project>.supabase.co/storage/v1/object/public/case_images/uploads/<uuid>.jpg", "slice_index": 0 }
          ]
        }
      ],
      "tags": [],
      "uploaded_by": null,
      "created_at": "2024-04-15T10:00:00+00:00"
    }
  ],
  "count": 1
}
```

Note: `images` is grouped by volume. Each entry has a `volume_name` and a `slices` array of `{ image_url, slice_index }` objects. Single-volume cases have one entry with `volume_name: "Default"`. `uploaded_by` is `null` for system cases and a user UUID for user-uploaded cases. Cases with `uploaded_by` set are only visible to their owner.

---

### Get Case Detail
```
GET /cases/{uuid}/
Authorization: Bearer <token>
```

**Response 200:** Same shape as list item. `images` is grouped by volume:
```json
{
  "id": "<uuid>",
  "title": "CT Brain Series",
  "modality": "CT",
  "images": [
    {
      "volume_name": "Axial Bone Window",
      "slices": [
        { "image_url": "https://...", "slice_index": 0 },
        { "image_url": "https://...", "slice_index": 1 }
      ]
    },
    {
      "volume_name": "Axial Non Contrast",
      "slices": [
        { "image_url": "https://...", "slice_index": 0 },
        { "image_url": "https://...", "slice_index": 1 }
      ]
    }
  ]
}
```

**Errors:** `400` invalid UUID, `403` not your uploaded case, `404` not found

---

## Sessions

### List Sessions
```
GET /sessions/
Authorization: Bearer <token>
```

**Query parameters:** `status` (`IN_PROGRESS` | `COMPLETED` | `ABANDONED`), `case` (UUID)

**Response 200:**
```json
{
  "count": 2,
  "results": [
    {
      "id": "<uuid>",
      "case_id": "<uuid>",
      "current_step": 2,
      "status": "IN_PROGRESS",
      "final_score": null,
      "started_at": "2024-04-15T10:30:00+00:00",
      "completed_at": null
    }
  ]
}
```

---

### Create Session
```
POST /sessions/
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{ "case_id": "<uuid>" }
```

**Response 201:**
```json
{
  "id": "<uuid>",
  "case_id": "<uuid>",
  "case_title": "Viêm phổi điển hình",
  "current_step": 0,
  "status": "IN_PROGRESS",
  "final_score": null,
  "started_at": "2024-04-15T10:30:00+00:00",
  "completed_at": null
}
```

---

### Get Session Detail
```
GET /sessions/{uuid}/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": "<uuid>",
  "case_id": "<uuid>",
  "current_step": 2,
  "status": "IN_PROGRESS",
  "final_score": null,
  "started_at": "2024-04-15T10:30:00+00:00",
  "completed_at": null,
  "case": {
    "id": "<uuid>",
    "title": "Viêm phổi điển hình",
    "modality": "X-ray",
    "difficulty": "medium",
    "clinical_history": "...",
    "images": [{ "image_url": "https://...", "slice_index": 0 }],
    "tags": []
  },
  "step_attempts": [
    {
      "id": "<uuid>",
      "step_index": 0,
      "step_code": "OBSERVE",
      "student_answer": "Thấy mờ phím ở phổi phải",
      "score": 0.85,
      "errors": [],
      "feedback": "Bước OBSERVE: Tuyệt vời!",
      "attempt_number": 1,
      "latency_ms": 1500,
      "created_at": "2024-04-15T10:32:00+00:00"
    }
  ]
}
```

---

### Submit Answer
```
POST /sessions/{uuid}/submit_answer/
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{ "student_answer": "Tôi thấy một tổn thương mờ phím ở thùy dưới phổi phải..." }
```

**Response 200 — answer fails (score < 0.6):**
```json
{
  "attempt": { "id": "<uuid>", "step_code": "OBSERVE", "score": 0.45, "feedback": "...", ... },
  "passed": false,
  "hint": "Hãy chú ý đến vùng...",
  "message": "Chưa đúng. Hãy xem gợi ý và thử lại."
}
```

**Response 200 — answer passes, session continues:**
```json
{
  "attempt": { ... },
  "passed": true,
  "next_step": 1,
  "message": "Đáp án số được! Chuyển sang bước tiếp theo."
}
```

**Response 200 — final step completed:**
```json
{
  "attempt": { ... },
  "passed": true,
  "session_complete": true,
  "message": "Chúc mừng! Hoàn thành case này."
}
```

Step codes in order: `OBSERVE` → `DESCRIBE` → `INTERPRET` → `HYPOTHESIS` → `DDx` → `CONCLUSION`

---

### Get Step Answers (Answer Key Preview)
```
GET /sessions/{uuid}/step_answers/
Authorization: Bearer <token>
```

Available at any session status. Returns expected answers per step.

**Response 200:**
```json
{
  "session_id": "<uuid>",
  "case_id": "<uuid>",
  "case_title": "Viêm phổi điển hình",
  "case_modality": "X-ray",
  "current_step": 2,
  "status": "IN_PROGRESS",
  "answers": {
    "OBSERVE": {
      "expected_finding": "Phổi phải có mờ phím nhẹ ở thùy dưới",
      "clinical_explanation": "Infiltrate gợi ý viêm phổi",
      "key_points": []
    }
  },
  "step_templates": { "OBSERVE": { ... } }
}
```

---

### View Answer Key (COMPLETED sessions only)
```
GET /sessions/{uuid}/answer_key/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "answer_key": {
    "OBSERVE": {
      "expected_finding": "...",
      "clinical_explanation": "...",
      "key_points": []
    }
  },
  "your_score": 0.78,
  "details": [
    { "step": "OBSERVE", "score": 0.85, "feedback": "Tuyệt vời!" }
  ]
}
```

**Error 403:** `{ "error": "Chỉ xem được đáp án sau khi hoàn thành." }`

---

### Exit Session
```
POST /sessions/{uuid}/exit_session/
Authorization: Bearer <token>
```

Marks session as `ABANDONED`. Only works on `IN_PROGRESS` sessions.

**Response 200:**
```json
{
  "success": true,
  "message": "Session đã được lưu và thoát thành công",
  "session_id": "<uuid>",
  "last_step": 2,
  "timestamp": "2024-04-15T15:30:00+00:00"
}
```

---

## Uploaded Cases

User-uploaded medical images processed by AI (MedGemma via HuggingFace Gradio). Each upload creates an `upload_session` record and a corresponding `case` with AI-generated `answer_keys`.

### List My Uploads
```
GET /uploaded-cases/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "count": 2,
  "results": [
    {
      "id": "<uuid>",
      "user_id": "<uuid>",
      "case_id": "<uuid>",
      "modality": "MRI",
      "created_at": "2024-04-15T14:00:00+00:00",
      "images": [
        {
          "volume_name": "T1",
          "slices": [
            { "image_url": "https://...", "slice_index": 0 },
            { "image_url": "https://...", "slice_index": 1 }
          ]
        },
        {
          "volume_name": "T2",
          "slices": [
            { "image_url": "https://...", "slice_index": 0 },
            { "image_url": "https://...", "slice_index": 1 }
          ]
        }
      ]
    }
  ]
}
```

---

### Upload New Case
```
POST /uploaded-cases/
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields** (all repeatable, sent as parallel arrays in the same order):
- `images` (file, required) — one or more JPG/PNG medical images
- `slice_indexes` (integer, optional) — slice position of the corresponding image within its volume
- `volume_names` (string, optional, default `"Default"`) — volume label for the corresponding image; images sharing the same `volume_name` are grouped into the same volume
- `title` (string, optional) — case title; AI generates one if omitted or `"Untitled Case"`
- `modality` (string, optional, default `XRAY`) — `XRAY` | `CT` | `MRI` | `DIFF`
- `region` (string, optional, default `unspecified`) — anatomical region passed to the AI prompt, e.g. `chest`, `brain`, `spine`, `abdomen`

AI analysis (MedGemma via HuggingFace Gradio) runs across **all uploaded images** at once. The prompt includes volume count and total slice count as context.

**Example — single volume, multiple slices:**
```bash
curl -X POST http://localhost:8000/api/v1/uploaded-cases/ \
  -H "Authorization: Bearer <token>" \
  -F "images=@/path/to/axial1.jpg" \
  -F "images=@/path/to/axial2.jpg" \
  -F "slice_indexes=0" \
  -F "slice_indexes=1" \
  -F "volume_names=Axial" \
  -F "volume_names=Axial" \
  -F "title=CT Brain" \
  -F "modality=CT" \
  -F "region=brain"
```

**Example — multiple volumes:**
```bash
curl -X POST http://localhost:8000/api/v1/uploaded-cases/ \
  -H "Authorization: Bearer <token>" \
  -F "images=@/path/to/t1_s1.jpg" \
  -F "images=@/path/to/t1_s2.jpg" \
  -F "images=@/path/to/t2_s1.jpg" \
  -F "images=@/path/to/t2_s2.jpg" \
  -F "slice_indexes=0" -F "slice_indexes=1" -F "slice_indexes=0" -F "slice_indexes=1" \
  -F "volume_names=T1" -F "volume_names=T1" -F "volume_names=T2" -F "volume_names=T2" \
  -F "modality=MRI" \
  -F "region=brain"
```

**Response 201:**
```json
{
  "upload_session": {
    "id": "<uuid>",
    "user_id": "<uuid>",
    "case_id": "<uuid>",
    "modality": "MRI",
    "created_at": "2024-04-15T14:00:00+00:00"
  },
  "case": {
    "id": "<uuid>",
    "title": "MRI Case – MedGemma",
    "modality": "MRI",
    "difficulty": "medium",
    "clinical_history": "AI (MedGemma) analyzed MRI: ...",
    "uploaded_by": "<uuid>",
    "created_at": "2024-04-15T14:00:00+00:00"
  }
}
```

All images are stored in `case_images` with their `slice_index` and `volume_name`, and returned grouped by volume when fetching via `/cases/{uuid}/`.

**Errors:**
- `400 { "error": "Cần ít nhất một ảnh (field: images)" }` — no files sent
- `400 { "error": "Định dạng ... không được hỗ trợ" }` — unsupported file type
- `400 { "error": "Lỗi xử lý ảnh", "message": "..." }` — storage or AI error

---

### Get Upload Detail
```
GET /uploaded-cases/{uuid}/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": "<uuid>",
  "user_id": "<uuid>",
  "case_id": "<uuid>",
  "modality": "CT",
  "created_at": "2024-04-15T14:00:00+00:00",
  "case": { "id": "<uuid>", "title": "CT Case – MedGemma" }
}
```

---

### Delete Uploaded Case
```
DELETE /uploaded-cases/{uuid}/
Authorization: Bearer <token>
```

Cascade deletes: `sessions` → `answer_keys` → `upload_session` → `case` → Storage image (best-effort). Only the owner can delete.

**Response 200:**
```json
{
  "deleted": true,
  "upload_session_id": "<uuid>",
  "case_id": "<uuid>"
}
```

**Errors:** `403` not owner, `404` upload not found, `500` internal error

---

### Get Case Findings
```
GET /uploaded-cases/{uuid}/findings/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "upload_session_id": "<uuid>",
  "modality": "CT",
  "case_id": "<uuid>",
  "case_title": "CT Case – MedGemma",
  "answer_key_steps": ["OBSERVE", "DESCRIBE", "INTERPRET", "HYPOTHESIS", "DDx", "CONCLUSION"],
  "answer_keys": [
    {
      "step_code": "OBSERVE",
      "expected_finding": "Não bình thường, không thấy máu tụ...",
      "clinical_explanation": "...",
      "key_points": []
    }
  ]
}
```

---

### Start Practice Session from Upload
```
POST /uploaded-cases/{uuid}/start_practice/
Authorization: Bearer <token>
```

Creates a new `IN_PROGRESS` session for the case associated with this upload.

**Response 201:**
```json
{
  "id": "<uuid>",
  "user_id": "<uuid>",
  "case_id": "<uuid>",
  "current_step": 0,
  "status": "IN_PROGRESS",
  "started_at": "2024-04-15T14:05:00+00:00"
}
```

---

## Performance

### Get My Stats
```
GET /performance/my_stats/
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "user_id": "<uuid>",
  "email": "user@example.com",
  "total_cases_completed": 3,
  "average_score": 0.76,
  "accuracy_by_step": {
    "OBSERVE":    0.82,
    "DESCRIBE":   0.75,
    "INTERPRET":  0.71,
    "HYPOTHESIS": 0.78,
    "DDx":        0.76,
    "CONCLUSION": 0.73
  },
  "last_activity": "2024-04-15T15:00:00+00:00"
}
```

---

## Tags

### List Disease Tags
```
GET /tags/
```

Public — no auth required.

**Response 200:**
```json
{
  "tags": [
    { "id": "<uuid>", "name": "Pneumonia", "description": "Viêm phổi" }
  ],
  "count": 1
}
```
