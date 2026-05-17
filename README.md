# SARa - Smart AI Radiology

> Nền tảng luyện tập đọc phim X-quang/CT/MRI có cấu trúc cho sinh viên y khoa  
> Group 076 · VinUniversity AI20K Build Phase · 2026

**[Live App](https://a20-app-076-sara.up.railway.app/)** · [GitHub Repo](https://github.com/a20-ai-thuc-chien/A20-App-076)

[![Django REST Framework](https://img.shields.io/badge/Backend-Django%20REST-092E20?style=flat-square&logo=django)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)

---

## Mô Tả Ngắn Gọn

SARa giải quyết một khoảng trống trong đào tạo chẩn đoán hình ảnh: sinh viên y khoa cần một môi trường luyện đọc phim có cấu trúc, có phản hồi tức thì theo từng bước, và hạn chế thói quen kết luận quá sớm.

Ứng dụng dẫn sinh viên qua pipeline 4 bước:

1. **DESCRIBE** - Quan sát có hệ thống và mô tả bất thường trên ảnh.
2. **REASONING** - Liên hệ dấu hiệu hình ảnh với bối cảnh lâm sàng.
3. **DDx** - Đưa ra chẩn đoán phân biệt và lý do loại trừ.
4. **CONCLUSION** - Kết luận chẩn đoán và hướng xử trí tiếp theo.

AI hỗ trợ bằng Socratic Agent để đặt câu hỏi/gợi ý, Answer-Check Agent để chấm câu trả lời theo rubric được bác sĩ xác nhận, và Image Analysis Agent để tạo đáp án tham khảo từ ảnh upload.

---

## Tính Năng Chính

| Feature | Mô tả |
|---|---|
| **Case Library** | Thư viện case X-ray/CT/MRI, có lọc theo modality, độ khó, tag và nguồn case. |
| **Guided Diagnosis** | Phiên luyện tập theo pipeline 4 bước, chống bỏ bước và chấm theo score gate. |
| **Instant Feedback** | AI đánh giá câu trả lời, trả feedback, lỗi còn thiếu và gợi ý Socratic. |
| **Image Upload** | Người dùng upload ảnh y tế, hệ thống phân tích và tạo case luyện tập mới. |
| **Answer Review** | Xem đáp án tham khảo, rubric và kết quả sau khi hoàn thành hoặc trong luồng upload. |
| **Exam Mode** | Làm bài kiểm tra theo case exam riêng, có session và điểm tổng kết. |
| **Swap/Debate Mode** | Luồng thảo luận/chốt đáp án theo từng bước với bác sĩ/AI. |
| **Performance & Leaderboard** | Theo dõi điểm trung bình, độ chính xác theo bước và bảng xếp hạng. |

---

## Kiến Trúc Hệ Thống

```text
User
  -> React + Vite Frontend
  -> Django REST Framework API
      -> Supabase Auth/JWT middleware
      -> Session state machine
      -> Case / Upload / Exam / Swap services
      -> Socratic Agent
      -> Answer-Check Agent
      -> Image Analysis services
  -> Supabase PostgreSQL + Supabase Storage
```

Backend hiện tại là Django REST Framework, không phải FastAPI. Database chính là Supabase/PostgreSQL; ảnh case được lưu qua Supabase Storage.

---

## Công Nghệ Sử Dụng

| Layer | Stack |
|---|---|
| **Frontend** | React 18 · Vite · TypeScript · TailwindCSS · shadcn/ui · MUI icons |
| **Backend** | Python · Django 4.2 · Django REST Framework |
| **Database/Auth** | Supabase PostgreSQL · Supabase Auth JWT |
| **Storage** | Supabase Storage |
| **AI** | OpenAI API · MedGemma/Hugging Face Space fallback tùy cấu hình |
| **Observability** | Langfuse |
| **Deployment** | Railway Vite build · Docker |

---

## Cấu Trúc Thư Mục

```text
A20-App-076/
├── apps/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── agents/          # Socratic, answer check, AI services
│   │   │   ├── auth/            # Login/register/me/logout
│   │   │   ├── cases/           # Case APIs
│   │   │   ├── exam/            # Exam mode
│   │   │   ├── observability/   # Langfuse integration
│   │   │   ├── sessions/        # Practice sessions + pipeline logic
│   │   │   ├── swap/            # Debate/swap sessions
│   │   │   └── uploads/         # Image upload + generated cases
│   │   ├── config/              # Django settings/urls/wsgi
│   │   ├── supabase_db/         # SQL migrations and seed scripts
│   │   ├── manage.py
│   │   └── requirements.txt
│   └── frontend/
│       ├── src/
│       │   ├── api/             # API client, hooks, auth context
│       │   ├── app/             # Routes, pages, shared components
│       │   ├── constants/
│       │   ├── styles/
│       │   └── types/
│       ├── package.json
│       └── vite.config.ts
├── documents/                   # Product docs, slides, test/evaluation docs
├── scripts/
├── JOURNAL.md
├── WORKLOG.md
└── README.md
```

---

## Cài Đặt

### Yêu Cầu

- Node.js >= 18
- Python 3.10+ hoặc phiên bản tương thích với Django 4.2
- Supabase project
- OpenAI API key nếu dùng AI thật

### Backend

```bash
cd apps/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Tạo file `.env` trong `apps/backend` dựa trên `.env.example`:

```env
SECRET_KEY=...
DEBUG=True
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
OPENAI_API_KEY=...
HF_TOKEN=...
```

Chạy backend:

```bash
python manage.py runserver
```

API chạy tại:

```text
http://localhost:8000/api/v1/
```

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Frontend chạy tại:

```text
http://localhost:5173
```

---

## API Chính

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/auth/register/` | Đăng ký tài khoản |
| `POST` | `/api/v1/auth/login/` | Đăng nhập |
| `GET` | `/api/v1/auth/me/` | Lấy thông tin user hiện tại |
| `GET` | `/api/v1/cases/` | Danh sách case |
| `GET` | `/api/v1/cases/{id}/` | Chi tiết case |
| `POST` | `/api/v1/sessions/` | Tạo practice session |
| `GET` | `/api/v1/sessions/{id}/` | Chi tiết session |
| `POST` | `/api/v1/sessions/{id}/submit_answer/` | Nộp câu trả lời theo bước |
| `GET` | `/api/v1/sessions/{id}/answer_key/` | Xem đáp án sau khi hoàn thành |
| `GET` | `/api/v1/sessions/{id}/step_answers/` | Xem đáp án từng bước cho case upload |
| `GET` | `/api/v1/performance/my_stats/` | Thống kê cá nhân |
| `GET` | `/api/v1/performance/leaderboard/` | Bảng xếp hạng |
| `GET/POST` | `/api/v1/uploaded-cases/` | Upload và quản lý case tự tạo |
| `GET/POST` | `/api/v1/exam-sessions/` | Exam sessions |
| `GET/POST` | `/api/v1/swap-sessions/` | Swap/debate sessions |

Các endpoint protected cần Supabase JWT trong header:

```http
Authorization: Bearer <access_token>
```

---

## Luồng Sử Dụng

### Practice (Luyện tập thường)

1. Đăng nhập hoặc đăng ký tài khoản.
2. Chọn case trong thư viện hoặc upload ảnh y tế mới.
3. Tạo session luyện tập.
4. Trả lời lần lượt 4 bước: **DESCRIBE -> REASONING -> DDx -> CONCLUSION**.
5. Nhận feedback AI sau mỗi câu trả lời.
6. Nếu score đạt ngưỡng, chuyển sang bước tiếp theo; nếu chưa đạt, nhận gợi ý và thử lại.
7. Khi hoàn thành, xem answer key và kết quả tổng kết.

### Exam Mode (Thi)

1. Vào tab **Exam**, chọn bộ đề thi.
2. Lần lượt làm từng case trong bộ đề theo pipeline 4 bước — không có gợi ý AI trong lúc làm.
3. Nộp bài, xem điểm tổng kết và kết quả từng case sau khi hoàn thành.

### Swap / Debate Mode (Thảo luận)

1. Vào tab **Swap**, chọn case muốn thảo luận.
2. Trả lời từng bước theo pipeline 4 bước.
3. Sau mỗi bước, AI (hoặc bác sĩ) đưa ra góc nhìn phản biện — thảo luận, bảo vệ hoặc điều chỉnh đáp án.
4. Chốt đáp án cuối cùng sau khi tranh luận xong.

---

## Pipeline 4 Bước

```text
Step 0: DESCRIBE   -> Mô tả phát hiện hình ảnh: vị trí, kích thước, mật độ, hình dạng, dấu hiệu liên quan.
Step 1: REASONING  -> Diễn giải ý nghĩa lâm sàng và đề xuất chẩn đoán làm việc chính.
Step 2: DDx        -> Đưa ra chẩn đoán phân biệt, xếp ưu tiên và lý do loại trừ.
Step 3: CONCLUSION -> Kết luận chẩn đoán, mức độ tự tin và hướng xử trí tiếp theo.
```



## Kiểm Tra Nhanh

Frontend build:

```bash
cd apps/frontend
npm run build
```

Backend system check:

```bash
cd apps/backend
venv\Scripts\activate
python manage.py check
```

Lưu ý: backend cần môi trường Python đã cài dependencies từ `requirements.txt`.

---



## Disclaimer

SARa chỉ dành cho mục đích học tập và luyện tư duy chẩn đoán hình ảnh. Ứng dụng không phải công cụ chẩn đoán lâm sàng và không thay thế ý kiến của bác sĩ.

---

*SARa MVP · Group 076 · VinUniversity AI20K · 2026*
