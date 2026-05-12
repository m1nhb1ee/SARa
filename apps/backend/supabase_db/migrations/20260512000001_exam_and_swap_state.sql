alter table cases
  add column if not exists is_exam boolean not null default false;

create index if not exists cases_is_exam_idx on cases (is_exam);

create table if not exists swap_step_states (
  id uuid primary key default gen_random_uuid(),
  swap_session_id uuid not null references swap_sessions(id) on delete cascade,
  step_index int not null check (step_index between 0 and 3),
  step_code text not null check (step_code in ('DESCRIBE','REASONING','DDx','CONCLUSION')),
  phase text not null default 'DEBATING'
    check (phase in ('DEBATING','AWAITING_CONFIRMATION','CONFIRMED')),
  convinced boolean not null default false,
  pending_summary text,
  agreed_answer text,
  debate_score float check (debate_score between 0 and 1),
  knowledge_score float check (knowledge_score between 0 and 1),
  reasoning text not null default '',
  updated_at timestamptz default now(),
  unique (swap_session_id, step_index)
);

create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  current_step int not null default 0 check (current_step between 0 and 3),
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS','COMPLETED','ABANDONED','EXPIRED')),
  final_score float check (final_score is null or final_score between 0 and 1),
  started_at timestamptz default now(),
  completed_at timestamptz
);

create or replace function ensure_exam_session_case()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from cases
    where id = new.case_id
      and is_exam = true
  ) then
    raise exception 'exam_sessions.case_id must reference a case with is_exam=true';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_sessions_case_is_exam on exam_sessions;
create trigger exam_sessions_case_is_exam
before insert or update of case_id on exam_sessions
for each row execute function ensure_exam_session_case();

create table if not exists exam_step_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_session_id uuid not null references exam_sessions(id) on delete cascade,
  step_index int not null check (step_index between 0 and 3),
  step_code text not null check (step_code in ('DESCRIBE','REASONING','DDx','CONCLUSION')),
  answer text not null default '',
  submitted_at timestamptz,
  time_spent_seconds int not null default 0 check (time_spent_seconds between 0 and 300),
  time_limit_seconds int not null default 300 check (time_limit_seconds = 300),
  locked boolean not null default false,
  score float check (score is null or score between 0 and 1),
  feedback text,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (exam_session_id, step_index)
);

create index if not exists swap_step_states_session_idx on swap_step_states (swap_session_id, step_index);
create index if not exists exam_sessions_user_idx on exam_sessions (user_id, status, started_at desc);
create index if not exists exam_sessions_case_idx on exam_sessions (case_id);
create index if not exists exam_step_attempts_session_idx on exam_step_attempts (exam_session_id, step_index);

alter table swap_step_states enable row level security;
alter table exam_sessions enable row level security;
alter table exam_step_attempts enable row level security;

create policy "swap_step_states: own rows" on swap_step_states
  for all using (
    swap_session_id in (select id from swap_sessions where user_id = auth.uid())
  )
  with check (
    swap_session_id in (select id from swap_sessions where user_id = auth.uid())
  );

create policy "swap_step_states: service role manage" on swap_step_states
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "exam_sessions: own rows" on exam_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "exam_sessions: service role manage" on exam_sessions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "exam_step_attempts: own rows" on exam_step_attempts
  for all using (
    exam_session_id in (select id from exam_sessions where user_id = auth.uid())
  )
  with check (
    exam_session_id in (select id from exam_sessions where user_id = auth.uid())
  );

create policy "exam_step_attempts: service role manage" on exam_step_attempts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
