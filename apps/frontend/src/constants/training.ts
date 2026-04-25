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
