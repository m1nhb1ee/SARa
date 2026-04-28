# Worklog

Ghi lại các quyết định kỹ thuật, phân công, và brainstorming của nhóm.

> Cập nhật **bất cứ khi nào** nhóm ra quyết định kỹ thuật quan trọng hoặc thay đổi hướng đi.

---

## Template

### Quyết định kỹ thuật

```markdown
### [ADR-1] Chọn luồng VLM nhẹ thay vì VLM mạnh - 10/04/2026

**Bối cảnh:** Cần chọn kiến trúc AI cho việc phân tích ảnh y khoa trong pipeline
Observe → Describe → Interpret → DDx → Conclusion.

**Các lựa chọn đã xem xét:**
- **VLM mạnh (pretrained trên dataset y khoa lớn):** Độ chính xác cao hơn, nhưng nặng,
  đòi hỏi hạ tầng deploy phức tạp và chi phí cao.
- **VLM nhẹ hơn + LLM:** Độ chính xác chẩn đoán kém hơn nhưng khả thi để deploy. VLM đưa ra kết quả quan sát hình ảnh, LLM xử lý câu hỏi Socratic và feedback.

**Quyết định:** Chọn VLM nhẹ hơn. Kết quả VLM sẽ được chuyển thành quan sát theo luồng pipeline, sau đó LLM đưa ra câu hỏi gợi ý và feedback cho sinh viên, thay vì để model chẩn đoán trực tiếp.

**Hệ quả:** Độ chính xác nhận diện hình ảnh thấp hơn so với model nặng. Chấp nhận được ở giai đoạn MVP vì mục tiêu là luyện tập tư duy pipeline, không phải thay thế chẩn đoán lâm sàng.

---

### [ADR-2] Kiến trúc 3 Agent: CV Agent + Socratic Agent + LLM Agent - 09/04/2026

**Bối cảnh:** Cần xác định cách các thành phần AI phối hợp với nhau trong luồng Interactive Diagnosis Flow.

**Các lựa chọn đã xem xét:**
- **VLM-LLM:** VLM Agent nhận diện ảnh theo luồng là đề cập, Socratic Agent dẫn dắt câu hỏi, LLM Agent đánh giá đáp án và feedback. Đơn giản hơn về kiến trúc nhưng khó kiểm soát từng bước pipeline, khó debug khi sai.
- **Segmentation-LLM:** CV Agent nhận diện và segment vùng bất thường ảnh, LLM Agent nhận thông tin đó, đưa ra câu hỏi + đánh giá đáp án và feedback. Phức tạp hơn nhưng mỗi agent có trách nhiệm rõ ràng.

**Quyết định:** VLM-LLM. VLM cho thẳng kết quả context về ảnh, giúp LLM chính xác hơn, pipeline cũng dễ swap model sau này mà không ảnh hưởng toàn bộ luồng.

**Hệ quả:** Cần thiết kế interface rõ ràng giữa các agent. Latency có thể cao hơn do gọi model VLM. VLM cũng cần hạ tầng cao hơn để deploy

### [ADR-3] Dùng Supabase (PostgreSQL) thay vì SQLite cho database — 18/04/2026

**Bối cảnh:** Sprint 2 chốt stack infrastructure. Cần database đủ mạnh cho production, hỗ trợ RLS, signed URL cho ảnh y tế, và real-time nếu cần sau này.

**Các lựa chọn đã xem xét:**
- **SQLite:** Đơn giản, không cần setup. Không phù hợp cho multi-user, không có RLS, không scale.
- **PostgreSQL self-hosted:** Full control nhưng tốn thời gian quản lý hạ tầng.
- **Supabase (PostgreSQL managed):** Hosted PostgreSQL + RLS + Object Storage + Auth + dashboard. Phù hợp tốc độ MVP.
- **Firebase Firestore:** Real-time tốt nhưng không hỗ trợ JOIN, không phù hợp với dữ liệu quan hệ chặt (User → Session → StepAttempt → Case).

**Quyết định:** Supabase. Schema 12 bảng quan hệ với FK rõ ràng — SQL là lựa chọn tự nhiên. Supabase giảm overhead ops so với self-hosted.

**Hệ quả:** Phải config RLS ngay từ đầu khi thiết kế schema (không bật sau). Signed URL cho ảnh cần TTL dài hơn default 1h vì session có thể kéo dài 30–60 phút.

---

### [ADR-4] Tích hợp MedGemma qua Gradio API thay vì deploy model riêng — 18/04/2026

**Bối cảnh:** CV Agent cần gọi VLM để phân tích ảnh X-ray. Cần quyết định cách deploy model.

**Các lựa chọn đã xem xét:**
- **Deploy model riêng (GPU server):** Full control, latency thấp hơn, nhưng chi phí cao và phức tạp với MVP.
- **Gọi qua Hugging Face Gradio Space:** Model đã được host sẵn, gọi qua `gradio_client`. Zero infra cost, phù hợp MVP.
- **OpenAI GPT-4o Vision:** Mạnh hơn nhưng tốn token cost mỗi ảnh, không phải model chuyên y khoa.

**Quyết định:** Dùng `gradio_client` gọi `ttnguyen6716/MedGemma-1.5-4B` trên HF Space. Token lấy từ `HF_TOKEN` trong `.env`, fallback về mock findings nếu call thất bại.

**Hệ quả:** Phụ thuộc uptime của HF Space (không có SLA). Latency cao hơn self-hosted (~3–8s/request). Cần implement fallback rõ ràng để không block session khi model down.


---

### [ADR-5] Tách `image_urls` thành bảng `case_images` riêng - 23/04/2026

**Bối cảnh:** Ban đầu ảnh của mỗi case được lưu dưới dạng mảng text (`image_urls text[]`) ngay trong bảng `cases`. Khi cần hỗ trợ multi-image upload với `slice_index` per ảnh, mảng text không còn đủ để lưu metadata ảnh.

**Các lựa chọn đã xem xét:**
- **Giữ `image_urls text[]` + thêm `slice_indexes int[]` song song:** Đơn giản, không cần migration lớn. Nhưng hai mảng phải luôn đồng bộ độ dài — dễ desync, khó validate, khó extend sau này.
- **JSONB column trên `cases`:** Một column `images jsonb` chứa array object `{image_url, slice_index}`. Gọn hơn nhưng mất khả năng query từng ảnh riêng, khó set RLS per-row.
- **Bảng `case_images` riêng (1-N với `cases`):** Mỗi hàng là một ảnh với `case_id FK`, `image_url`, `slice_index`. Chuẩn hoá hoàn toàn, dễ extend (thêm caption, series,…), RLS rõ ràng per-table.

**Quyết định:** Tạo bảng `case_images` với `ON DELETE CASCADE` từ `cases`. Supabase nested select (`cases(case_images(...))`) trả về ảnh cùng với case mà không cần join thủ công ở application layer. Column `image_url` trên `upload_sessions` bị drop.

**Hệ quả:** Cần migration `DROP COLUMN image_url` trên `upload_sessions` và migration RLS riêng cho `case_images`. Logic xoá case trong `delete_uploaded_case` phải fetch URL từ `case_images` trước khi xoá Supabase Storage object. Backend hoàn toàn không còn `image_urls` flat list trong response.

---

### Sprint 1 — 07/04 → 11/04/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Xác định target user và phân tích pain point | Cả nhóm | 09/04 | ✅ Xong |
| Ước lượng thị trường (TAM / SAM / SOM) | Minh | 09/04 | ✅ Xong |
| Hoàn thành Phân tích nghiệp vụ  | Tiến | 11/04 | ✅ Xong |
| Xác định 8 user stories (US-01 → US-08) | Tiến | 11/04 | ✅ Xong |
| Hoàn thành MVP Scope | Minh và Khôi | 11/04 | ✅ Xong |
| Thử nghiệm model open-source (MedGemma-1.5-4B, medvlm-r1) | Tiến và Minh | 11/04 | ✅ Xong |
| Gửi kết quả model và nhận feedback từ bác sĩ | Tiến | 11/04 | ✅ Xong |
| Tìm nguồn data ảnh y khoa | Khôi | 11/04 | 🔄 Đang làm |

---

### Brainstorm: Lựa chọn luồng model AI — 10/04/2026

**Câu hỏi:** Nên dùng luồng VLM → LLM hay CV Segmentation model → LLM?

**Các ý tưởng:**
- **VLM → LLM:** Model nhìn thẳng vào ảnh và mô tả, LLM xử lý reasoning và feedback.
  Đơn giản hơn về pipeline, không cần bước segmentation riêng.
- **CV Segmentation → LLM:** Phát hiện vùng bất thường trước bằng CV model chuyên biệt,
  sau đó đưa kết quả vào LLM. Chính xác hơn về vị trí finding nhưng cần
  nhiều component hơn.

| Lựa chọn | Pros | Cons |
|---|---|---|
| VLM → LLM | Pipeline đơn giản, dễ prototype | Độ chính xác phụ thuộc hoàn toàn vào VLM |
| CV Segmentation → LLM | Chính xác hơn về finding location | Phức tạp hơn, cần thêm model |

**Kết luận:** Chọn VLM → LLM. VLM đưa ra quan sát theo pipeline Observe → Describe →
Interpret → DDx → Conclusion, LLM đặt câu hỏi Socratic và feedback.
Ưu tiên model nhẹ, khả thi để deploy trong giai đoạn MVP.


---

### Sprint 2 — 14/04 → 18/04/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Finalize System Architecture Diagram (5 tầng) | Tiến | 15/04 | ✅ Xong |
| Thiết kế API contract với 3 endpoint chính | Tiến | 15/04 | ✅ Xong |
| Thiết kế ERD với 12 bảng Supabase | Khôi | 16/04 | ✅ Xong |
| Viết Supabase migration SQL (12 bảng) | Khôi | 17/04 | ✅ Xong |
| Fix uuid_generate_v4 → gen_random_uuid toàn bộ migration | Khôi | 18/04 | ✅ Xong |
| Enable RLS cho các bảng nhạy cảm | Khôi | 18/04 | 🔄 Đang làm |
| Thiết kế Sequence Diagram (2 luồng chính) | Minh | 16/04 | ✅ Xong |
| Tích hợp MedGemma qua gradio_client | Tiến | 17/04 | ✅ Xong |
| Expose endpoint POST /api/v1/analyze-image/ để test | Tiến | 18/04 | ✅ Xong |
| Scope Lock — review MoSCoW, đóng băng WON'T | Cả nhóm | 18/04 | ✅ Xong |
| Tìm nguồn data ảnh y khoa (carry over từ sprint 1) | Khôi | 18/04 | 🔄 Đang làm |

---

### Sprint 3 - 19/04 → 25/04/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Implement pipeline state machine (6 bước, score gate ≥ 0.6) | Khôi + Minh | 21/04 | ✅ Xong |
| Implement `POST /api/v1/sessions/` + `POST /api/v1/sessions/{id}/submit_answer/` | Tiến | 21/04 | ✅ Xong |
| Implement Answer-Check Agent (GPT-4o scoring + rubric JSON) | Minh | 22/04 | ✅ Xong |
| Populate Supabase với 5 ca mẫu + rubric + answer key | Tiến | 22/04 | 🔄 Đang làm |
| Refactor `uploaded-cases` route — multi-image upload + `case_images` table | Minh | 23/04 | ✅ Xong |
| Thêm `region` input vào upload route, đưa vào MedGemma prompt | Tiến | 23/04 | ✅ Xong |
| Drop `image_url` column khỏi `upload_sessions`, migrate sang `case_images` | Tiến | 23/04 | ✅ Xong |
| Xây dựng case library UI + image viewer | Minh | 23/04 | ✅ Xong |
| Giao diện Socratic dialogue bước đầu | Minh | 24/04 | ✅ Xong |
| Chỉnh sửa system prompt MedGemma (6-step radiology format, region-aware) | Tiến | 23/04 | ✅ Xong |
| Prompt engineering Answer-Check Agent với rubric JSON mẫu | Tiến | 24/04 | ✅ Xong |
| Chạy session thử nghiệm đầu tiên cuối tuần 3 | Cả nhóm | 25/04 | ✅ Xong |

---

