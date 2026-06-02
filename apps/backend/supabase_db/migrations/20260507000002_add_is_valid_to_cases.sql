alter table cases
  add column if not exists is_valid boolean not null default true;

create index if not exists cases_is_valid_idx on cases (is_valid);
