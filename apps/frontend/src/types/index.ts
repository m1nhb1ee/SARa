import type { Difficulty, Modality, SessionStatus } from '@/constants/styles';

export type { Difficulty, Modality, SessionStatus };

export interface CaseItem {
  id: string;
  title: string;
  modality: Modality;
  difficulty: Difficulty;
  hint: string;
  status: SessionStatus;
  imageKey: string;
}

export interface StepAttempt {
  step_index: number;
  step_code: string;
  student_answer: string;
  score: number | null;
  feedback: string | null;
  attempt_number: number;
}

export interface FeedbackResult {
  score: number;
  passed: boolean;
  feedback: string;
  errors: string[];
  hint?: string;
  next_step?: number;
  session_complete?: boolean;
  attempt?: StepAttempt;
}

export interface CaseSlice {
  image_url: string;
  slice_index: number;
}

export interface CaseVolume {
  volume_name: string;
  slices: CaseSlice[];
}
