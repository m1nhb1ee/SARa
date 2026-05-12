# Weekly Journal

Ghi lại hành trình xây dựng sản phẩm mỗi tuần — những gì đã làm, học được gì, AI giúp như thế nào.

> **Cập nhật mỗi cuối tuần** (trước khi tạo PR). Không cần dài, chỉ cần thật.

---

## Tuần 1 — 11/04/2026

**Thành viên:** Nguyễn Trọng Tiến, Nguyễn Trọng Minh, Nguyễn Trọng Thiên Khôi

### Đã làm
- Xác định target user: Sinh viên y khoa năm 4–5 đang rotation tại khoa Chẩn đoán hình ảnh
- Phân tích pain point theo 3 tầng: Triệu chứng bề mặt → hành vi quan sát → root cause (thiếu feedback loop có cấu trúc theo từng bước pipeline)
- Ước lượng thị trường
- Hoàn thành Phân tích nghiệp vụ, bao gồm Executive Summary, Problem Statement, User Stories, Solution Design, and Evaluation Metric.
- Hoàn thành MVP Scope: kiến trúc 3 agent (CV Agent, Socratic Agent, LLM Agent), Interactive Diagnosis Flow , 7 tính năng nghiệp vụ (F-01 đến F-07) cần implement.
- Thử nghiệm mô hình và tìm nguồn data ảnh y khoa.
### Khó nhất tuần này
- Xác định Flow giải pháp của sản phẩm: Lựa chọn giữa các luồng sử dụng mô hình VLM -> LLM hay CV Segmentation model -> LLM. Thử nghiệm độ chính xác của một số model open-source, kèm gửi kết quả và nhận feedback từ bác sĩ, các mô hình có thể kể đến như: MedGemma-1.5-4B, medvlm-r1.
- Cân nhắc giữa việc sử dụng một mô hình VLM mạnh, đã được pretrained trên bộ dataset y khoa lớn, nhưng nặng và đòi hỏi hạ tầng deploy và mô hình nhẹ hơn, có độ chính xác chẩn đoán kém hơn nhưng khả thi hơn để deploy. Phương án sau được chọn và kết quả VLM đưa ra sẽ chuyển sang đưa ra kết quả quan sát hình ảnh theo luồng Observe → Describe → Interpret → DDx → Conclusion, để LLM có thể đưa ra các câu hỏi gợi ý cho sinh viên đưa ra chẩn đoán và feed back kết quả thay vì chẩn đoán trực tiếp.
 
### AI tool đã dùng
| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| ChatGPT | Phân tích pain point, hỗ trợ gợi ý cấu trúc Problem Statement, format phần tài liệu tham khảo theo chuẩn IEEE, phát hiện điểm chưa nhất quán giữa pain point và success metric |
| Claude | Brainstorm ý tưởng tính năng, kiểm tra lại logic MVP scope Gợi ý thêm góc nhìn về F-06 (gợi ý case theo trình độ) và F-07 (giải thích đáp án theo pipeline) |

### Học được
- Problem Statement có cấu trúc buộc phải trả lời được "sai ở đâu" và "đo bằng gì", có nguồn số liệu rõ ràng, tránh viết chung chung.
- Success Metric phải truy ngược về từng pain point cụ thể, không phải chỉ số tăng trưởng sản phẩm.
- User story và tính năng nên có liên kết rõ ràng, mỗi tính năng phải trả lời được "phục vụ nhu cầu nào của ai".
- Sự cân nhắc tradeoff giữa việc thiết kế luồng cho model mạnh và model yếu hơn nhưng nhẹ hơn để deploy.

### Nếu làm lại, sẽ làm khác
- Xác định Success Metric ngay từ khi viết pain point, không để đến cuối mới bổ sung.
- Phỏng vấn thêm sinh viên y khoa thực tế trước khi viết PRD thay vì chỉ dựa vào tài liệu và ước lượng.

### Kế hoạch tuần tới
- Architecture & API design (Chốt kiến trúc và thiết kế API).
- Thiết kế và implement flow cho 2 luồng VLM và agent
- Thiết kế mẫu các màn hình của phần UI

---

## Tuần 2 — 18/04/2026

**Thành viên:** Nguyễn Trọng Tiến, Nguyễn Trọng Minh, Nguyễn Trọng Thiên Khôi

**Checkpoint:** G2 - Architecture & API Design · Scope Lock (Q1)

