export const STEPS = ['OBSERVE', 'REASONING', 'DDx', 'CONCLUSION'] as const;

export type StepCode = typeof STEPS[number];

export const STEP_LABELS: Record<StepCode, string> = {
  OBSERVE: 'Quan sát',
  REASONING: 'Lý luận',
  DDx: 'Phân biệt',
  CONCLUSION: 'Kết luận',
};
