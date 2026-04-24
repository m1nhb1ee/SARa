export type Difficulty = 'Cơ bản' | 'Trung bình' | 'Nặng cao';
export type Modality = 'X-Ray' | 'CT' | 'MRI';
export type SessionStatus = 'Chưa làm' | 'Đang làm' | 'Hoàn thành';

export const difficultyStyle: Record<Difficulty, { bg: string; color: string }> = {
  'Cơ bản':     { bg: 'rgba(125,155,118,0.18)', color: '#7D9B76' },
  'Trung bình': { bg: 'rgba(201,136,42,0.18)',  color: '#C9882A' },
  'Nặng cao':   { bg: 'rgba(192,57,43,0.18)',   color: '#C0392B' },
};

export const modalityStyle: Record<Modality, { bg: string; color: string }> = {
  'X-Ray': { bg: 'rgba(27,58,92,0.18)',   color: '#1B3A5C' },
  'CT':    { bg: 'rgba(125,155,118,0.18)', color: '#7D9B76' },
  'MRI':   { bg: 'rgba(139,99,85,0.18)',  color: '#8B6355' },
};

export const scoreColor = (score: number): string =>
  score >= 0.85 ? '#7D9B76' : score >= 0.6 ? '#C9882A' : '#C0392B';

export const scoreLabel = (score: number): string =>
  score >= 0.85 ? 'Xuất sắc' : score >= 0.7 ? 'Tốt' : score >= 0.6 ? 'Đạt' : 'Chưa đạt';

export const filterButtonStyle = (active: boolean) => ({
  padding: '5px 14px',
  borderRadius: 2,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'Special Elite', cursive",
  letterSpacing: '0.05em',
  border: active ? '1px solid #C0392B' : '1px solid #C4A882',
  backgroundColor: active ? 'rgba(192,57,43,0.1)' : 'transparent',
  color: active ? '#C0392B' : '#6B4C3B',
  cursor: 'pointer' as const,
  transition: 'all 0.15s',
});