### Đã làm

- **Chốt kiến trúc hệ thống:** Finalize System Architecture Diagram gồm 5 tầng (Client → FastAPI Backend → Agent Orchestrator → External AI APIs → Storage). Xác nhận stack: React 18 + Vite · FastAPI · Supabase (PostgreSQL + Redis + Object Storage) · OpenAI GPT-4o.
- **Thiết kế API contract:** Định nghĩa các endpoint chính cho pipeline 6 bước:
  - `POST /api/v1/sessions/start`: Khởi tạo session, kích hoạt CV Agent async
  - `POST /api/v1/sessions/{id}/answer`: Nộp câu trả lời, trigger Answer-Check Agent
  - `GET /api/v1/cases` / `GET /api/v1/cases/{id}`: Lấy danh sách và chi tiết ca (không expose answer key)
- **Thiết kế Database Schema (ERD):** Tạo supa SQL database với 12 bảng: `answer_keys`, `case_recommendations`, `cases`, `disease_profiles`, `pipeline_replays`, `sessions`, `step_attempts`, `step_rubrics`, `upload_messages`, `upload_sessions`, `user_skill_profiles`, `users`.
- **Thiết kế Sequence Diagram:** Hoàn thành 2 luồng chính, bao gồm Session Initialisation (CV Agent chạy async) và Answer Submission & Pipeline Advance (score gate ≥ 0.6 để chuyển bước).
- **Scope Lock - Checkpoint Q1:** Review lại MoSCoW framework, chốt danh sách MUST cho sprint 3 tuần, đóng băng WON'T để tránh scope creep.
- **Phân công sprint rõ ràng:** Backend chịu trách nhiệm state machine + 3 endpoint; Frontend bắt đầu wireframe case library + image viewer; ML/AI bắt đầu prompt engineering CV Agent và Socratic Agent. Database Manager chịu trách nhiệm thiết kế và populate database.
- **Thiết kế Data Flow Diagram:** Mô tả đường đi của dữ liệu từ input sinh viên → State Machine → 3 Agent → feedback trả về UI.

### Khó nhất tuần này

- **Setup hạ tầng (Supabase, Redis, Docker):** Đây là điểm tốn thời gian và gây block nhiều nhất trong tuần. Cụ thể: cấu hình Supabase Row-Level Security cho đúng với schema 5 bảng mất nhiều vòng debug hơn dự kiến; Redis session management với TTL 24h cần test kỹ edge case resume session; Docker Compose local dev phải đảm bảo environment nhất quán giữa các thành viên (FastAPI + PostgreSQL + Redis + biến môi trường API key).
- **Kết nối CV Agent async với Redis cache:** CV Agent chạy async sau khi session start, nhưng cần đảm bảo findings đã được cache trong Redis trước khi Answer-Check Agent gọi đến ở bước sau. Cần xử lý race condition khi sinh viên trả lời bước 1 quá nhanh trước khi CV Agent kịp hoàn thành.
- **Signed URL cho medical images:** Supabase Storage phục vụ ảnh qua signed URL có expiry — cần cân nhắc TTL phù hợp để không hết hạn giữa session (session có thể kéo dài 30–60 phút), nhưng cũng không để URL tồn tại quá lâu vì lý do bảo mật dữ liệu.

### AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| Claude | Review và phản biện API contract; gợi ý edge case cho state machine (skip attempt, out-of-order POST, duplicate submission, session timeout); hỗ trợ debug cấu hình Supabase RLS và Redis session TTL | Phát hiện 3 edge case nhóm bỏ sót; gợi ý dùng Redis TTL 24h + PostgreSQL cho bản ghi lâu dài — phân tách rõ vai trò hai lớp storage |
| ChatGPT | Brainstorm cấu trúc system prompt cho CV Agent (vision radiology prompt); hỏi về Docker Compose setup với multi-service (FastAPI + PostgreSQL + Redis) | Cung cấp template Dockerfile và docker-compose.yml ban đầu; nhóm chỉnh lại theo đúng biến môi trường dự án |
| Gemini | Hỗ trợ tra cứu Supabase documentation và cách cấu hình Row-Level Security; so sánh các cách xử lý signed URL expiry cho object storage | Tổng hợp nhanh doc Supabase; giúp rút ngắn thời gian research cấu hình RLS từ ~2 giờ xuống còn ~45 phút |

