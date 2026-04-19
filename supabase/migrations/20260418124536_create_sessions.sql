create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  case_id       uuid not null references cases(id) on delete cascade,
  current_step  int not null default 0 check (current_step between 0 and 5),
  status        text not null default 'IN_PROGRESS'
                  check (status in ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
  final_score   float,
  started_at    timestamptz default now(),
  completed_at  timestamptz
);

create table step_attempts (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references sessions(id) on delete cascade,
  rubric_criterion_id  uuid not null references step_rubrics(id) on delete restrict,
  step_index           int not null check (step_index between 0 and 4),
  step_code            text not null,
  student_answer       text not null,
  score                float not null check (score between 0 and 1),
  errors               jsonb not null default '[]',
  feedback             text not null,
  attempt_number       int not null default 1,
  latency_ms           int,
  created_at           timestamptz default now()
);

create table pipeline_replays (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references sessions(id) on delete cascade,
  step_order           int not null check (step_order between 0 and 4),
  step_code            text not null,
  student_best_answer  text not null,
  step_score           float not null,
  answer_key_text      text not null,
  clinical_explanation text not null,
  diff_highlights      jsonb not null default '{}',
  created_at           timestamptz default now(),
  unique (session_id, step_order)
);