-- Profile avatars (Google OAuth + uploaded)
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is 'Public image URL (Google picture or storage public URL)';

-- Capture Google avatar / name on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_slug text;
  org_id uuid;
  reserved text[] := array['login','signup','auth','api','brand','onboarding','invite'];
  skip_org boolean;
  meta_name text;
  meta_avatar text;
begin
  meta_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'org_name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  meta_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', '')
  );

  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    meta_name,
    meta_avatar
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        updated_at = now();

  skip_org := coalesce((new.raw_user_meta_data->>'skip_org')::boolean, false)
    or nullif(new.raw_user_meta_data->>'invite_token', '') is not null
    or exists (
      select 1
      from public.organization_invitations i
      where i.accepted_at is null
        and lower(i.email) = lower(coalesce(new.email, ''))
        and (i.expires_at is null or i.expires_at > now())
    );

  if skip_org then
    return new;
  end if;

  new_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  new_slug := trim(both '-' from new_slug);
  if new_slug is null or new_slug = '' or new_slug = any(reserved) then
    new_slug := 'studio';
  end if;
  while exists (select 1 from public.organizations where slug = new_slug) loop
    new_slug := new_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  end loop;

  insert into public.organizations (slug, name, default_currency, timezone, settings)
  values (
    new_slug,
    coalesce(nullif(new.raw_user_meta_data->>'org_name', ''), 'Worklane Studio'),
    'USD',
    'UTC',
    '{"modules":{"crm":true,"documents":true,"delivery":true,"finance":true,"partners":true,"portal":false}}'::jsonb
  )
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (org_id, new.id, 'owner', 'active');

  return new;
end;
$$;

-- Public avatar bucket (users own their folder)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