### Học được

- **Infrastructure-first là quyết định đúng cho tuần 2.** Nếu hạ tầng chưa chạy được local thì mọi code agent đều không test được thực tế. Dù mất nhiều thời gian hơn dự kiến, setup xong Docker Compose + Supabase + Redis trước giúp tuần 3 có thể sprint nhanh hơn.
- **Supabase RLS phải được config ngay từ đầu, không phải sau.** Bật RLS muộn sau khi đã có data là đau hơn nhiều — schema và policy phải được thiết kế song song.
- **Redis và PostgreSQL có vai trò khác nhau rõ ràng, không thể hoán đổi.** Redis cho trạng thái volatile thay đổi liên tục (pipeline state, CV findings cache); PostgreSQL cho bản ghi lâu dài (step attempts, scores). Nhầm vai trò là performance sẽ kém nghiêm trọng.
- **Signed URL expiry cần được tính toán theo user journey, không theo convention.** Default 1 giờ của Supabase không phù hợp cho session có thể kéo dài 30–60 phút — phải set expiry dài hơn hoặc implement refresh logic.
- **AI tool có thể rút ngắn research time đáng kể khi làm việc với documentation mới.** Gemini giúp tổng hợp Supabase doc nhanh; điều này cho thấy với hạ tầng/service mới, nên hỏi AI trước khi đọc full doc.

### Nếu làm lại, sẽ làm khác

- Dành hẳn 1 buổi đầu tuần để tất cả thành viên cùng chạy Docker Compose local thành công — không để đến giữa tuần ai đó vẫn chưa setup xong môi trường.
- Test Supabase RLS với mock data ngay sau khi thiết kế schema, không chờ đến khi có data thật.

### Kế hoạch tuần tới

- **Backend:** Implement FastAPI server, pipeline state machine, 3 endpoint chính, Docker Compose local dev setup. Seed script 5 ca hardcoded dưới dạng static JSON.
- **Frontend:** Xây dựng case library UI, image viewer (DICOM.js), giao diện Socratic dialogue bước đầu.
- **ML/AI:** Hoàn thiện system prompt CV Agent và Socratic Agent; bắt đầu prompt engineering Answer-Check Agent với rubric JSON mẫu.
- **Chung:** Tuyển 30 sinh viên pilot từ rotation lâm sàng VinUniversity (PM phụ trách), đặt mục tiêu chạy session thử nghiệm đầu tiên cuối tuần 3.

---

## Tuần 3 - 25/04/2026

**Thành viên:** Nguyễn Trọng Tiến, Nguyễn Trọng Minh, Nguyễn Trọng Thiên Khôi

**Checkpoint:** G3 - Core Feature Implementation and MVP

### Đã làm

- **Refactor toàn bộ cấu trúc code và chuẩn hoá biến môi trường:** Tách rõ config, service layer, và routing. Chuẩn hoá `.env` với đầy đủ biến cho Supabase, HuggingFace, và Django.
- **Integrate frontend-backend:** Kết nối các luồng chính, gồm: upload ảnh, tạo session, submit đáp án, xem kết quả thành fully functional end-to-end.
- **Xác định rubric đánh giá cho 6 bước pipeline:** Định nghĩa `step_rubrics` cho OBSERVE → DESCRIBE → INTERPRET → HYPOTHESIS → DDx → CONCLUSION, bao gồm `criterion_label`, `scoring_guide`, và `max_score`. Seed vào database.
- **Thử nghiệm VLM model trên bộ data volume từ bác sĩ (đa ảnh):** Chạy MedGemma-1.5-4B trên bộ ảnh thực tế của bác sĩ cung cấp — mỗi case gồm nhiều ảnh (MRI T1, T2, ADC, DWI...). Phát hiện hai pattern:
  - Model **hallucinate** khi xử lý bộ ảnh gồm các modality khác nhau trong cùng một lần gọi.
  - Model **chẩn đoán tốt** khi xử lý bộ ảnh cùng một volume (các slice khác nhau của cùng một lần chụp).
- **Sửa VLM API để nhận nhiều ảnh một lúc:** Cập nhật endpoint `POST /uploaded-cases/` để nhận `images[]` (list file) thay vì `image` đơn lẻ. Mỗi ảnh kèm `slice_index`. Lưu toàn bộ vào bảng `case_images` thay vì column `image_urls` trên `cases`.
- **Thiết kế lại database schema cho đa ảnh:** Tạo bảng `case_images` riêng biệt (id, case_id, image_url, slice_index, series, caption), xoá column `image_urls` khỏi bảng `cases`, xoá `image_url` khỏi `upload_sessions`.

