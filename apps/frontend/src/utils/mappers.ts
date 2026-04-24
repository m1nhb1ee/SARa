import type { Difficulty, Modality } from '@/constants/styles';

export const mapModality = (m: string): Modality =>
  ({ XRAY: 'X-Ray', 'X-ray': 'X-Ray', CT: 'CT', MRI: 'MRI' } as Record<string, Modality>)[m] ?? 'X-Ray';

export const mapDifficulty = (d: string): Difficulty =>
  ({ BASIC: 'Cơ bản', easy: 'Cơ bản', INTERMEDIATE: 'Trung bình', medium: 'Trung bình', ADVANCED: 'Nặng cao', hard: 'Nặng cao' } as Record<string, Difficulty>)[d] ?? 'Cơ bản';

export const getImageKey = (m: string): string =>
  ({ XRAY: 'body', 'X-ray': 'body', CT: 'ct', MRI: 'mri' } as Record<string, string>)[m] ?? 'body';

export const apiModalityParam = (label: string): string =>
  ({ 'X-Ray': 'XRAY', CT: 'CT', MRI: 'MRI' } as Record<string, string>)[label] ?? '';

export const apiDifficultyParam = (label: string): string =>
  ({ 'Cơ bản': 'BASIC', 'Trung bình': 'INTERMEDIATE', 'Nặng cao': 'ADVANCED' } as Record<string, string>)[label] ?? '';
