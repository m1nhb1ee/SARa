# Smart AI Radiology - Backend

Backend Django RESTful API cho nền tảng luyện tập đọc phim X-quang/CT/MRI có AI feedback.

## 🏗️ Kiến trúc

### Models
- **Case**: Thư viện case học tập (ảnh, lịch sử lâm sàng, đáp án, rubric)
- **Session**: Phiên làm bài của sinh viên trên một case
- **StepAttempt**: Mỗi lần sinh viên trả lời một bước trong pipeline 6 bước
- **StudentPerformance**: Thống kê hiệu suất của sinh viên
- **CaseTag**: Phân loại case (Chest, Neuro, MSK, v.v.)

### Pipeline 6 bước
1. **OBSERVE**: Quan sát toàn bộ ảnh, xác định vùng bất thường
2. **DESCRIBE**: Mô tả chi tiết tổn thương (kích thước, hình dạng, vị trí)
3. **INTERPRET**: Diễn giải ý nghĩa lâm sàng của tổn thương
4. **HYPOTHESIS**: Đưa ra giả thuyết chẩn đoán chính
5. **DDx**: Liệt kê chẩn đoán phân biệt
6. **CONCLUSION**: Kết luận cuối cùng

### AI Agents (Mock)
- **CV Agent**: Phân tích ảnh → trả về structured findings
- **Socratic Agent**: Tạo câu hỏi gợi ý theo từng bước
- **Answer-Check Agent**: Đánh giá câu trả lời dựa trên rubric → score + feedback

## 🚀 Quick Start

### 1. Clone & Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Migrate & Demo Data

```bash
# Tạo database
python manage.py migrate

# Load mock data
python manage.py create_mock_data

# Tạo user admin (nếu chưa tạo qua script)
python manage.py createsuperuser
```

### 3. Chạy server

```bash
python manage.py runserver
```

Server chạy tại: `http://localhost:8000`

Admin: `http://localhost:8000/admin/`

## 📚 API Endpoints

### Cases
```
GET    /api/v1/cases/              # Danh sách cases
GET    /api/v1/cases/{id}/         # Chi tiết case
```

**Query params**:
- `modality`: XRAY, CT, MRI, ULTRASOUND
- `difficulty`: BASIC, INTERMEDIATE, ADVANCED
- `search`: Tìm kiếm theo title
- `page`: Phân trang

### Sessions
```
GET    /api/v1/sessions/           # Danh sách sessions của user
POST   /api/v1/sessions/           # Tạo session mới
GET    /api/v1/sessions/{id}/      # Chi tiết session
POST   /api/v1/sessions/{id}/submit_answer/  # Submit câu trả lời
GET    /api/v1/sessions/{id}/answer_key/     # Xem đáp án (sau khi hoàn thành)
```

### Performance
```
GET    /api/v1/performance/my_stats/  # Xem thống kê cá nhân
```

## 📝 Example Flow

### 1. Lấy danh sách cases

```bash
curl http://localhost:8000/api/v1/cases/?difficulty=BASIC
```

**Response**:
```json
{
  "count": 1,
  "results": [
    {
      "id": 1,
      "title": "Viêm phổi điển hình",
      "modality": "XRAY",
      "difficulty": "BASIC",
      "description": "X-ray ngực với infiltrate phổi"
    }
  ]
}
```

### 2. Tạo session

```bash
curl -X POST http://localhost:8000/api/v1/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"case": 1}'
```

**Response**:
```json
{
  "id": 1,
  "case": 1,
  "current_step": 0,
  "status": "IN_PROGRESS",
  "total_score": 0.0
}
```

### 3. Lấy chi tiết case

```bash
curl http://localhost:8000/api/v1/cases/1/
```

**Response**: (không expose answer_key)
```json
{
  "id": 1,
  "title": "Viêm phổi điển hình",
  "clinical_history": "Bệnh nhân 45t, nam, ho sốt 3 ngày",
  "image_urls": ["https://..."],
  "tags": ["Chest"]
}
```

### 4. Submit câu trả lời

```bash
curl -X POST http://localhost:8000/api/v1/sessions/1/submit_answer/ \
  -H "Content-Type: application/json" \
  -d '{"student_answer": "Tôi thấy có mờ phím ở phổi phải, có thể do viêm hoặc tổn thương khác"}'
```

**Response**:
```json
{
  "attempt": {
    "id": 1,
    "step_index": 0,
    "step_name": "OBSERVE",
    "score": 0.82,
    "errors": [],
    "feedback": {
      "type": "correct",
      "content": "Bước OBSERVE: Tuyệt vời!"
    }
  },
  "passed": true,
  "next_step": 1,
  "message": "Đáp án số được! Chuyển sang bước tiếp theo."
}
```

### 5. Xem đáp án (sau khi hoàn thành)

```bash
curl http://localhost:8000/api/v1/sessions/1/answer_key/
```

**Response**: (chỉ sau khi status = COMPLETED)
```json
{
  "answer_key": {...},
  "your_score": 0.78,
  "details": [
    {
      "step": "OBSERVE",
      "score": 0.82,
      "feedback": {...}
    }
  ]
}
```

## 🔧 Development

### Tạo migration sau thay đổi model

```bash
python manage.py makemigrations
python manage.py migrate
```

### Format code

```bash
# Chưa setup - chỉ note
# pip install black flake8
# black radiology/
# flake8 radiology/
```

### Test (chuẩn bị)

```bash
python manage.py test radiology
```

## 🗄️ Database Schema

### Case
```
id, title, description, modality, difficulty, clinical_history,
pipeline_rubric (JSON), answer_key (JSON), image_urls (JSON),
is_active, created_at, updated_at
```

### Session
```
id, user_id, case_id, current_step (0-5), status,
step_history (JSON), cv_findings (JSON), total_score,
started_at, completed_at
```

### StepAttempt
```
id, session_id, step_index (0-5), step_name, student_answer,
score (0-1), errors (JSON), feedback (JSON), latency_ms, created_at
```

## ⚙️ AI Services

### MockAIAgent (Development)
- `evaluate_answer(case, step_index, student_answer, cv_findings)` → score + feedback
- `generate_socratic_hint(case, step_index, errors)` → câu hỏi gợi ý
- `analyze_image(image_url)` → CV findings

**Production**: Thay bằng OpenAI Vision / Claude Vision API

## 📦 Deployment

### Docker
```bash
docker build -t smart-radiology-backend .
docker run -p 8000:8000 smart-radiology-backend
```

### Kubernetes / AWS / Azure
- Build image
- Push to registry
- Deploy

## 🤝 Contributing

Các file cần update khi thêm feature:
1. `models.py` - Define model
2. `serializers.py` - API serialization
3. `views.py` - Business logic
4. `urls.py` - Route mapping
5. `admin.py` - Admin interface

## 📄 License

Proprietary - Vingroup University AI Training Program
