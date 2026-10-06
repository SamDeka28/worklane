-- Optional project logo. Public so project lists can show it without a signed URL.

alter table public.projects
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-logos',
  'project-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_logos_read on storage.objects;
create policy project_logos_read on storage.objects
  for select using (bucket_id = 'project-logos');

drop policy if exists project_logos_insert on storage.objects;
create policy project_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-logos'
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists project_logos_update on storage.objects;
create policy project_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-logos'
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'project-logos'
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists project_logos_delete on storage.objects;
create policy project_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-logos'
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  );
