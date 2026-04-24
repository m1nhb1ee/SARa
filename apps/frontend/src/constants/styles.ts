export type Difficulty = 'Cơ bản' | 'Trung bình' | 'Nặng cao';
export type Modality = 'X-Ray' | 'CT' | 'MRI';
export type SessionStatus = 'Chưa làm' | 'Đang làm' | 'Hoàn thành';

export const difficultyStyle: Record<Difficulty, { bg: string; color: string }> = {
  'Cơ bản': { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
  'Trung bình': { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' },
  'Nặng cao': { bg: 'color-mix(in srgb, var(--error) 15%, transparent)', color: 'var(--error)' },
};

export const modalityStyle: Record<Modality, { bg: string; color: string }> = {
  'X-Ray': { bg: 'color-mix(in srgb, var(--info) 15%, transparent)', color: 'var(--info)' },
  'CT': { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
  'MRI': { bg: 'color-mix(in srgb, var(--emphasis) 15%, transparent)', color: 'var(--emphasis)' },
};

export const scoreColor = (score: number): string =>
  score >= 0.85 ? 'var(--success)' : score >= 0.6 ? 'var(--warning)' : 'var(--error)';

export const scoreLabel = (score: number): string =>
  score >= 0.85 ? 'Xuất sắc' : score >= 0.7 ? 'Tốt' : score >= 0.6 ? 'Đạt' : 'Chưa đạt';

export const filterButtonStyle = (active: boolean) => ({
  padding: '5px 12px',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  border: active ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
  backgroundColor: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-sec)',
  cursor: 'pointer' as const,
  transition: 'all 0.2s',
});
