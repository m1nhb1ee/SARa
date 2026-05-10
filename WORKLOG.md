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

### [ADR-5] Kiến trúc đa volume cho case ảnh - 29/04/2026

**Bối cảnh:** Mỗi ca bệnh CT/MRI thực tế có nhiều chuỗi ảnh (volume) khác nhau. ví dụ: Axial Bone Window, Axial Non-Contrast, Coronal... Cần thiết kế lại cách lưu và trả về ảnh.

**Các lựa chọn đã xem xét:**
- **Flat list `image_urls[]`:** Đơn giản nhưng mất thông tin volume, frontend không thể group ảnh theo chuỗi.
- **Multi-volume grouped:** Mỗi case trả về `images: [{ volume_name, slices: [{ image_url, slice_index }] }]`. Frontend render đúng theo chuỗi ảnh.

**Quyết định:** Chuyển sang multi-volume. Thêm cột `volume_name` vào bảng `case_images`. Upload nhận thêm field `volume_names[]` song song với `images[]`.

**Hệ quả:** API trả về ảnh grouped theo volume, frontend cần cập nhật `VolumeSliceViewer`. Migration cần chạy trên Supabase.

---

### [ADR-6] Thêm GPT-4o làm bước tiền xử lý trước MedGemma - 30/04/2026

**Bối cảnh:** MedGemma hallucinate khi nhận prompt generic. Cần prompt được chuẩn hóa theo từng case có modality/region cụ thể.

**Các lựa chọn đã xem xét:**
- **Prompt cố định (template):** Dễ maintain nhưng không thích nghi với đặc điểm từng ca.
- **GPT-4o Vision pre-processing:** Gửi các ảnh mẫu lên GPT-4o, nhờ nó phân loại kèm viết lại prompt phù hợp với modality/anatomy thực tế của ảnh. Tốn thêm 1 API call nhưng prompt chính xác hơn.

**Quyết định:** Thêm `_preprocess_with_llm()` trước `_call_gradio()`. Meta-prompt nằm trong `app/prompt/llm_meta_prompt.py`. Fallback về `build_analysis_prompt()` nếu không có `OPENAI_API_KEY`.

**Hệ quả:** Latency upload tăng thêm ~1–2s. Tốn token GPT-4o mỗi lần upload. Cần giữ ANTI-HALLUCINATION RULES trong prompt để VLM không skip step label hay copy-paste câu giữa các bước.

---

### Sprint 1 - 07/04 → 11/04/2026

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

### Sprint 2 - 14/04 → 18/04/2026

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
| Implement `POST /api/v1/sessions/` + `POST /api/v1/sessions/{id}/submit_answer/` | Tiến | 22/04 | ✅ Xong |
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

### Sprint 4 - 28/04 → 02/05/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Thiết kế lại kiến trúc nhận ảnh đa volume (`volume_name` trong `case_images`) | Tiến | 29/04 | ✅ Xong |
| Migration: thêm cột `volume_name` vào `case_images` | Tiến | 29/04 | ✅ Xong |
| Migration: thêm cột `source` vào `cases` (`system`/`uploaded`) | Tiến | 29/04 | ✅ Xong |
| Cập nhật upload endpoint nhận `volume_names[]` song song với images | Tiến | 29/04 | ✅ Xong |
| Thêm GPT-4o pre-processing trước MedGemma (LLM → VLM pipeline) | Tiến | 30/04 | ✅ Xong |
| Tăng cường anti-hallucination rules trong prompt (step label, consistency) | Tiến | 01/05 | ✅ Xong |
| Hoàn thiện bộ data cases mẫu | Khôi | 30/04 | ✅ Xong |
| Viết script bulk upload 22 cases mẫu lên Supabase | Tiến | 01/05 | ✅ Xong |
| Đồng bộ frontend với backend đã chỉnh sửa | Minh | 30/04 | ✅ Xong |
| Sửa Frontend để render đa ảnh cho mỗi case | Minh | 01/05 | ✅ Xong |
| Fix CSS module import path trong Dashboard.tsx, DiagnosisSession.tsx | Minh | 02/05 | ✅ Xong |
| Hoàn thiện và deploy hệ thống (backend + frontend) | Cả nhóm | ongoing | 🔄 Đang làm |
| Fix VLM lỗi GPU task abort / NameError (VRAM limit với ảnh nhiều) | Tiến | ongoing | 🔄 Đang làm |
| Tìm thêm case mẫu để mở rộng thư viện | Khôi | ongoing | 🔄 Đang làm |
| Viết test cases cho giai đoạn testing | Cả nhóm | ongoing | 🔄 Đang làm |

