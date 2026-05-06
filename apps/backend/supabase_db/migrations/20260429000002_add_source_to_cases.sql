alter table cases
  add column source text not null default 'system'
  check (source in ('system', 'uploaded'));
