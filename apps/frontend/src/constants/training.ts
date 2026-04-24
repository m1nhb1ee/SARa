export const STEPS = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION'] as const;

export type StepCode = typeof STEPS[number];

export const STEP_LABELS: Record<StepCode, string> = {
  OBSERVE: 'Quan sát',
  DESCRIBE: 'Mô tả',
  INTERPRET: 'Diễn giải',
  HYPOTHESIS: 'Giả thuyết',
  DDx: 'Phân biệt',
  CONCLUSION: 'Kết luận',
};

export const STEP_PROMPTS: Record<StepCode, string> = {
  OBSERVE: 'Quan sát tổng thể hình ảnh. Mô tả những gì bạn thấy một cách có hệ thống.',
  DESCRIBE: 'Mô tả chi tiết các phát hiện: vị trí, kích thước, hình dạng, mật độ, bờ viền.',
  INTERPRET: 'Diễn giải ý nghĩa lâm sàng của các phát hiện. Liên hệ với sinh lý bệnh.',
  HYPOTHESIS: 'Đề xuất chẩn đoán chính dựa trên tổng hợp các phát hiện.',
  DDx: 'Liệt kê các chẩn đoán phân biệt quan trọng cần loại trừ.',
  CONCLUSION: 'Kết luận chẩn đoán cuối cùng và đề xuất hướng xử trí tiếp theo.',
};
