# Script tải ảnh CT/MRI từ Radiopaedia

## Bước 1 — Lấy data.json

1. **Đăng nhập** tài khoản Radiopaedia trước
2. Vào trang case muốn tải (ví dụ: `radiopaedia.org/cases/xxxxx`)
3. Mở **DevTools** (F12) → tab **Network**
4. Trong thanh lọc, chọn **Fetch/XHR**
5. Gõ `annotated_viewer_json` hoặc stud vào ô filter để lọc request
6. **Reload trang** (F5)
7. Tìm request tên chứa `annotated_viewer_json`  → bấm vào → tab **Response**
8. Copy toàn bộ nội dung → paste vào file `data.json` trong folder này

## Bước 2 — Cập nhật Cookie (nếu bị lỗi 401/403)

> **Cần đăng nhập tài khoản trước** thì cookie mới có session hợp lệ, không đăng nhập sẽ bị lỗi 401/403.

1. DevTools → tab **Application** → **Cookies** → chọn `radiopaedia.org`
2. Copy toàn bộ cookie

3. Thay vào biến `COOKIE` ở dòng 11 trong `download.py`

## Bước 3 — Chạy script

```bash
cd "C:\Users\ADMIN\Downloads\ScriptCT-MRi-Radiopedia"
python download.py
```

- Script hỏi tên thư mục → nhập tên muốn lưu
- Ảnh được lưu vào `Downloads/<tên>/series_0_xxx/`, `series_1_xxx/`, ...
