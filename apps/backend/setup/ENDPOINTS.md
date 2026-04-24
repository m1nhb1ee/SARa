# Smart AI Radiology Backend - API Endpoints

## Base URL
```
http://localhost:8000/api/v1/
```

## Authentication
- Session-based authentication
- No authentication required for case listing (public)
- Authentication required for sessions, submissions

## Endpoints

### Authentication

#### Login
```
POST /auth/login/
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "student1",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "student1",
    "email": "student@test.com",
    "is_staff": false
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Tên đăng nhập hoặc mật khẩu không đúng"
}
```

#### Logout
```
POST /auth/logout/
```

**Headers:**
- Session cookie required (set after login)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Đã đăng xuất thành công"
}
```

#### Get Current User Info
```
GET /auth/me/
```

**Headers:**
- Session cookie required

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "student1",
  "email": "student@test.com",
  "first_name": "Nguyễn",
  "last_name": "Văn A",
  "date_joined": "2024-04-15T10:00:00Z"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Authentication required"
}
```

---

### Cases

#### List Cases
```
GET /cases/
```

**Query Parameters:**
- `modality` (string): Filter by modality (XRAY, CT, MRI, ULTRASOUND)
- `difficulty` (string): Filter by difficulty (BASIC, INTERMEDIATE, ADVANCED)
- `search` (string): Search in title, description, clinical_history
- `page` (integer): Page number for pagination (default: 1)
- `page_size` (integer): Items per page (default: 20, max: 100)

**Example:**
```bash
GET /cases/?modality=XRAY&difficulty=BASIC&page=1
```

**Response (200 OK):**
```json
{
  "count": 4,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Viêm phổi điển hình",
      "modality": "XRAY",
      "difficulty": "BASIC",
      "description": "X-ray ngực cho thấy infiltrate phổi...",
      "tags": [
        {
          "id": 1,
          "name": "Chest",
          "description": "Phim ngực"
        }
      ],
      "created_at": "2024-04-15T10:00:00Z"
    }
  ]
}
```

#### Get Case Detail
```
GET /cases/{id}/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "Viêm phổi điển hình",
  "description": "X-ray ngực cho thấy infiltrate phổi...",
  "modality": "XRAY",
  "difficulty": "BASIC",
  "clinical_history": "Bệnh nhân 45 tuổi, nam, ho sốt 3 ngày",
  "image_urls": [
    "https://via.placeholder.com/400x400?text=Chest+XRay+1"
  ],
  "tags": [
    {
      "id": 1,
      "name": "Chest",
      "description": "Phim ngực"
    }
  ],
  "created_at": "2024-04-15T10:00:00Z",
  "updated_at": "2024-04-15T10:00:00Z"
}
```

**Note**: `answer_key` and `pipeline_rubric` are NOT exposed to prevent cheating.

---

### Sessions (Authenticated)

#### List Sessions
```
GET /sessions/
```

**Query Parameters:**
- `status` (string): IN_PROGRESS, COMPLETED, ABANDONED
- `case` (integer): Filter by case ID
- `page` (integer): Page number
- `page_size` (integer): Items per page

**Example:**
```bash
curl -H "Authorization: Session <session-id>" GET /sessions/?status=IN_PROGRESS
```

**Response (200 OK):**
```json
{
  "count": 2,
  "results": [
    {
      "id": 1,
      "case": 1,
      "case_title": "Viêm phổi điển hình",
      "current_step": 2,
      "status": "IN_PROGRESS",
      "total_score": 0.75,
      "started_at": "2024-04-15T10:30:00Z",
      "completed_at": null
    }
  ]
}
```

#### Create Session
```
POST /sessions/
Content-Type: application/json
```

**Request Body:**
```json
{
  "case": 1
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "case": 1,
  "case_title": "Viêm phổi điển hình",
  "current_step": 0,
  "status": "IN_PROGRESS",
  "total_score": 0.0,
  "started_at": "2024-04-15T10:30:00Z",
  "completed_at": null
}
```

