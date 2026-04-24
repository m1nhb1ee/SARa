insert into storage.buckets (id, name, public)
values ('case_images', 'case_images', true)
on conflict (id) do nothing;