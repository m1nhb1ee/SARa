export const STEPS = ['DESCRIBE', 'REASONING', 'DDx', 'CONCLUSION'] as const;

export type StepCode = typeof STEPS[number];

export const STEP_LABELS: Record<StepCode, string> = {
  DESCRIBE: 'Quan sát',
  REASONING: 'Lý luận',
  DDx: 'Phân biệt',
  CONCLUSION: 'Kết luận',
};