#### Get Session Detail
```
GET /sessions/{id}/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "case": {
    "id": 1,
    "title": "Viêm phổi điển hình",
    "description": "...",
    "modality": "XRAY",
    "difficulty": "BASIC",
    "clinical_history": "Bệnh nhân 45 tuổi, nam, ho sốt 3 ngày",
    "image_urls": ["https://..."],
    "tags": [{"id": 1, "name": "Chest"}]
  },
  "current_step": 2,
  "status": "IN_PROGRESS",
  "step_history": [
    {"step": 0, "attempts": 1, "score": 0.85},
    {"step": 1, "attempts": 2, "score": 0.65}
  ],
  "total_score": 0.75,
  "started_at": "2024-04-15T10:30:00Z",
  "completed_at": null,
  "step_attempts": [
    {
      "id": 1,
      "step_index": 0,
      "step_name": "OBSERVE",
      "student_answer": "Thấy mờ phím ở phổi phải",
      "score": 0.85,
      "errors": [],
      "feedback": {
        "type": "correct",
        "content": "Bước OBSERVE: Tuyệt vời!"
      },
      "latency_ms": 1500,
      "created_at": "2024-04-15T10:32:00Z"
    }
  ]
}
```

#### Submit Answer
```
POST /sessions/{id}/submit_answer/
Content-Type: application/json
```

**Request Body:**
```json
{
  "student_answer": "Tôi thấy một tổn thương mờ phím ở vùng phần dốc phổi phải, kích thước khoảng 4-5cm"
}
```

**Response (200 OK):**
```json
{
  "attempt": {
    "id": 2,
    "step_index": 1,
    "step_name": "DESCRIBE",
    "student_answer": "Tôi thấy một tổn thương...",
    "score": 0.78,
    "errors": [
      "Cần xác định rõ vị trí",
      "Hãy mô tả bờ của tổn thương"
    ],
    "feedback": {
      "type": "hint",
      "content": "Bước DESCRIBE: Hãy xem gợi ý - các tổn thương này cần loại trừ. Hãy xem xét kỹ hơn."
    },
    "latency_ms": 2100,
    "created_at": "2024-04-15T10:35:00Z"
  },
  "passed": false,
  "hint": "Bước DESCRIBE: Hãy chú ý đến các tổn thương. Hãy xem xét kỹ hơn.",
  "message": "Chưa đúng. Hãy xem gợi ý và thử lại."
}
```

**Response when answer passes (score >= 0.6):**
```json
{
  "attempt": {...},
  "passed": true,
  "next_step": 2,
  "message": "Đáp án số được! Chuyển sang bước tiếp theo."
}
```

**Response when session completed:**
```json
{
  "attempt": {...},
  "passed": true,
  "session_complete": true,
  "message": "Chúc mừng! Hoàn thành case này."
}
```

**Error Responses:**
```
400 Bad Request: {
  "error": "Vui lòng cung cấp câu trả lời chi tiết hơn"
}

403 Forbidden: {
  "error": "Session đã kết thúc"
}
```

#### View Answer Key (Requires COMPLETED session)
```
GET /sessions/{id}/answer_key/
```

**Only accessible if session status = COMPLETED**

**Response (200 OK):**
```json
{
  "answer_key": {
    "OBSERVE": "Thấy infiltrate phổi dưới phải",
    "DESCRIBE": "Infiltrate mờ phím, kích thước ~5cm, vị trí phần đốc phổi phải",
    "INTERPRET": "Mật độ cao có thể do phổi bị tổn thương do viêm",
    "HYPOTHESIS": "Viêm phổi",
    "DDx": ["Lao", "Ung thư phổi", "Edema phổi"],
    "CONCLUSION": "Viêm phổi phải",
    "explanation": "Dựa vào triệu trứng lâm sàng và hình ảnh X-ray..."
  },
  "your_score": 0.78,
  "details": [
    {
      "step": "OBSERVE",
      "score": 0.85,
      "feedback": {
        "type": "correct",
        "content": "Bước OBSERVE: Tuyệt vời!"
      }
    },
    {
      "step": "DESCRIBE",
      "score": 0.78,
      "feedback": {
        "type": "hint",
        "content": "Bước DESCRIBE: ..."
      }
    }
  ]
}
```

