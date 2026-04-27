alter table case_images enable row level security;

-- Public read for images belonging to published cases
create policy "case_images: public read"
  on case_images for select
  using (
    case_id in (select id from cases where status = 'published')
  );

-- Owner can insert images for their own cases
create policy "case_images: owner insert"
  on case_images for insert
  with check (
    case_id in (select id from cases where uploaded_by = auth.uid())
  );

-- Owner can delete images for their own cases
create policy "case_images: owner delete"
  on case_images for delete
  using (
    case_id in (select id from cases where uploaded_by = auth.uid())
  );

-- Service role can manage all (bypasses RLS automatically, but explicit for clarity)
create policy "case_images: service role manage"
  on case_images for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
