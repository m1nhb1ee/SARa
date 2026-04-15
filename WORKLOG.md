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
S