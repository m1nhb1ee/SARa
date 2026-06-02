create table swap_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  case_id          uuid not null references cases(id) on delete cascade,
  current_step     int not null default 0 check (current_step between 0 and 3),
  status           text not null default 'IN_PROGRESS'
                     check (status in ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
  doctor_diagnosis jsonb not null default '{}',
  raw_vlm_output   text not null default '',
  final_score      float,
  started_at       timestamptz default now(),
  completed_at     timestamptz
);

create table swap_messages (
  id              uuid primary key default gen_random_uuid(),
  swap_session_id uuid not null references swap_sessions(id) on delete cascade,
  role            text not null check (role in ('user', 'doctor', 'system')),
  step_index      int not null check (step_index between 0 and 3),
  content         text not null,
  metadata        jsonb not null default '{}',
  created_at      timestamptz default now()
);

create table swap_step_scores (
  id               uuid primary key default gen_random_uuid(),
  swap_session_id  uuid not null references swap_sessions(id) on delete cascade,
  step_index       int not null check (step_index between 0 and 3),
  step_code        text not null check (step_code in ('OBSERVE','REASONING','DDx','CONCLUSION')),
  persuasion_score float not null check (persuasion_score between 0 and 1),
  convinced        boolean not null default false,
  reasoning        text not null default '',
  created_at       timestamptz default now(),
  unique (swap_session_id, step_index)
);

create index on swap_sessions (user_id);
create index on swap_sessions (case_id);
create index on swap_messages (swap_session_id, created_at);
create index on swap_step_scores (swap_session_id, step_index);
