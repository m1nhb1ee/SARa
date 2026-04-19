Design a complete web application UI for "SARa" (Smart AI Radiology), 
a dark-mode medical education platform for Vietnamese Year 4–5 medical 
students learning diagnostic radiology.

─────────────────────────────────────────────
DESIGN SYSTEM
─────────────────────────────────────────────
Theme: Dark mode only
Primary background: #0D1117
Surface / card background: #161B22
Border / divider: #21262D
Accent (primary): #2F80ED  (clinical blue)
Accent (success / correct): #27AE60
Accent (warning / partial): #F2994A
Accent (error / incorrect): #EB5757
Text primary: #E6EDF3
Text secondary: #8B949E
Text muted: #484F58

Typography:
  Headings — Inter SemiBold / Bold
  Body — Inter Regular
  Clinical labels / step tags — Inter Medium, letter-spacing 0.04em
  Monospace (confidence score, metrics) — JetBrains Mono

Corner radius: 8px for cards, 6px for buttons, 4px for tags
Spacing unit: 8px grid

─────────────────────────────────────────────
SCREEN 1 — DASHBOARD / HOME
─────────────────────────────────────────────
Layout: Left sidebar (240px) + main content area

Left Sidebar:
  - SARa logo top-left (brain-scan icon + "SARa" wordmark in clinical blue)
  - Nav items with icons:
      📚  Tự ôn tập          (Browse Library)
      🖼️  Hỏi đáp ảnh        (Image Q&A)
      🏋️  Thực hành chẩn đoán (Diagnosis Practice)  ← active state
      📊  Kết quả của tôi    (My Performance)
  - Bottom: user avatar + name placeholder

Main Content — "Thực hành chẩn đoán":
  - Page header: "Case Study Library" + subtitle "Chọn ca để bắt đầu luyện tập pipeline 6 bước"
  - Filter bar: modality pills (Tất cả | X-Ray | CT | MRI), 
    difficulty pills (Tất cả | Cơ bản | Trung bình | Nâng cao)
  - Case grid: 3 columns, each card contains:
      • Thumbnail of medical image (dark placeholder with scan icon)
      • Modality badge top-right (e.g. "X-RAY" in blue pill)
      • Difficulty badge (color-coded: green/orange/red)
      • Case title (e.g. "Viêm phổi thuỳ dưới phải")
      • Clinical hint: 2-line excerpt of patient history
      • Status indicator: "Chưa làm" / "Đang làm" / "Hoàn thành ✓"
      • CTA button: "Bắt đầu" (blue) or "Tiếp tục" (outlined)
  - Show 9 cards in grid (3×3)

─────────────────────────────────────────────
SCREEN 2 — ACTIVE DIAGNOSIS SESSION
─────────────────────────────────────────────
Layout: Two-panel split (left 55% image + right 45% chat)