---

### [ADR-7] Engine routing theo account tier — 08/05/2026

**Bối cảnh:** Hệ thống có hai model phân tích ảnh (GPT-5.4-mini và MedGemma). Cần phân luồng người dùng vào đúng model theo gói tài khoản, và đảm bảo mapping có thể thay đổi mà không cần sửa business logic.

**Các lựa chọn đã xem xét:**
- **Hardcode trong UploadPage:** Đơn giản nhưng mapping nằm rải rác trong UI, khó thay đổi khi cần đổi model theo tier.
- **Config tập trung:** Tạo `engineConfig.ts` với `ENGINE_BY_TIER: { free: 'vlm', premium: 'gpt' }` và helper `engineForUser(isPremium)`. Logic routing chỉ đọc từ một nơi.

**Quyết định:** Config tập trung tại `src/constants/engineConfig.ts`. Backend trả về `is_premium` từ bảng `users` khi login và `GET /auth/me/`. Frontend đọc `user.is_premium` từ auth context và gọi `engineForUser()` khi submit upload.

**Hệ quả:** Thay đổi model theo tier chỉ cần sửa một chỗ trong `ENGINE_BY_TIER`. `is_premium` phải được đồng bộ giữa Supabase `users` table và auth response — nếu lệch sẽ gây sai luồng engine.

---

### [ADR-8] LLM layer chuẩn hóa output thô của VLM (debate flow) — 09/05/2026

**Bối cảnh:** MedGemma trả về output không nhất quán — có khi là JSON, có khi là FINDINGS/IMPRESSION/REASONING block, có khi là free text. Cần chuẩn hóa về DESCRIBE/REASONING/DDx/CONCLUSION trước khi lưu và hiển thị.

**Các lựa chọn đã xem xét:**
- **Regex/rule-based parser:** Dễ implement nhưng brittle, vỡ khi VLM đổi format output.
- **GPT làm LLM layer:** Gửi raw VLM output cho GPT, yêu cầu extract và chuẩn hóa thành 4 bước. GPT hiểu ngữ nghĩa nên không phụ thuộc format cụ thể.

**Quyết định:** Thêm `_complete_final_steps_with_llm()` làm post-processing sau VLM. Nhận `raw_findings` (toàn bộ text thô), gọi `build_gpt_final_steps_prompt()` trong `app/prompt/gpt_prompt.py`. Prompt hướng dẫn GPT phát hiện format bất kỳ và trả về JSON chuẩn 4 bước với tất cả values là plain string. Fallback về kết quả VLM gốc nếu GPT không available.

**Hệ quả:** Latency tăng thêm 1 API call. Code thêm `_normalize_ddx()` để catch trường hợp LLM vẫn trả array thay vì string. VLM output format linh hoạt hơn vì không cần đúng chuẩn.

---

### Sprint 5 - 05/05 → 10/05/2026

| Task | Người làm | Deadline | Trạng thái |
|---|---|---|---|
| Rút gọn pipeline từ 6 bước xuống 4 bước (DESCRIBE/REASONING/DDx/CONCLUSION) | Tiến | 06/05 | Xong |
| Implement engine routing theo tier (free → VLM, premium → GPT) | Tiến | 07/05 | Xong | |
| Implement LLM debate layer (`_complete_final_steps_with_llm`) | Minh | 08/05 | Xong |
| Cải thiện Socratic Q&A agent flow | Khôi | 08/05 | Xong |
| Deploy hệ thống lên Railway | Minh | 09/05 | Xong |
| Viết evaluation script so sánh GPT-5.4-mini và MedGemma (4 metrics) | Tiến | 09/05 | Xong |
| Refactor và hoàn thiện codebase | Cả nhóm | ongoing | Đang làm |
| Set up CI/CD | Minh | ongoing | Đang làm |
| Fix các bug còn lại và hoàn thiện frontend | Minh | ongoing | 🔄 Đang làm |
| Thêm data case mẫu | Khôi | ongoing | Đang làm |

---