**Error Response:**
```
403 Forbidden: {
  "error": "Chỉ xem được đáp án sau khi hoàn thành."
}
```

#### Get Step Answers (NEW)
```
GET /sessions/{id}/step_answers/
```

**Access:** Anytime during session (IN_PROGRESS, COMPLETED, etc.)

**Response (200 OK):**
```json
{
  "session_id": 95,
  "case_id": 47,
  "case_title": "Test Case - CT Scan",
  "case_modality": "CT",
  "current_step": 0,
  "status": "IN_PROGRESS",
  "answers": {
    "OBSERVE": "[CT] Brain scan - ventricles enlarged, no hemorrhage",
    "DESCRIBE": "Bilateral ventricle dilation, 4-5mm wider than normal range",
    "INTERPRET": "Suggests increased intracranial pressure or hydrocephalus",
    "HYPOTHESIS": "Obstructive hydrocephalus",
    "DDx": "Communicating hydrocephalus, ventricular enlargement from atrophy, tumor obstruction",
    "CONCLUSION": "MRI recommended to determine etiology and assess urgency for intervention"
  },
  "step_templates": {
    "OBSERVE": "Quan sát kỹ lưỡng các vùng của ảnh. Xác định vùng bất thường.",
    "DESCRIBE": "Mô tả chi tiết các đặc điểm: kích thước, hình dạng, vị trí, mật độ.",
    "INTERPRET": "Diễn giải ý nghĩa lâm sàn của các phát hiện.",
    "HYPOTHESIS": "Đề xuất chẩn đoán dự phòng chính dựa trên hình ảnh.",
    "DDx": "Liệt kê chẩn đoán phân biệt cần loại trừ.",
    "CONCLUSION": "Kết luận chẩn đoán cuối cùng và khuyến cáo tiếp theo."
  }
}
```

**Error Responses:**
```
403 Forbidden: {
  "error": "Unauthorized access to this session"
}

404 Not Found: {
  "error": "Session not found"
}
```

#### Exit Session
```
POST /sessions/{id}/exit_session/
```

**Purpose:** Save progress and exit current session without completing it

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session đã được lưu và thoát thành công",
  "session_id": 95,
  "last_step": 2,
  "timestamp": "2024-04-15T15:30:00Z"
}
```

**Error Responses:**
```
400 Bad Request: {
  "error": "Không thể thoát khỏi session này"
}

403 Forbidden: {
  "error": "Unauthorized"
}
```

---

### Uploaded Cases (User Upload Feature)

#### List Uploaded Cases
```
GET /uploaded-cases/
```

**Query Parameters:**
- `page` (integer): Page number
- `page_size` (integer): Items per page

**Response (200 OK):**
```json
{
  "count": 2,
  "results": [
    {
      "id": 1,
      "title": "My CT Scan",
      "modality": "CT",
      "processing_status": "SUCCESS",
      "processing_status_display": "Thành công",
      "created_case_id": 47,
      "error_message": "",
      "created_at": "2024-04-15T14:00:00Z",
      "image_url": "http://localhost:8000/media/user_uploads/2024/04/15/scan_abc.jpg",
      "original_image": "/media/user_uploads/2024/04/15/scan_abc.jpg"
    }
  ]
}
```

#### Upload New Case
```
POST /uploaded-cases/
Content-Type: multipart/form-data
```

**Request Body:**
- `original_image` (file, required): Medical image file (JPG, PNG)
- `title` (string, optional): Case title
- `modality` (string, optional): XRAY | CT | MRI | ULTRASOUND (default: XRAY)

**Example with cURL:**
```bash
curl -X POST http://localhost:8000/api/v1/uploaded-cases/ \
  -F "original_image=@/path/to/image.jpg" \
  -F "title=My CT Brain Scan" \
  -F "modality=CT" \
  -b cookies.txt
