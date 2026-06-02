-- Add user_name, dob, university to users table
alter table public.users
  add column if not exists user_name text,
  add column if not exists dob date,
  add column if not exists university text;

create unique index if not exists users_user_name_key on public.users (lower(user_name)) where user_name is not null;
