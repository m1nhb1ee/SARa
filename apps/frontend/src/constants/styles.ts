export type Difficulty = 'Cơ bản' | 'Trung bình' | 'Nặng cao';
export type Modality = 'X-Ray' | 'CT' | 'MRI';
export type SessionStatus = 'Chưa làm' | 'Đang làm' | 'Hoàn thành';

export const difficultyStyle: Record<Difficulty, { bg: string; color: string }> = {
  'Cơ bản':     { bg: 'var(--diff-beginner-bg)',     color: 'var(--diff-beginner)' },
  'Trung bình': { bg: 'var(--diff-intermediate-bg)', color: 'var(--diff-intermediate)' },
  'Nặng cao':   { bg: 'var(--diff-advanced-bg)',     color: 'var(--diff-advanced)' },
};

export const modalityStyle: Record<Modality, { bg: string; color: string }> = {
  'X-Ray': { bg: 'var(--mod-xray-bg)', color: 'var(--mod-xray)' },
  'CT':    { bg: 'var(--mod-ct-bg)',   color: 'var(--mod-ct)' },
  'MRI':   { bg: 'var(--mod-mri-bg)',  color: 'var(--mod-mri)' },
};

export const scoreColor = (score: number): string =>
  score >= 0.85 ? 'var(--accent-sage)' : score >= 0.6 ? 'var(--accent-ochre)' : 'var(--accent-clay)';

export const scoreLabel = (score: number): string =>
  score >= 0.85 ? 'Xuất sắc' : score >= 0.7 ? 'Tốt' : score >= 0.6 ? 'Đạt' : 'Chưa đạt';

export const filterButtonStyle = (active: boolean) => ({
  padding: '5px 12px',
  borderRadius: 2,
  fontSize: 11,
  fontFamily: 'var(--font-typewriter)',
  letterSpacing: '0.05em',
  border: active ? '1px solid var(--ink)' : '1px solid var(--border-strong)',
  backgroundColor: active ? 'var(--ink)' : 'transparent',
  color: active ? 'var(--bg-surface-alt)' : 'var(--ink-secondary)',
  cursor: 'pointer' as const,
  transition: 'all 0.15s',
});
