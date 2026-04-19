create table disease_profiles (
  id                  uuid primary key default gen_random_uuid(),
  disease_tag         text unique not null,
  expected_findings   jsonb not null default '{}',
  common_errors       jsonb not null default '[]',
  ddx_list            jsonb not null default '[]',
  clinical_notes      text,
  created_at          timestamptz default now()
);

create table cases (
  id               uuid primary key default gen_random_uuid(),
  uploaded_by      uuid references users(id) on delete set null,
  title            text not null,
  modality         text not null check (modality in ('X-ray', 'CT', 'MRI', 'Ultrasound')),
  difficulty       text not null default 'medium'
                     check (difficulty in ('easy', 'medium', 'hard')),
  clinical_history text not null,
  image_urls       text[] not null default '{}',
  tags             text[] not null default '{}',
  disease_tag      text references disease_profiles(disease_tag) on delete set null,
  status           text not null default 'draft'
                     check (status in ('draft', 'published')),
  created_at       timestamptz default now()
);

create table answer_keys (
  id                   uuid primary key default gen_random_uuid(),
  case_id              uuid not null references cases(id) on delete cascade,
  step_order           int not null check (step_order between 0 and 4),
  step_code            text not null
                         check (step_code in ('OBSERVE','DESCRIBE','INTERPRET','DDx','CONCLUSION')),
  expected_finding     text not null,
  clinical_explanation text not null,
  key_points           text[] not null default '{}',
  unique (case_id, step_order)
);