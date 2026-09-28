-- Custom SMTP accounts for emails people send from Worklane. One studio-wide row
-- (user_id null) used by lead emails, Compose and document sends, and one personal row
-- per member, used only for their lead emails. Members need `mailbox` in their
-- organization_members.permissions (set from Team → Access); owners and admins don't.
-- The password is sealed with the app's credentials key; rows are only reachable with
-- the service role, after the server has checked who is asking.

create table if not exists public.smtp_senders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  host text not null check (char_length(host) between 1 and 255),
  port integer not null check (port between 1 and 65535),
  secure boolean not null default true,
  username text not null check (char_length(username) between 1 and 320),
  from_email text not null check (char_length(from_email) between 3 and 320),
  from_name text check (from_name is null or char_length(from_name) <= 120),
  key_version smallint not null default 1,
  iv text not null,
  auth_tag text not null,
  ciphertext text not null,
  verified_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists smtp_senders_studio_idx
  on public.smtp_senders (organization_id) where user_id is null;

create unique index if not exists smtp_senders_member_idx
  on public.smtp_senders (organization_id, user_id) where user_id is not null;

create index if not exists smtp_senders_user_idx on public.smtp_senders (user_id);

alter table public.smtp_senders enable row level security;

revoke all on public.smtp_senders from anon, authenticated;
