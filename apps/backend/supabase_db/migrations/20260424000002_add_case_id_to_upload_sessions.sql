alter table upload_sessions
  add column if not exists case_id uuid references cases(id) on delete set null;
