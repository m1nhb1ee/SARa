-- Migrate step_rubrics to multi-criteria layout:
--   • Rename first graded step OBSERVE → DESCRIBE
--   • Add error_code, question, pass_score columns
--   • Drop UNIQUE constraint on step_code (each step now has N criteria rows)
--   • Re-seed with 13 criteria rows (error codes for answer-check agent)
--   • Make step_attempts.rubric_criterion_id nullable

-- ── 1. Add new columns to step_rubrics ───────────────────────────────────────

alter table step_rubrics
  add column if not exists error_code  text,
  add column if not exists question    text,
  add column if not exists pass_score  float not null default 0.6;

-- ── 2. Drop constraints that block the schema change ─────────────────────────

alter table step_rubrics
  drop constraint if exists step_rubrics_step_code_check;

alter table step_rubrics
  drop constraint if exists step_rubrics_step_code_key;

-- ── 3. Clear dependent data before re-seeding ────────────────────────────────

-- step_attempts.rubric_criterion_id references step_rubrics — clear old attempts
delete from step_attempts;

delete from step_rubrics;

-- ── 4. Re-seed step_rubrics with multi-criteria rows ─────────────────────────
-- Each step gets one row per scoring criterion.
-- The question column is the same for all rows of the same step (the agent
-- picks it from the first row it encounters via _get_rubric()).

insert into step_rubrics (step_code, question, criterion_label, error_code, max_score, pass_score, scoring_guide) values

-- DESCRIBE (step index 0)
('DESCRIBE',
 'Mô tả chi tiết những gì bạn thấy — vị trí, kích thước, mật độ/tín hiệu, bờ viền, bên nào bị ảnh hưởng và các dấu hiệu kèm theo.',
 'Xác định vị trí tổn thương',
 'missing_location',
 0.25, 0.6,
 'Học viên xác định chính xác vùng/cơ quan bị ảnh hưởng, bao gồm bên (phải/trái), thùy, hoặc phân đoạn.'),

('DESCRIBE',
 'Mô tả chi tiết những gì bạn thấy — vị trí, kích thước, mật độ/tín hiệu, bờ viền, bên nào bị ảnh hưởng và các dấu hiệu kèm theo.',
 'Mô tả kích thước/mức độ tổn thương',
 'missing_size',
 0.25, 0.6,
 'Học viên ước lượng kích thước (nếu rõ ràng) hoặc mô tả mức độ tổn thương (khu trú, lan tỏa, đa ổ...).'),

('DESCRIBE',
 'Mô tả chi tiết những gì bạn thấy — vị trí, kích thước, mật độ/tín hiệu, bờ viền, bên nào bị ảnh hưởng và các dấu hiệu kèm theo.',
 'Mô tả đặc điểm hình ảnh (mật độ/tín hiệu)',
 'missing_imaging_characteristics',
 0.25, 0.6,
 'Học viên mô tả đặc trưng hình ảnh phù hợp với phương thức chụp: mật độ trên CT, cường độ tín hiệu trên MRI, hoặc siêu âm.'),

('DESCRIBE',
 'Mô tả chi tiết những gì bạn thấy — vị trí, kích thước, mật độ/tín hiệu, bờ viền, bên nào bị ảnh hưởng và các dấu hiệu kèm theo.',
 'Mô tả bờ viền và dấu hiệu liên quan',
 'missing_margins',
 0.25, 0.6,
 'Học viên mô tả bờ (rõ/không rõ, đều/không đều, gai...) và các dấu hiệu kèm theo (phù nề, xẹp...).'),

-- REASONING (step index 1)
('REASONING',
 'Dựa trên các dấu hiệu bạn đã mô tả và thông tin lâm sàng, hãy giải thích ý nghĩa lâm sàng và đề xuất giả thuyết chẩn đoán.',
 'Liên kết hình ảnh với sinh lý bệnh',
 'missing_pathophysiology',
 0.34, 0.6,
 'Học viên giải thích tại sao hình ảnh bất thường lại xuất hiện — cơ chế sinh lý bệnh lý nào tạo ra dấu hiệu đó.'),

('REASONING',
 'Dựa trên các dấu hiệu bạn đã mô tả và thông tin lâm sàng, hãy giải thích ý nghĩa lâm sàng và đề xuất giả thuyết chẩn đoán.',
 'Đề xuất giả thuyết chẩn đoán làm việc',
 'missing_working_diagnosis',
 0.33, 0.6,
 'Học viên đề xuất một chẩn đoán làm việc cụ thể có lập luận dựa trên các dấu hiệu hình ảnh.'),

