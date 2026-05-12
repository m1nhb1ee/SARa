-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.answer_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  step_order integer NOT NULL CHECK (step_order >= 0 AND step_order <= 3),
  step_code text NOT NULL CHECK (step_code = ANY (ARRAY['DESCRIBE'::text, 'REASONING'::text, 'DDx'::text, 'CONCLUSION'::text])),
  expected_finding text NOT NULL,
  clinical_explanation text NOT NULL,
  key_points ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT answer_keys_pkey PRIMARY KEY (id),
  CONSTRAINT answer_keys_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.case_images (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  case_id uuid NOT NULL,
  image_url text NOT NULL,
  slice_index integer,
  created_at timestamp with time zone DEFAULT now(),
  volume_name text NOT NULL DEFAULT 'Default'::text,
  CONSTRAINT case_images_pkey PRIMARY KEY (id),
  CONSTRAINT case_images_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.case_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL,
  reason_code text NOT NULL CHECK (reason_code = ANY (ARRAY['WEAK_STEP'::text, 'WEAK_TAG'::text, 'NEW_MODALITY'::text, 'STREAK'::text])),
  weak_step text,
  weak_tag text,
  relevance_score double precision NOT NULL DEFAULT 0.0,
  was_accepted boolean NOT NULL DEFAULT false,
  recommended_at timestamp with time zone DEFAULT now(),
  CONSTRAINT case_recommendations_pkey PRIMARY KEY (id),
  CONSTRAINT case_recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT case_recommendations_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  uploaded_by uuid,
  title text NOT NULL,
  modality text NOT NULL CHECK (modality = ANY (ARRAY['X-ray'::text, 'CT'::text, 'MRI'::text, 'Ultrasound'::text])),
  difficulty text NOT NULL DEFAULT 'medium'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])),
  clinical_history text NOT NULL,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  disease_tag text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text])),
  created_at timestamp with time zone DEFAULT now(),
  source text NOT NULL DEFAULT 'system'::text CHECK (source = ANY (ARRAY['system'::text, 'uploaded'::text])),
  is_valid boolean DEFAULT true,
  CONSTRAINT cases_pkey PRIMARY KEY (id),
  CONSTRAINT cases_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id),
  CONSTRAINT cases_disease_tag_fkey FOREIGN KEY (disease_tag) REFERENCES public.disease_profiles(disease_tag)
);
CREATE TABLE public.disease_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  disease_tag text NOT NULL UNIQUE,
  expected_findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  common_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ddx_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  clinical_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT disease_profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pipeline_replays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  step_order integer NOT NULL CHECK (step_order >= 0 AND step_order <= 3),
  step_code text NOT NULL,
  student_best_answer text NOT NULL,
  step_score double precision NOT NULL,
  answer_key_text text NOT NULL,
  clinical_explanation text NOT NULL,
  diff_highlights jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_replays_pkey PRIMARY KEY (id),
  CONSTRAINT pipeline_replays_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0 AND current_step <= 3),
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text CHECK (status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text, 'ABANDONED'::text])),
  final_score double precision,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT sessions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.step_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  rubric_criterion_id uuid,
  step_index integer NOT NULL CHECK (step_index >= 0 AND step_index <= 3),
  step_code text NOT NULL,
  student_answer text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0::double precision AND score <= 1::double precision),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  latency_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT step_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT step_attempts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT step_attempts_rubric_criterion_id_fkey FOREIGN KEY (rubric_criterion_id) REFERENCES public.step_rubrics(id)
);
CREATE TABLE public.step_rubrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  step_code text NOT NULL CHECK (step_code = ANY (ARRAY['DESCRIBE'::text, 'REASONING'::text, 'DDx'::text, 'CONCLUSION'::text])),
  criterion_label text NOT NULL,
  scoring_guide text NOT NULL,
  example_good_answer text,
  max_score double precision NOT NULL DEFAULT 1.0,
  error_code text,
  question text,
  pass_score double precision DEFAULT 0.6,
  CONSTRAINT step_rubrics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.swap_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  swap_session_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'doctor'::text, 'system'::text])),
  step_index integer NOT NULL CHECK (step_index >= 0 AND step_index <= 3),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT swap_messages_pkey PRIMARY KEY (id),
  CONSTRAINT swap_messages_swap_session_id_fkey FOREIGN KEY (swap_session_id) REFERENCES public.swap_sessions(id)
);
CREATE TABLE public.swap_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0 AND current_step <= 3),
  status text NOT NULL DEFAULT 'IN_PROGRESS'::text CHECK (status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text, 'ABANDONED'::text])),
  doctor_diagnosis jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_vlm_output text NOT NULL DEFAULT ''::text,
  final_score double precision,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT swap_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT swap_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT swap_sessions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.swap_step_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  swap_session_id uuid NOT NULL,
  step_index integer NOT NULL CHECK (step_index >= 0 AND step_index <= 3),
  step_code text NOT NULL CHECK (step_code = ANY (ARRAY['DESCRIBE'::text, 'REASONING'::text, 'DDx'::text, 'CONCLUSION'::text])),
  persuasion_score double precision NOT NULL CHECK (persuasion_score >= 0::double precision AND persuasion_score <= 1::double precision),
  convinced boolean NOT NULL DEFAULT false,
  reasoning text NOT NULL DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT swap_step_scores_pkey PRIMARY KEY (id),
  CONSTRAINT swap_step_scores_swap_session_id_fkey FOREIGN KEY (swap_session_id) REFERENCES public.swap_sessions(id)
);
CREATE TABLE public.upload_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  upload_session_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT upload_messages_pkey PRIMARY KEY (id),
  CONSTRAINT upload_messages_upload_session_id_fkey FOREIGN KEY (upload_session_id) REFERENCES public.upload_sessions(id)
);
CREATE TABLE public.upload_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  modality text,
  created_at timestamp with time zone DEFAULT now(),
  case_id uuid,
  CONSTRAINT upload_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT upload_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT upload_sessions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  role text NOT NULL DEFAULT 'student'::text CHECK (role = ANY (ARRAY['student'::text, 'admin'::text, 'medical_advisor'::text])),
  created_at timestamp with time zone DEFAULT now(),
  dob date,
  is_premium boolean DEFAULT false,
  user_name text UNIQUE,
  university text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

