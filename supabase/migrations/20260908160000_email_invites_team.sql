-- Profiles, invite tokens, notifications, skip auto-org on invited signup.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists profiles_read_self_or_org on public.profiles;
create policy profiles_read_self_or_org on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = profiles.id
        and theirs.status = 'active'
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

-- Backfill profiles from auth.users where missing
insert into public.profiles (id, email, display_name)
select
  u.id,
  coalesce(u.email, u.id::text),
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (id) do nothing;

alter table public.organization_invitations
  add column if not exists token_hash text;

alter table public.organization_invitations
  add column if not exists project_id uuid references public.projects (id) on delete set null;

alter table public.organization_invitations
  add column if not exists project_role text
    check (project_role is null or project_role in ('lead', 'member'));

-- Unique pending invite per org+email (partial)
create unique index if not exists organization_invitations_pending_email_uidx
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null;

create index if not exists organization_invitations_token_hash_idx
  on public.organization_invitations (token_hash)
  where token_hash is not null and accepted_at is null;

-- Fill token_hash for any legacy rows
update public.organization_invitations
set token_hash = encode(digest(gen_random_uuid()::text, 'sha256'), 'hex')
where token_hash is null;

alter table public.organization_invitations
  alter column token_hash set not null;

drop policy if exists organization_invitations_insert on public.organization_invitations;
create policy organization_invitations_insert on public.organization_invitations
  for insert with check (
    exists (
      select 1 from public.organization_members
      where organization_id = organization_invitations.organization_id
        and user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'admin')
    )
  );

drop policy if exists organization_invitations_update on public.organization_invitations;
create policy organization_invitations_update on public.organization_invitations
  for update using (
    exists (
      select 1 from public.organization_members
      where organization_id = organization_invitations.organization_id
        and user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'admin')
    )
  );

drop policy if exists organization_invitations_delete on public.organization_invitations;
create policy organization_invitations_delete on public.organization_invitations
  for delete using (
    exists (
      select 1 from public.organization_members
      where organization_id = organization_invitations.organization_id
        and user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'admin')
    )
  );

-- Members write for owners/admins (invite accept uses service role)
drop policy if exists organization_members_insert on public.organization_members;
create policy organization_members_insert on public.organization_members
  for insert with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_update on public.organization_members
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    )
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  href text,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid());

-- Signup: create profile always; skip auto-org when invite signup
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
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'org_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();

  skip_org := coalesce((new.raw_user_meta_data->>'skip_org')::boolean, false)
    or nullif(new.raw_user_meta_data->>'invite_token', '') is not null;

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
