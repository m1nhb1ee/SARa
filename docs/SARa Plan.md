# SARa — Kế Hoạch Phát Triển

Nền tảng luyện đọc phim X-quang/CT/MRI cho sinh viên y khoa. Tài liệu nêu các hướng phát triển chính sau giai đoạn MVP.

## Hiện trạng

SARa đã chạy được: người dùng luyện đọc phim theo 4 bước (Mô tả → Lập luận → Chẩn đoán phân biệt → Kết luận), được AI chấm điểm và gợi ý, có thể upload ảnh để tạo case mới.

Hai vấn đề cần giải quyết:

- **AI chưa đủ chính xác.** Theo đánh giá nội bộ, độ chính xác chẩn đoán còn thấp và đôi khi bỏ sót ca nguy kịch. Mọi loại phim đang dùng chung một luồng xử lý và một model, chưa tận dụng đặc thù riêng của X-quang, CT, MRI.
- **Người dùng học một mình.** Chưa có nơi để hỏi đáp, thảo luận hay học cùng nhau.

## Năm hướng phát triển

### 1. Tách luồng xử lý theo từng loại phim

Hiện X-quang, CT, MRI đi chung một luồng. Sẽ tách thành các luồng riêng để mỗi loại phim có cách xử lý và tiêu chí chấm phù hợp với đặc thù của nó. Đây là bước nền tảng cho hướng 2 và 3, và giúp mở rộng sang loại phim mới (như siêu âm) dễ dàng hơn.

### 2. Dùng model chuyên biệt để tăng độ chính xác

Thay vì một model gánh tất cả, dùng model phù hợp cho từng loại phim và từng vùng cơ thể; tinh chỉnh (fine-tune) model khi có đủ dữ liệu. Mọi thay đổi model phải được đo lường trước khi áp dụng, đặc biệt giữ vững khả năng phát hiện ca nguy kịch. Mục tiêu: nâng độ chính xác và giảm nhận định sai.

### 3. Khoanh vùng bất thường bằng YOLO

Sau khi model chẩn đoán xác định ca có bệnh, hệ thống sẽ dùng YOLO để khoanh vùng vị trí bất thường ngay trên ảnh. Người học nhìn thấy rõ "tổn thương nằm ở đâu" thay vì chỉ đọc mô tả bằng chữ. Vùng khoanh chỉ hiện sau khi người học đã tự mô tả, để không làm lộ đáp án.

### 4. Xây dựng cộng đồng và diễn đàn

Biến SARa thành nơi học có tương tác: kho kiến thức đọc được như một quyển sách, kèm diễn đàn để người dùng đặt câu hỏi, thảo luận ca khó, chia sẻ kinh nghiệm, bình chọn câu trả lời hay. Có cơ chế kiểm duyệt để giữ thông tin y khoa đáng tin cậy.

### 5. Cùng chẩn đoán

Cho phép nhiều người cùng làm một ca: vào chung một phòng, mỗi người tự làm rồi so sánh cách tiếp cận và cùng đi đến kết luận. Mở rộng từ chế độ tranh luận với AI hiện có sang tương tác giữa người với người. Tăng tính tương tác và học hỏi lẫn nhau.

## Lộ trình

Làm theo thứ tự phụ thuộc, ưu tiên xong nền tảng trước:

| Bước | Nội dung | Hoàn thành khi |
|---|---|---|
| 0 | Chuẩn hóa cách đo lường chất lượng AI | Có quy trình đánh giá lặp lại được |
| 1 | Tách luồng theo loại phim | Sản phẩm cũ vẫn chạy ổn; thêm loại phim mới không phải sửa phần lõi |
| 2 | Model chuyên biệt | Độ chính xác tăng so với hiện tại; không bỏ sót ca nguy kịch nhiều hơn |
| 3 | YOLO khoanh vùng | Khoanh đúng vị trí cho ít nhất một loại phim |
| 4 | Cộng đồng, diễn đàn | Người dùng đăng bài, thảo luận, bình chọn được |
| 5 | Cùng chẩn đoán | Nhiều người cùng làm một ca và chốt kết luận chung |

Sau bước 1, hai nhánh có thể làm song song: nâng cấp AI (bước 2, 3) và phát triển cộng đồng (bước 4, 5).

## Lưu ý quan trọng

- **An toàn người bệnh là trên hết.** SARa là công cụ học tập, không phải công cụ chẩn đoán lâm sàng và không thay thế bác sĩ. Mọi kết quả AI đều kèm cảnh báo có thể sai.
- **Đo trước khi đổi.** Không đưa model mới vào dùng nếu chưa được đánh giá và làm giảm chỉ số an toàn.
- **Không phá sản phẩm đang chạy.** Tái cấu trúc theo từng phần, có cơ chế bật/tắt và kiểm thử lại.

## Đo lường thành công

- Độ chính xác chẩn đoán theo từng loại phim, so với mức hiện tại.
- Khả năng không bỏ sót ca nguy kịch (chỉ số bắt buộc).
- Độ chính xác khoanh vùng bất thường.
- Mức độ tham gia cộng đồng: số bài viết, thảo luận, số người cùng chẩn đoán.
- Tỉ lệ người dùng quay lại sau khi có tính năng cộng đồng.

---

*SARa · Group 076 · VinUniversity AI20K · 2026. Tài liệu định hướng, cập nhật theo tiến độ.*
