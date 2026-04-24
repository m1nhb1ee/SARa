-- Storage RLS policies for case_images bucket
-- Bucket được tạo public=true nhưng cần explicit policies cho write operations

-- 1. Public read: ai cũng đọc được (bucket là public)
create policy "case_images: public read"
  on storage.objects for select
  using (bucket_id = 'case_images');

-- 2. Authenticated upload: backend (service role) và user đã đăng nhập đều upload được
create policy "case_images: authenticated insert"
  on storage.objects for insert
  with check (
    bucket_id = 'case_images'
    AND auth.role() IN ('authenticated', 'service_role')
  );

-- 3. Service role có thể update/delete (admin cleanup)
create policy "case_images: service role manage"
  on storage.objects for all
  using (
    bucket_id = 'case_images'
    AND auth.role() = 'service_role'
  )
  with check (
    bucket_id = 'case_images'
    AND auth.role() = 'service_role'
  );
