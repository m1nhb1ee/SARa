create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  full_name   text,
  role        text not null default 'student'
                check (role in ('student', 'admin', 'medical_advisor')),
  created_at  timestamptz default now()
);