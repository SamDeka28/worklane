-- Signatures added below lead emails and Compose emails. One studio-wide row
-- (user_id null) set by owners and admins, and an optional row per member that
-- follows the studio's, replaces it, or turns it off. The body is the rich-text
-- editor's document; the studio row also says which modules add signatures.
-- Rows are only reachable with the service role, after the server has checked who is asking.

create table if not exists public.email_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  mode text not null default 'studio' check (mode in ('studio', 'custom', 'none')),
  body jsonb check (body is null or octet_length(body::text) <= 20000),
  allow_override boolean not null default true,
  use_in_leads boolean not null default true,
  use_in_emails boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create unique index if not exists email_signatures_studio_idx
  on public.email_signatures (organization_id) where user_id is null;

create unique index if not exists email_signatures_member_idx
  on public.email_signatures (organization_id, user_id) where user_id is not null;

create index if not exists email_signatures_user_idx on public.email_signatures (user_id);

alter table public.email_signatures enable row level security;

revoke all on public.email_signatures from anon, authenticated;

-- Images in signatures (logos, photos). Public so they load in recipients' inboxes;
-- uploads go through the server with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-assets',
  'email-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
