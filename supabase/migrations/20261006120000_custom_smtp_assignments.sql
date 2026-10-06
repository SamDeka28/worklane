-- Several custom SMTP mailboxes per studio. Each one is assigned to teammates
-- and limited to the modules that send through it. The original studio row
-- stays the fallback (is_fallback). Personal rows stay one lead mailbox each.

alter table public.smtp_senders
  add column if not exists name text,
  add column if not exists modules text[] not null default '{}',
  add column if not exists is_fallback boolean not null default false;

update public.smtp_senders
set
  name = case when user_id is null then 'Studio mailbox' else 'Personal mailbox' end,
  is_fallback = user_id is null
where name is null;

alter table public.smtp_senders
  alter column name set not null;

alter table public.smtp_senders
  drop constraint if exists smtp_senders_name_len;

alter table public.smtp_senders
  add constraint smtp_senders_name_len check (char_length(name) between 1 and 80);

drop index if exists public.smtp_senders_studio_idx;
drop index if exists public.smtp_senders_member_idx;

create unique index if not exists smtp_senders_fallback_idx
  on public.smtp_senders (organization_id)
  where is_fallback;

create table if not exists public.smtp_sender_members (
  smtp_sender_id uuid not null references public.smtp_senders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  primary key (smtp_sender_id, user_id)
);

create index if not exists smtp_sender_members_user_idx
  on public.smtp_sender_members (organization_id, user_id);

alter table public.smtp_sender_members enable row level security;

revoke all on public.smtp_sender_members from anon, authenticated;
