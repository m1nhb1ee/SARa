create table user_skill_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references users(id) on delete cascade,
  step_accuracy     jsonb not null default '{}',
  modality_accuracy jsonb not null default '{}',
  tag_error_rates   jsonb not null default '{}',
  total_cases_done  int not null default 0,
  streak_days       int not null default 0,
  updated_at        timestamptz default now()
);

create table case_recommendations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  case_id          uuid not null references cases(id) on delete cascade,
  reason_code      text not null
                     check (reason_code in ('WEAK_STEP','WEAK_TAG','NEW_MODALITY','STREAK')),
  weak_step        text,
  weak_tag         text,
  relevance_score  float not null default 0.0,
  was_accepted     boolean not null default false,
  recommended_at   timestamptz default now()
);