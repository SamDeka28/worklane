-- Documents emailed to clients from Worklane over SMTP.
-- Each send stores a snapshot of exactly what the client sees behind a private link,
-- and counts email opens (tracking pixel) and link views.

create table if not exists public.document_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_version_id uuid references public.document_versions (id) on delete set null,
  token_hash text not null unique,
  title text not null,
  recipient_email text not null,
  recipient_name text,
  cc text[] not null default '{}',
  subject text not null,
  message text,
  content_doc jsonb not null,
  track_opens boolean not null default true,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  open_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  view_count integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  revoked_at timestamptz
);

create index if not exists document_sends_document_idx
  on public.document_sends (document_id, sent_at desc);
create index if not exists document_sends_org_idx
  on public.document_sends (organization_id);
create index if not exists document_sends_sent_by_idx
  on public.document_sends (sent_by);
create index if not exists document_sends_version_idx
  on public.document_sends (document_version_id);

alter table public.document_sends enable row level security;

create policy document_sends_select on public.document_sends
  for select to authenticated
  using ((select public.is_org_member(organization_id)));

create policy document_sends_insert on public.document_sends
  for insert to authenticated
  with check ((select public.can_write_org(organization_id)));

create policy document_sends_update on public.document_sends
  for update to authenticated
  using ((select public.can_write_org(organization_id)))
  with check ((select public.can_write_org(organization_id)));

create policy document_sends_delete on public.document_sends
  for delete to authenticated
  using ((select public.can_write_org(organization_id)));

-- Public tracking goes through the service role only; clients never touch the table.
create or replace function public.track_document_send(p_token_hash text, p_kind text)
returns table (
  id uuid,
  organization_id uuid,
  document_id uuid,
  title text,
  recipient_email text,
  recipient_name text,
  sent_by uuid,
  first_time boolean
)
language plpgsql
set search_path = ''
as $$
begin
  if p_kind = 'open' then
    return query
    update public.document_sends s
       set open_count = s.open_count + 1,
           first_opened_at = coalesce(s.first_opened_at, now()),
           last_opened_at = now()
     where s.token_hash = p_token_hash
       and s.revoked_at is null
       and s.track_opens
    returning s.id, s.organization_id, s.document_id, s.title, s.recipient_email,
              s.recipient_name, s.sent_by, s.open_count = 1;
  elsif p_kind = 'view' then
    return query
    update public.document_sends s
       set view_count = s.view_count + 1,
           first_viewed_at = coalesce(s.first_viewed_at, now()),
           last_viewed_at = now()
     where s.token_hash = p_token_hash
       and s.revoked_at is null
    returning s.id, s.organization_id, s.document_id, s.title, s.recipient_email,
              s.recipient_name, s.sent_by, s.view_count = 1;
  end if;
end;
$$;

revoke all on function public.track_document_send(text, text) from public, anon, authenticated;
grant execute on function public.track_document_send(text, text) to service_role;