Left Panel — Medical Image Viewer:
  - Dark background (#0D1117)
  - Large medical scan image centered (chest X-ray example)
  - Top bar: case name + modality badge + difficulty badge
  - Zoom controls (+ / - / fit) bottom-right corner
  - Clinical history card pinned above image:
      "Bệnh nhân nam 45 tuổi, ho kéo dài 2 tuần, sốt nhẹ về chiều."
      (styled as a clinical note card with left accent border in blue)

Right Panel — Socratic Agent Interface:
  - Header: "Socratic AI" + small badge "Powered by Claude"
  
  - Pipeline Progress Bar at top:
      6 steps shown as horizontal stepper:
      [OBSERVE] → [DESCRIBE] → [INTERPRET] → [HYPOTHESIS] → [DDx] → [CONCLUSION]
      Current step highlighted in blue with filled circle,
      completed steps in green with checkmark,
      future steps in grey

  - Step context chip below stepper:
      "Bước 1 · OBSERVE" in a pill badge (blue background)

  - Chat area (scrollable):
      AI message bubble (left-aligned, surface color #161B22, blue left border):
         "Hãy quan sát kỹ hình ảnh. Bạn nhận thấy điều gì bất thường ở 
            vùng thuỳ dưới phổi phải? Mô tả những gì bạn thấy."
      
      Student message bubble (right-aligned, #2F80ED/15% bg):
        "Tôi thấy có vùng đục tăng ở góc dưới phải..."

      AI feedback bubble (left-aligned, green left border = correct):
        ✅ "Tốt! Bạn đã xác định đúng vị trí. Bây giờ hãy mô tả 
            đặc điểm của bờ tổn thương — rõ hay không rõ?"

  - Input area fixed at bottom:
      Textarea: "Nhập câu trả lời của bạn..." (dark, rounded)
      "Gửi" button (blue, right side)
      Hint button: "💡 Gợi ý" (ghost button, left side)

─────────────────────────────────────────────
SCREEN 3 — STEP FEEDBACK CARD (modal overlay)
─────────────────────────────────────────────
Centered modal (640px wide) on dim overlay:

  Header: Step tag "DESCRIBE · Bước 2" + close X

  Score ring: Large circular progress (0–100), 
    75 = orange, 90+ = green, below 60 = red
    Center text: "75/100"

  Section "✅ Làm đúng":
    Green chip list of correct observations

  Section "⚠️ Cần cải thiện":
    Orange chip list with specific errors, e.g.:
    "Chưa mô tả độ rõ của bờ tổn thương"
    "Bỏ sót đặc điểm phân bố bilateral/unilateral"

  Section "📖 Gợi ý học thêm":
    1–2 line clinical tip in italics

  CTA: "Tiếp tục → Bước 3: INTERPRET" (full-width blue button)

─────────────────────────────────────────────
SCREEN 4 — ANSWER KEY REVEAL (after all 6 steps)
─────────────────────────────────────────────
Full page, replaces the session view:

  Header: "Kết quả ca học" + case name

  Left column: Medical image with annotation overlay
    (colored boxes highlighting key findings with labels)

  Right column:
    "Chẩn đoán chính xác" section:
      → Large diagnosis badge: "Viêm phổi thuỳ dưới phải · Pneumonia"
      → Confidence indicator: "Độ chính xác bác sĩ: 94%"
    
    "Phân tích theo pipeline" accordion:
      Each step (OBSERVE → CONCLUSION) shows:
        Step tag | Your score | Model answer

    "DDx được loại trừ":
      - Atelectasis ✗ (vì...)
      - Pleural Effusion ✗ (vì...)
      - TB ✗ (vì...)

    Session summary chips:
      ⏱ "Thời gian: 18 phút"
      🎯 "Điểm trung bình: 82/100"
      📈 "+12 so với ca trước"

  Bottom CTA row:
    "← Về thư viện" (ghost)    "Làm lại ca này" (outlined)    "Ca tiếp theo →" (blue filled)

─────────────────────────────────────────────
SCREEN 5 — PERFORMANCE DASHBOARD
─────────────────────────────────────────────
Full page layout:

  Stat cards row (4 cards):
    • Cases Completed: 12
    • Avg Score: 78/100
    • Weak Step: "DDx" (with red badge)
    • Streak: 🔥 5 ngày liên tiếp

  "Điểm theo từng bước" — Radar chart:
    6 axes (OBSERVE / DESCRIBE / INTERPRET / HYPOTHESIS / DDx / CONCLUSION)
    Two overlays: "Tuần này" (blue) vs "Tuần trước" (grey dashed)

  "Lịch sử ca gần đây" — Table:
    Columns: Case name | Modality | Date | Score | Weakest Step | Action

  "Gợi ý ôn tập" card:
    "Bạn hay mắc lỗi ở bước DDx. Thử luyện các ca Intermediate 
     về Chest để cải thiện."
    CTA: "Xem ca gợi ý →"

─────────────────────────────────────────────
ADDITIONAL SPECS
─────────────────────────────────────────────
- All screens must support 1440px desktop width
- Responsive breakpoint sketch for 768px tablet (sidebar collapses to icon rail)
- Use real placeholder medical scan images (grayscale X-ray style)
- All Vietnamese text must be legible — use proper diacritics
- Loading states: skeleton loaders for cards, typing indicator (3 dots) for AI responses
- Empty state design for "Chưa có ca nào" 
- Micro-interactions: step completion animation (checkmark pulse), 
  score counter animation, pipeline progress fill

Deliverable: 5 frames at 1440×900, auto-layout components, 
organized into a component library page.