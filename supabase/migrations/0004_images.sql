-- Aevin: pictures you send him. Stored privately; each user can only touch their own folder.

alter table public.messages add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aevin-images', 'aevin-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'aevin-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "images: read own" on storage.objects for select to authenticated
  using (bucket_id = 'aevin-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'aevin-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