### Khó nhất tuần này

- **Model hallucination khi xử lý đa modality:** MedGemma bị "lẫn lộn" khi nhận cùng lúc ảnh MRI T1, T2, ADC, DWI — mô tả nhầm đặc trưng của modality này sang modality kia. Chưa có fallback tốt cho trường hợp này.
- **Thiết kế lại database cho đa ảnh:** Cần quyết định giữa việc giữ `image_urls[]` trên bảng `cases` hay tách thành bảng riêng `case_images`. 


### AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| Claude Code | Hỗ trợ refactor toàn bộ backend services và views để adapt với schema mới (case_images table); debug lỗi RLS policy; cập nhật ENDPOINTS.md theo thay đổi API | Tự động hoá phần lớn code migration, phát hiện các chỗ còn reference column đã bị xoá (`image_urls`, `image_url`) |
| Claude | Tư vấn thiết kế schema đa ảnh; phân tích trade-off giữa array column và bảng riêng; gợi ý cấu trúc RLS policy cho `case_images` | Chốt được phương án bảng `case_images` riêng với cascade delete |
| ChatGPT | Brainstorm cách xử lý hallucination khi model nhận ảnh đa modality | Gợi ý một số hướng: tách theo modality trước khi gọi model, thêm metadata modality vào prompt, chỉ cho phép upload cùng modality |

### Học được

- **Bảng riêng cho ảnh tốt hơn array column.** `image_urls text[]` trên `cases` không thể lưu metadata per-image (slice_index...). Bảng `case_images` với FK cho phép mở rộng linh hoạt mà không phá schema cũ.
- **Kiểm tra migration vs. dashboard ngay từ đầu.** Supabase dashboard tự bật RLS khi tạo bảng qua UI, migration SQL thì không. Phải đồng bộ bằng cách luôn viết migration thay vì tạo bảng qua UI, hoặc luôn thêm `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` trong migration.
- **VLM nhạy cảm với độ đồng nhất của input.** Cùng model, cùng prompt, bộ ảnh đồng nhất (same volume) cho kết quả chính xác, bộ ảnh đa modality cho kết quả sai. Chất lượng input quan trọng hơn prompt engineering.

### Nếu làm lại, sẽ làm khác

- Thiết kế `case_images` ngay từ sprint 1 thay vì bắt đầu bằng `image_urls[]` rồi phải migrate sau.
- Luôn tạo bảng qua migration SQL, không dùng Supabase dashboard UI để tránh lệch RLS config.

### Kế hoạch tuần tới

- **Backend:** Thiết kế lại luồng upload và xử lý đa ảnh, viết script đẩy bộ ảnh case lớn lên database, thiết kế chuẩn security cho hệ thống.
- **AI/ML:** Tìm cách fallback khi user upload ảnh đa modality, thử nghiệm strategy tách theo modality trước khi gọi VLM.
- **Chung:** Chạy thử end-to-end với bộ data thực từ bác sĩ; ghi nhận lỗi và điều chỉnh prompt theo kết quả thực tế.

---

## Tuần 5 - 02/05/2026

**Thành viên:** Nguyễn Trọng Tiến, Nguyễn Trọng Minh, Nguyễn Trọng Thiên Khôi

**Checkpoint:** G4 - System Integration & Data Population

### Đã làm

- **Kiến trúc đa volume cho ảnh y tế:** Thiết kế lại toàn bộ luồng ảnh, mỗi case giờ chứa nhiều volume (chuỗi chụp), mỗi volume chứa nhiều slice. Thêm cột `volume_name` vào bảng `case_images`, cập nhật upload endpoint nhận `volume_names[]` song song với `images[]`, API trả về ảnh dưới dạng `images: [{ volume_name, slices: [{ image_url, slice_index }] }]`.

- **Phân loại case theo source:** Thêm cột `source` (`system`/`uploaded`) vào bảng `cases`. Gộp 3 route riêng lẻ (`/cases/`, `/system-cases/`, `/uploaded-cases/`) thành một `GET /cases/?source=` duy nhất, giảm trùng lặp logic và đơn giản hoá API.

