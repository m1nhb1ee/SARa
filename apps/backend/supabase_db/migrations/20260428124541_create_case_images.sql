create table case_images (
    id           uuid primary key default uuid_generate_v4(),
    case_id      uuid not null references cases(id) on delete cascade,
    image_url    text not null,
    slice_index  int,
    created_at   timestamptz default now()
);

create index on case_images (case_id);
