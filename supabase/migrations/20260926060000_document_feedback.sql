-- Client review of sent documents: comments, suggested edits, change requests and replies,
-- plus an audit trail on portal e-signatures.

create table if not exists public.document_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_version_id uuid references public.document_versions (id) on delete set null,
  send_id uuid references public.document_sends (id) on delete set null,
  kind text not null
    check (kind in ('comment', 'suggestion', 'changes_requested', 'reply', 'signed')),
  author_type text not null check (author_type in ('client', 'studio')),
  author_name text,
  author_email text,
  author_user_id uuid references auth.users (id) on delete set null,
  quote text,
  suggestion text,
  body text not null default '',
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists document_feedback_document_idx
  on public.document_feedback (document_id, created_at);
create index if not exists document_feedback_org_idx
  on public.document_feedback (organization_id);
create index if not exists document_feedback_send_idx
  on public.document_feedback (send_id);
create index if not exists document_feedback_version_idx
  on public.document_feedback (document_version_id);
create index if not exists document_feedback_author_idx
  on public.document_feedback (author_user_id);
create index if not exists document_feedback_resolved_by_idx
  on public.document_feedback (resolved_by);

alter table public.document_feedback enable row level security;

create policy document_feedback_select on public.document_feedback
  for select to authenticated
  using ((select public.is_org_member(organization_id)));

create policy document_feedback_insert on public.document_feedback
  for insert to authenticated
  with check ((select public.can_write_org(organization_id)) and author_type = 'studio');

create policy document_feedback_update on public.document_feedback
  for update to authenticated
  using ((select public.can_write_org(organization_id)))
  with check ((select public.can_write_org(organization_id)));

alter table public.document_signatures
  add column if not exists method text not null default 'studio'
    check (method in ('studio', 'portal')),
  add column if not exists send_id uuid references public.document_sends (id) on delete set null,
  add column if not exists signature_text text,
  add column if not exists ip_address text,
  add column if not exists content_hash text;

create index if not exists document_signatures_send_idx
  on public.document_signatures (send_id);
