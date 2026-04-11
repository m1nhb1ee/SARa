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