create table upload_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  image_url   text not null,
  modality    text,
  created_at  timestamptz default now()
);

create table upload_messages (
  id                uuid primary key default gen_random_uuid(),
  upload_session_id uuid not null references upload_sessions(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  created_at        timestamptz default now()
);