```

**Response (201 Created):**
```json
{
  "id": 1,
  "title": "My CT Brain Scan",
  "modality": "CT",
  "ai_findings": {
    "title": "CT Case – MedGemma",
    "description": "[CT] Brain scan analysis...",
    "raw_findings": "AI analysis results...",
    "confidence": 0.82
  },
  "processing_status": "SUCCESS",
  "processing_status_display": "Thành công",
  "error_message": "",
  "created_case_id": 47,
  "created_case": {
    "id": 47,
    "title": "CT Case – MedGemma",
    "description": "...",
    "modality": "CT",
    "difficulty": "INTERMEDIATE",
    "clinical_history": "...",
    "image_urls": ["http://localhost:8000/media/user_uploads/2024/04/15/scan_abc.jpg"],
    "tags": []
  },
  "created_at": "2024-04-15T14:00:00Z",
  "image_url": "http://localhost:8000/media/user_uploads/2024/04/15/scan_abc.jpg",
  "original_image": "/media/user_uploads/2024/04/15/scan_abc.jpg"
}
```

**Processing Workflow:**
1. Image uploaded → Status: PENDING
2. AI analysis starts → Status: PROCESSING
3. Case created from AI findings → Status: SUCCESS
4. Or error occurs → Status: FAILED

**Error Response (400 Bad Request):**
```json
{
  "error": "Lỗi xử lý ảnh",
  "message": "Detail error message",
  "upload_id": 1
}
```

#### Get Uploaded Case Detail
```
GET /uploaded-cases/{id}/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "My CT Brain Scan",
  "modality": "CT",
  "ai_findings": {
    "title": "CT Case – MedGemma",
    "description": "[CT] Brain scan - ventricles enlarged...",
    "raw_findings": "Detailed AI findings...",
    "confidence": 0.82,
    "answer_key": {
      "OBSERVE": "[CT] Brain scan - ventricles enlarged",
      "DESCRIBE": "Bilateral ventricle dilation, 4-5mm wider than normal",
      "INTERPRET": "Suggests increased intracranial pressure",
      "HYPOTHESIS": "Hydrocephalus",
      "DDx": "Communicating hydrocephalus, tumor obstruction, aqueductal stenosis",
      "CONCLUSION": "MRI recommended to determine etiology"
    },
    "pipeline_rubric": {
      "OBSERVE": "Quan sát kỹ lưỡng...",
      "DESCRIBE": "Mô tả chi tiết...",
      "INTERPRET": "Diễn giải ý nghĩa...",
      "HYPOTHESIS": "Đề xuất chẩn đoán...",
      "DDx": "Liệt kê chẩn đoán...",
      "CONCLUSION": "Kết luận chẩn đoán..."
    }
  },
  "processing_status": "SUCCESS",
  "processing_status_display": "Thành công",
  "error_message": "",
  "created_case_id": 47,
  "created_case": {
    "id": 47,
    "title": "CT Case – MedGemma",
    "description": "...",
    "modality": "CT",
    "difficulty": "INTERMEDIATE",
    "clinical_history": "AI analyzed CT scan...",
    "image_urls": ["http://localhost:8000/media/user_uploads/2024/04/15/scan_abc.jpg"],
    "tags": []
  },
  "created_at": "2024-04-15T14:00:00Z",
  "image_url": "http://localhost:8000/media/user_uploads/2024/04/15/scan_abc.jpg",
  "original_image": "/media/user_uploads/2024/04/15/scan_abc.jpg"
}
```

---

### Performance (Authenticated)

#### Get Personal Stats
```
GET /performance/my_stats/
```

**Response (200 OK):**
```json
{
  "username": "student1",
  "total_cases_completed": 3,
  "average_score": 0.76,
  "accuracy_by_step": {
    "0": 0.82,
    "1": 0.75,
    "2": 0.71,
    "3": 0.78,
    "4": 0.76,
    "5": 0.73
  },
  "last_activity": "2024-04-15T15:00:00Z"
}
```

---

### Tags

#### List Tags
```
GET /tags/
```

**Response (200 OK):**
```json
{
  "count": 4,
  "results": [
    {
      "id": 1,
      "name": "Chest",
      "description": "Phim ngực"
    },
    {
      "id": 2,
      "name": "Neuro",
      "description": "Phim não"
    }
  ]
}
```
