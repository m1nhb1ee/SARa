# SARa Agents — Tài liệu kỹ thuật

> Dành cho team phát triển. Tài liệu này mô tả 2 agent lõi, bộ test đã chạy,
> hướng dẫn tích hợp vào Django khi database hoàn thiện, và quy ước về data.

---

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Socratic Agent](#2-socratic-agent)
3. [Answer-Check Agent](#3-answer-check-agent)
4. [Bộ test — kết quả & nhận xét](#4-bộ-test--kết-quả--nhận-xét)
5. [Hướng tích hợp Django (state machine + session)](#5-hướng-tích-hợp-django-state-machine--session)
6. [Quy ước data — rubric & ground_truth](#6-quy-ước-data--rubric--ground_truth)

---

## 1. Kiến trúc tổng quan

```
[CV Agent]  →  cv_findings.json  (ground truth từ hình ảnh)
                      ↓
         ┌────────────────────────┐
         │   Socratic Agent       │  ← đặt câu hỏi, phân loại intent, gợi ý hint
         │   Answer-Check Agent   │  ← chấm điểm, trả feedback
         └────────────────────────┘
                      ↓
              interactive.py  (state machine CLI — sau này là Django views.py)
```

**Luồng 1 bước (step loop):**

```
get_opening_question()
        ↓
user input
        ↓
classify_and_respond()   ← Socratic
   intent = answer/revise → evaluate()   ← Answer-Check
   intent = question/chit-chat → trả response, loop lại
        ↓
evaluate() trả { score, passed, errors, feedback, positive_feedback, could_add, next_step_preview }
        ↓
passed=True  → hiện kết quả, chuyển bước
failed + hint_count < 3  → get_hint() → hint_count++, loop lại
failed + hint_count >= 3 → force advance, hiện kết quả
```

**6 bước pipeline:**
`OBSERVE → DESCRIBE → INTERPRET → HYPOTHESIS → DDx → CONCLUSION`

---

## 2. Socratic Agent

**File:** `socratic.py`

### Các hàm public

#### `get_opening_question(step_name, step_index) → str`

Tạo câu hỏi mở đầu cho mỗi bước. Gọi GPT-4o với `SYSTEM_PROMPT_OPENING`.

- Temperature: 0.7 (sáng tạo, không lặp lại cứng)
- max_tokens: 150
- Fallback: `STEP_TEMPLATES[step_name]` nếu LLM lỗi

#### `get_hint(step_name, step_index, errors, hint_count, step_attempts=None) → str`

Tạo câu gợi ý sau khi sinh viên fail.

| `hint_count` | Hành vi |
|---|---|
| 1 | Nudge nhẹ về vùng thiếu |
| 2 | Chỉ trực tiếp vào element thiếu |
| 3 | Tiết lộ criterion, yêu cầu sinh viên hoàn thiện |

- `step_attempts`: list câu trả lời đã nói — agent **không được hỏi lại** những điều đã đề cập
- Temperature: 0.3
- max_tokens: 150

#### `classify_and_respond(user_input, step_name, step_index, current_question) → dict`

Phân loại intent của sinh viên và tạo response phù hợp.

**Trả về:** `{ "intent": str, "response": str }`

| Intent | Điều kiện | Response |
|---|---|---|
| `answer` | Sinh viên đang trả lời câu hỏi (dù đúng hay sai) | `""` — pipeline xử lý |
| `revise` | Sinh viên đang sửa lại câu trước: "ý tôi là", "sửa lại", "thực ra" | `""` — pipeline xử lý |
| `question` | Câu hỏi khái niệm, kết thúc bằng `?` | Trả lời ngắn + dẫn về bước hiện tại |
| `chit-chat` | "ok", "hiểu rồi", "tiếp theo đi" | Phản hồi ấm áp + Socratic nudge |

> **Lưu ý:** Phân loại bằng LLM (không dùng heuristic/từ khóa cứng) — đáng tin cậy hơn với tiếng Việt tự nhiên.

### System prompts

| Prompt | Dùng cho |
|---|---|
| `SYSTEM_PROMPT_OPENING` | `get_opening_question` |
| `SYSTEM_PROMPT_HINT` | `get_hint` |
| `SYSTEM_PROMPT_CLASSIFY` | `classify_and_respond` |

### Ràng buộc quan trọng

- Không bao giờ tiết lộ diagnosis hoặc answer key
- Không dùng tên bệnh trong câu gợi ý
- Chỉ hỏi về bước hiện tại

---

## 3. Answer-Check Agent

**File:** `answer_check.py`

### Hàm public

#### `evaluate(student_answer, step_code, step_index, rubric, answer_key, cv_findings, previous_steps=None, step_attempts=None, is_last_step=False) → dict`

Chấm điểm bằng GPT-4o.

**Đầu vào:**

| Tham số | Kiểu | Mô tả |
|---|---|---|
| `student_answer` | str | Câu trả lời mới nhất của sinh viên |
| `step_code` | str | Tên bước: OBSERVE, DESCRIBE, ... |
| `step_index` | int | Thứ tự bước 0–5 |
| `rubric` | dict | Rubric của bước này (từ `rubric.json`) |
| `answer_key` | dict | `{ "expected_finding": "..." }` |
| `cv_findings` | dict | Kết quả phân tích ảnh từ CV agent |
| `previous_steps` | list | `[{"step": "OBSERVE", "answer": "..."}]` — các bước đã hoàn thành |
| `step_attempts` | list | Các câu trả lời trước trong bước này (không bao gồm câu hiện tại) |
| `is_last_step` | bool | True nếu là bước CONCLUSION |

**Đầu ra:**

```python
{
    "score":             float,   # 0.0 – 1.0
    "passed":            bool,    # score >= 0.6 (tính từ score, không tin LLM)
    "errors":            list,    # [] nếu passed; error_codes từ rubric nếu fail
    "feedback":          str,     # "" nếu passed; tiếng Việt, không leak answer
    "positive_feedback": str,     # luôn điền — nêu đích danh những gì đúng
    "could_add":         str,     # 1-2 điểm có thể bổ sung
    "next_step_preview": str,     # 1 câu preview bước tiếp theo
    "latency_ms":        int,
}
```

**Quy tắc tính điểm:**

```python
passed = raw["score"] >= 0.6          # không tin LLM's passed field
errors = [] if passed else raw.get("errors", [])
feedback = "" if passed else raw.get("feedback", "")
```

> **Quan trọng:** LLM đôi khi trả `score=1.0` nhưng `passed=false` hoặc `errors=[...]`. Code luôn tính lại từ score, không dùng giá trị LLM trả về cho `passed` và `errors`.

### Scoring logic

- `step_attempts` được inject vào prompt để LLM **chấm UNION** tất cả attempts, không chỉ câu cuối
- `previous_steps` cho phép `positive_feedback` tham chiếu câu trả lời từ bước trước
- `valid_error_codes` được đọc từ rubric dynamically — LLM chỉ được dùng codes này
- Bước cuối (`is_last_step=True`): `next_step_preview` = "Bạn đã hoàn thành toàn bộ 6 bước"

---

## 4. Bộ test — kết quả & nhận xét

**Chạy:**
```bash
python -m src.backend.agents.test_runner --suite sem|gate|fail|pipe|all
```

---

### Suite SEM — Semantic Equivalence (6 tests)

**Mục đích:** Kiểm tra model chấm theo nghĩa, không anchor vào keyword.
Mỗi test dùng câu trả lời đúng nội dung nhưng tránh hoàn toàn medical jargon.

| Test | Bước | Tránh keyword | Kết quả |
|---|---|---|---|
| SEM-1 | OBSERVE | `mờ đục`, `mediastinal shift` | ✓ PASS (score=1.00) |
| SEM-2 | DESCRIBE | `meniscus sign` | ✓ PASS (score=0.75) |
| SEM-3 | INTERPRET | `pleural effusion` | ✓ PASS (score=0.71) |
| SEM-4 | HYPOTHESIS | `malignant` | ✓ PASS (score=0.86) |
| SEM-5 | DDx | `Light's criteria` | ✓ PASS (score=0.71) |
| SEM-6 | CONCLUSION | `malignant exudate`, `CECT` | ✓ PASS (score=1.00) |

**Nhận xét:** Model đánh giá ngữ nghĩa tốt — "bên trái tối hơn" được nhận ra tương đương "phổi trái mờ đục", "cong lõm" tương đương "meniscus sign". Sinh viên dùng ngôn ngữ thông thường không bị thiệt thòi.

---

### Suite GATE — Score Gate & Hint Flow (5 tests)

| Test | Mô tả | Kết quả |
|---|---|---|
| GATE-1 | Good answer pass tất cả 6 bước | ✓ PASS |
| GATE-2 | Answer rỗng fail với score < 0.3 | ✓ PASS |
| GATE-3 | Answer sai topic (khối u não ở bước ngực) fail | ✓ PASS |
| GATE-4 | hint_count chỉ tăng SAU KHI hint được generate | ✓ PASS |
| GATE-5 | Score tăng khi thêm thông tin đúng qua nhiều attempt | ✓ PASS |

**Nhận xét:** Cơ chế accumulate hoạt động đúng — attempt sau cộng thêm vào context của attempt trước, không chấm lại từ đầu.

---

### Suite FAIL — Failure Modes (3 tests)

| Test | Mô tả | Kết quả |
|---|---|---|
| LEAK-1 | Hint không chứa diagnosis keyword (`pleural effusion`, `breast cancer`...) | ✓ PASS |
| RUBRIC-1 | INTERPRET: kết luận chẩn đoán sớm bị penalize (score < 0.8) | ✓ PASS |
| RUBRIC-2 | Partial answer → partial score (0.25–0.65) | ✓ PASS (DESCRIBE, DDx) / CONCLUSION = 0.00 (đúng — thiếu 3/4 criteria) |

**Nhận xét RUBRIC-2 CONCLUSION:** Score 0.00 là **đúng behavior** — câu "Tràn dịch màng phổi trái" thiếu 3 trong 4 criteria: không có justification, không có management plan, không có confidence. Đây không phải bug.

---

### Suite PIPE — Full Pipeline (2 tests)

| Test | Mô tả | Kết quả |
|---|---|---|
| PIPE-1 | 6 bước với good answers (medical jargon đầy đủ) | ✓ 6/6 PASS |
| PIPE-2 | 6 bước với semantic alt answers (không dùng jargon) | ✓ 6/6 PASS |

**Nhận xét:** Pipeline hoạt động end-to-end. `previous_steps` được truyền qua đúng — `positive_feedback` ở bước sau có thể tham chiếu câu trả lời bước trước.

---

## 5. Hướng tích hợp Django (state machine + session)

### State machine

Mỗi session là một state machine có các state sau:

```
IDLE → STEP_ACTIVE → STEP_PASSED → STEP_FAILED_ADVANCE → SESSION_COMPLETE
                         ↑
                    (hint loop)
```

Trong Django, state này nên được lưu vào model `Session` hoặc Redis.

### Session model — những field cần lưu

```python
class Session(models.Model):
    id           = UUIDField(primary_key=True)
    case_id      = ForeignKey("Case")
    user         = ForeignKey(User)
    current_step = IntegerField(default=0)          # 0–5
    status       = CharField(choices=["active", "complete"])
    created_at   = DateTimeField(auto_now_add=True)

class StepAttempt(models.Model):
    session      = ForeignKey(Session)
    step_index   = IntegerField()                   # 0–5
    attempt_num  = IntegerField()                   # 1, 2, 3...
    answer_text  = TextField()
    score        = FloatField(null=True)
    passed       = BooleanField(null=True)
    errors       = JSONField(default=list)
    feedback     = TextField(default="")
    hint_count   = IntegerField(default=0)
    created_at   = DateTimeField(auto_now_add=True)
```

### View logic (thay `interactive.py`)

Khi nhận POST `/sessions/{id}/answer`:

```python
def post_answer(request, session_id):
    session = Session.objects.get(id=session_id)
    step_index = session.current_step

    # 1. Classify intent
    classified = socratic.classify_and_respond(
        user_input=request.data["answer"],
        step_name=STEPS[step_index],
        step_index=step_index,
        current_question=get_current_question(session),
    )

    if classified["intent"] in ("question", "chit-chat"):
        return Response({"type": "socratic", "message": classified["response"]})

    # 2. Build context từ DB
    previous_steps = build_previous_steps(session)    # query StepAttempt của các step đã pass
    step_attempts  = get_step_attempts(session, step_index)  # query attempts bước hiện tại

    # 3. Evaluate
    result = answer_check.evaluate(
        student_answer=request.data["answer"],
        step_code=STEPS[step_index],
        step_index=step_index,
        rubric=get_rubric(session.case_id, step_index),
        answer_key=get_answer_key(session.case_id, step_index),   # chỉ server mới có
        cv_findings=get_cv_findings(session.case_id),
        previous_steps=previous_steps,
        step_attempts=step_attempts,
        is_last_step=(step_index == 5),
    )

    # 4. Ghi StepAttempt
    StepAttempt.objects.create(
        session=session, step_index=step_index,
        attempt_num=len(step_attempts) + 1,
        answer_text=request.data["answer"],
        score=result["score"], passed=result["passed"],
        errors=result["errors"], feedback=result["feedback"],
        hint_count=get_hint_count(session, step_index),
    )

    # 5. Xử lý kết quả
    if result["passed"]:
        session.current_step += 1
        session.save()
        return Response({"type": "pass", "result": result})

    hint_count = get_hint_count(session, step_index)
    if hint_count >= 3:
        session.current_step += 1
        session.save()
        return Response({"type": "force_advance", "result": result})

    hint = socratic.get_hint(
        step_name=STEPS[step_index],
        step_index=step_index,
        errors=result["errors"],
        hint_count=hint_count + 1,
        step_attempts=[a.answer_text for a in step_attempts],
    )
    increment_hint_count(session, step_index)
    return Response({"type": "hint", "message": hint})
```

### Lưu ý bảo mật

- `answer_key` (ground_truth) **không được trả về client** — chỉ dùng server-side trong `evaluate()`
- `cv_findings` cũng nên ở server — client chỉ nhận câu hỏi và feedback
- Sau khi session complete mới có thể expose `expected_finding` cho sinh viên xem

### Thay Redis mock

Hiện tại `interactive.py` dùng biến local (`hint_count`, `step_attempts`) thay cho Redis.
Khi có DB, thay bằng query `StepAttempt` như ở trên — không cần Redis cho MVP.

---

## 6. Quy ước data — rubric & ground_truth

### ground_truth.json

**Cấu trúc bắt buộc:**
```json
{
  "OBSERVE":    { "expected_finding": "..." },
  "DESCRIBE":   { "expected_finding": "..." },
  "INTERPRET":  { "expected_finding": "..." },
  "HYPOTHESIS": { "expected_finding": "..." },
  "DDx":        { "expected_finding": "..." },
  "CONCLUSION": { "expected_finding": "..." }
}
```

> Chỉ giữ `expected_finding`. Không dùng `key_points[]` — Answer-Check Agent không cần và sẽ bị confused.

### rubric.json — cấu trúc và error codes

Mỗi bước phải có đủ các field sau:

```json
{
  "STEP_NAME": {
    "question": "...",
    "criteria": [
      { "label": "...", "max_score": <int>, "error_code": "<snake_case>" }
    ],
    "total_max": <int>,
    "pass_threshold": <int>,
    "scoring_guide": "...",
    "pass_score": 0.6
  }
}
```

**`error_code` là bắt buộc** — Answer-Check Agent inject danh sách này vào prompt để LLM chỉ được dùng codes đã định nghĩa. Nếu thiếu `error_code`, errors trả về sẽ là random string.

### Error codes hiện tại (case mock tràn dịch màng phổi)

| Bước | error_code | Ý nghĩa |
|---|---|---|
| OBSERVE | `incomplete_scan` | Không quét đủ các vùng |
| OBSERVE | `missed_main_finding` | Bỏ qua dấu hiệu chính |
| OBSERVE | `missing_film_quality_comment` | Không nhận xét chất lượng phim |
| DESCRIBE | `missing_location` | Không nêu vị trí |
| DESCRIBE | `missing_density` | Không mô tả độ đậm/mờ |
| DESCRIBE | `missing_margin` | Không mô tả bờ |
| DESCRIBE | `missing_size` | Không ước lượng kích thước |
| DESCRIBE | `missing_associated_findings` | Không đề cập findings kèm theo |
| INTERPRET | `missing_pathological_interpretation` | Không giải thích ý nghĩa bệnh lý |
| INTERPRET | `missing_pathophysiology_link` | Không kết nối cơ chế bệnh sinh |
| INTERPRET | `premature_diagnosis` | Kết luận chẩn đoán quá sớm |
| HYPOTHESIS | `missing_primary_diagnosis` | Không đưa ra chẩn đoán chính |
| HYPOTHESIS | `insufficient_evidence_cited` | Không dẫn chứng findings |
| HYPOTHESIS | `missing_clinical_integration` | Không tích hợp thông tin lâm sàng |
| DDx | `insufficient_ddx_count` | Ít hơn 2 chẩn đoán phân biệt |
| DDx | `missing_ddx_reasoning` | Không lập luận giữ/loại từng diagnosis |
| DDx | `missing_dangerous_dx` | Thiếu ít nhất 1 bệnh nguy hiểm must-not-miss |
| CONCLUSION | `missing_final_diagnosis` | Không có chẩn đoán cuối rõ ràng |
| CONCLUSION | `missing_diagnosis_justification` | Không giải thích tại sao chọn chẩn đoán này |
| CONCLUSION | `missing_management_plan` | Không gợi ý bước xử trí tiếp theo |

### Nguyên tắc khi viết rubric cho case mới

1. **`expected_finding` phải cover đủ criteria trong rubric** — nếu rubric DESCRIBE có 5 criteria thì `expected_finding` phải đề cập đủ 5 điểm. Thiếu sẽ khiến good answer bị chấm sai.

2. **`error_code` phải là snake_case, unique trong toàn bộ file** — tránh trùng giữa các bước.

3. **`scoring_guide` viết bằng tiếng Anh** — LLM nhận tốt hơn khi mixing Vietnamese label + English guide.

4. **`pass_score` luôn là `0.6`** — ngưỡng này được enforce bởi code (`score >= 0.6`), không phải LLM. Không thay đổi trừ khi có lý do đặc biệt.

5. **Không đặt `total_max` quá cao** — LLM không đếm điểm tuyệt đối mà chấm tỉ lệ. `total_max` chỉ dùng để tham khảo trọng số, không ảnh hưởng score thực tế.

6. **Khi thêm case từ VLM:** Output của VLM sẽ là `cv_findings.json` và `ground_truth.json`. Kiểm tra `expected_finding` có khớp với rubric criteria không trước khi deploy.

---

*Cập nhật lần cuối: 2026-04-21 — Khohk*