- **Pipeline LLM → VLM:** Thêm bước GPT-4o LLM trước khi gọi MedGemma để nhìn vào 4 ảnh mẫu và viết lại prompt phù hợp với modality/anatomy thực tế của case. 

- **Upload 22 case mẫu lên Supabase:** Viết script `scripts/upload_system_cases.py` xử lý toàn bộ bộ dữ liệu trong thư mục `Data/` (Abdomen, Chest, MSK, Neuro ~2,600 ảnh). Script tự động upsert `disease_profiles` trước khi tạo case, map rubric 5 bước sang 6 `answer_keys` OBSERVE/DESCRIBE/INTERPRET/HYPOTHESIS/DDx/CONCLUSION.

- **Fix nhiều lỗi tồn đọng:** Chỉnh sửa prompt và host infrastructure để fix các lỗi timeout và hallucination.

### Khó nhất tuần này

- **Gradio Space crash với nhiều ảnh:** Upload 29 ảnh lần lượt nhận 3 loại lỗi khác nhau, `GPU task aborted`, và `NameError` — tất cả đều xuất phát từ cùng một nguyên nhân: HF Space hết VRAM khi xử lý quá nhiều ảnh một lúc. Việc xác định root cause mất thời gian vì mỗi lần lại ra error message khác.

- **VLM bỏ step label trong output:** Model nhận prompt có "1. OBSERVE: [...]" nhưng output lại là "1. The cerebral hemispheres...", bỏ label "OBSERVE:" đi. Phải thêm instruction rõ ràng "Each step label must appear in your response exactly as shown" cả trong base template lẫn meta-prompt.

### AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| Claude Code | Refactor kiến trúc đa volume, viết upload script, debug Gradio timeout, cải thiện anti-hallucination prompt, viết WORKLOG và JOURNAL | Tự động hoá phần lớn boilerplate; phát hiện edge case `clinical_history` string vs list; đề xuất pattern `submit().result(timeout)` thay cho `predict()` |
| GPT-4o (tích hợp trong pipeline) | Pre-process ảnh upload, viết lại prompt cho MedGemma theo modality/anatomy thực tế | Prompt được tailored rõ ràng hơn; giảm hallucination "bình thường hoá" so với template generic |

### Học được

- **VLM cần consistency rule giữa các bước.** Model xử lý từng bước gần như độc lập, bước 2 tìm ra subdural hematoma lớn, bước 3 vẫn có thể nói "No focal finding". Phải thêm rule tường minh: nếu DESCRIBE tìm thấy bất thường, INTERPRET phải nói "Abnormal".

- **Nhiều error message khác nhau có thể cùng một root cause.** Ba lỗi Gradio (`WinError 10054`, `GPU task aborted`, `NameError`) đều do VRAM limit. Khi debug, nên cluster các lỗi theo thời điểm và context trước khi xử lý riêng lẻ.

- **GPT-4o làm "translator" trước VLM là pattern hiệu quả.** Thay vì cố viết một prompt universal đủ tốt cho mọi loại ảnh, để LLM nhìn vào ảnh và tự quyết định focus vào cấu trúc nào phù hợp. Chi phí thêm 1 API call đáng so với chất lượng prompt tăng lên rõ rệt.

### Nếu làm lại, sẽ làm khác

- Test prompt với case "dương tính giả bình thường" ngay từ đầu, không chỉ test với case dễ nhận diện. Hallucination "bình thường hoá" khó phát hiện hơn hallucination "bịa bệnh lý".
- Giới hạn số lượng ảnh gửi lên VLM từ sớm thay vì đợi đến khi gặp lỗi VRAM.

### Kế hoạch tuần tới

- **Backend:** Hoàn thiện deploy, fix lỗi VLM với nhiều ảnh (sampling strategy), viết test cases cho giai đoạn testing.
- **Frontend:** Tiếp tục hoàn thiện UI, test end-to-end flow với 22 case mẫu mới.
- **Chung:** Tuyển thêm case mẫu đa dạng modality/anatomy; chuẩn bị cho giai đoạn pilot testing với sinh viên.

---

## Tuần 6 - 10/05/2026

**Thành viên:** Nguyễn Trọng Tiến, Nguyễn Trọng Minh, Nguyễn Trọng Thiên Khôi

**Checkpoint:** G5 - Dual-model pipeline, Debate pipeline, deployment, evaluation