('REASONING',
 'Dựa trên các dấu hiệu bạn đã mô tả và thông tin lâm sàng, hãy giải thích ý nghĩa lâm sàng và đề xuất giả thuyết chẩn đoán.',
 'Tích hợp thông tin lâm sàng',
 'missing_clinical_correlation',
 0.33, 0.6,
 'Học viên kết hợp thông tin lâm sàng (tiền sử, triệu chứng) với dấu hiệu hình ảnh để củng cố lập luận.'),

-- DDx (step index 2)
('DDx',
 'Ngoài giả thuyết chính, hãy liệt kê các chẩn đoán phân biệt có thể xảy ra và lý do tại sao mỗi chẩn đoán có hoặc không có khả năng.',
 'Liệt kê đủ số lượng chẩn đoán phân biệt',
 'missing_ddx_count',
 0.34, 0.6,
 'Học viên liệt kê ít nhất 2-3 chẩn đoán phân biệt phù hợp.'),

('DDx',
 'Ngoài giả thuyết chính, hãy liệt kê các chẩn đoán phân biệt có thể xảy ra và lý do tại sao mỗi chẩn đoán có hoặc không có khả năng.',
 'Lập luận cho từng chẩn đoán phân biệt',
 'missing_ddx_justification',
 0.33, 0.6,
 'Học viên cung cấp lý do ngắn gọn cho từng chẩn đoán dựa trên dấu hiệu hình ảnh.'),

('DDx',
 'Ngoài giả thuyết chính, hãy liệt kê các chẩn đoán phân biệt có thể xảy ra và lý do tại sao mỗi chẩn đoán có hoặc không có khả năng.',
 'Sắp xếp chẩn đoán theo mức độ khả năng',
 'missing_ddx_ranking',
 0.33, 0.6,
 'Học viên xếp hạng các chẩn đoán phân biệt từ khả năng nhất đến ít khả năng nhất.'),

-- CONCLUSION (step index 3)
('CONCLUSION',
 'Dựa trên toàn bộ phân tích, hãy đưa ra kết luận chẩn đoán cuối cùng và đề xuất hướng xử trí tiếp theo.',
 'Chẩn đoán cuối cùng rõ ràng',
 'missing_final_diagnosis',
 0.34, 0.6,
 'Học viên nêu chẩn đoán xác định hoặc khả năng nhất với mức độ tự tin.'),

('CONCLUSION',
 'Dựa trên toàn bộ phân tích, hãy đưa ra kết luận chẩn đoán cuối cùng và đề xuất hướng xử trí tiếp theo.',
 'Đề xuất bước xử trí tiếp theo',
 'missing_next_steps',
 0.33, 0.6,
 'Học viên đề xuất hướng xử trí phù hợp: xét nghiệm thêm, chẩn đoán hình ảnh bổ sung, hoặc điều trị.'),

('CONCLUSION',
 'Dựa trên toàn bộ phân tích, hãy đưa ra kết luận chẩn đoán cuối cùng và đề xuất hướng xử trí tiếp theo.',
 'Lý giải tổng hợp toàn bộ phân tích',
 'missing_synthesis',
 0.33, 0.6,
 'Học viên liên kết tất cả các bước trước (mô tả → lập luận → chẩn đoán phân biệt) để đi đến kết luận chặt chẽ.');

-- ── 5. Add updated CHECK constraint (DESCRIBE replaces OBSERVE) ──────────────

alter table step_rubrics
  add constraint step_rubrics_step_code_check
    check (step_code in ('DESCRIBE','REASONING','DDx','CONCLUSION'));

-- ── 6. Rename OBSERVE → DESCRIBE in answer_keys ──────────────────────────────

alter table answer_keys
  drop constraint if exists answer_keys_step_code_check;

update answer_keys
  set step_code = 'DESCRIBE', step_order = 0
  where step_code = 'OBSERVE';

alter table answer_keys
  add constraint answer_keys_step_code_check
    check (step_code in ('DESCRIBE','REASONING','DDx','CONCLUSION'));

-- ── 7. Make rubric_criterion_id nullable in step_attempts ────────────────────
-- step_rubrics now has multiple rows per step; the FK is a loose reference only.

alter table step_attempts
  alter column rubric_criterion_id drop not null;