### Đã làm

- **Rút gọn pipeline chẩn đoán:** Giảm từ 6 bước (OBSERVE → DESCRIBE → INTERPRET → HYPOTHESIS → DDx → CONCLUSION) xuống còn 4 bước (DESCRIBE / REASONING / DDx / CONCLUSION). Pipeline ngắn hơn giảm latency và giảm cơ hội VLM hallucinate ở các bước trung gian. GPT cho kết quả ổn định hơn với format 4 bước.

- **Engine routing theo tier tài khoản:** Implement luồng song song hai model — người dùng premium dùng GPT-5.4-mini, người dùng free dùng MedGemma. Backend trả về `is_premium` từ bảng `users` trong cả login và `GET /auth/me/`. Mapping tier → engine tập trung trong `src/constants/engineConfig.ts` với `ENGINE_BY_TIER` để có thể thay đổi sau mà không cần sửa business logic.

- **LLM debate layer trên output VLM:** Thêm bước GPT post-processing sau MedGemma (`_complete_final_steps_with_llm`). GPT nhận toàn bộ raw text của VLM — bất kể format — và chuẩn hóa thành DESCRIBE/REASONING/DDx/CONCLUSION. Prompt được tách ra `gpt_prompt.py` và nhận `raw_vlm_output` thay vì hai field đã parse, để GPT xử lý được cả FINDINGS/IMPRESSION format và free text.

- **Cải thiện Socratic Q&A agent flow:** Chỉnh sửa luồng agent xử lý câu hỏi Socratic để tăng tính nhất quán giữa các bước và cải thiện chất lượng câu hỏi gợi ý.

- **Deploy lên Railway:** Hệ thống đã chạy trên môi trường production. Link: https://a20-app-076-production-0dcd.up.railway.app/

- **Evaluation 2 model:** Viết script `Data/evaluate.py` chạy benchmark GPT-5.4-mini vs MedGemma trên 22 cases (6 STAT) với 4 metrics: critical-finding recall, Top-1 accuracy, hallucination rate, reasoning-chain fidelity. Top-1 scoring được cải thiện từ string matching sang LLM semantic judge 2 bước (extract primary diagnosis → compare với folder label).

### Khó nhất tuần này

- **VLM output format không nhất quán giữa các lần gọi:** Cùng một prompt, cùng model, nhưng đôi khi trả JSON, đôi khi trả FINDINGS/IMPRESSION block, đôi khi free text. Giải pháp regex parser bị vỡ ngay khi format thay đổi, phải chuyển sang để GPT tự nhận dạng và chuẩn hóa.

### AI tool đã dùng

| Tool | Dùng để làm gì | Kết quả |
|---|---|---|
| Claude Code | Hỗ trợ refactor engine routing, LLM debate layer, evaluation script | Phát hiện edge case DDx trả về array thay vì string |
| GPT-5.4-mini (trong pipeline) | Phân tích ảnh cho tài khoản premium, chuẩn hóa output VLM | Kết quả nhất quán hơn MedGemma về format; ít hallucinate hơn trên bộ test |
| GPT-4o (judge trong evaluation) | Semantic comparison Top-1, hallucination scoring, fidelity rubric | Bắt được các trường hợp đúng về ngữ nghĩa nhưng khác từ ngữ mà string match bỏ sót |

### Học được
- **Model tuy không cho qua kết quả tốt nhưng có thể tận dụng để làm task khác**: Chuyển Medgemma-1.5-4B sang pipeline debate thay vì cố sử dụng trong answer key generation.


- **LLM format-agnostic tốt hơn rule-based parser cho VLM output.** Thay vì viết regex cho từng format có thể của VLM, để GPT tự đọc và extract, GPT xử lý được tất cả các biến thể mà không cần update rule khi VLM thay đổi hành vi.

### Nếu làm lại, sẽ làm khác

- Thiết kế evaluation metric ngay từ khi bắt đầu train/test model, không chờ đến khi có kết quả mới nghĩ cách đo.

### Kế hoạch tuần tới

- **Backend:** Hoàn thiện refactor codebase, setup CI/CD pipeline, fix các bug còn lại.
- **Frontend:** Hoàn thiện UI polish, test end-to-end flow toàn bộ tính năng.
- **Chung:** Chuẩn bị hoàn thiện sản phẩm cuối
