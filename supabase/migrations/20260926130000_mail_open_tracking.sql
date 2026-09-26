-- Emails sent to leads from the CRM composer, and a single open tracker for every
-- tracked email (lead emails and document sends).
--
-- The tracking pixel is served by the `mail-open` edge function on the public Supabase
-- host, so mail clients' image proxies (Gmail, Outlook) can always reach it. The edge
-- function passes the raw token here; opens and the first-open notification happen in SQL.

create table if not exists public.lead_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  activity_id uuid references public.lead_activities (id) on delete set null,
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  to_email text not null,
  to_name text,
  cc text[] not null default '{}',
  subject text not null,
  body text not null,
  template_id text,
  message_id text,
  in_reply_to uuid references public.lead_emails (id) on delete set null,
  token_hash text not null unique,
  track_opens boolean not null default true,
  sent_at timestamptz not null default now(),
  open_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz
);

create index if not exists lead_emails_lead_idx on public.lead_emails (lead_id, sent_at desc);
create index if not exists lead_emails_org_idx on public.lead_emails (organization_id, sent_at desc);
create index if not exists lead_emails_activity_idx on public.lead_emails (activity_id);
create index if not exists lead_emails_sent_by_idx on public.lead_emails (sent_by);
create index if not exists lead_emails_reply_idx on public.lead_emails (in_reply_to);

alter table public.lead_emails enable row level security;

drop policy if exists lead_emails_read on public.lead_emails;
create policy lead_emails_read on public.lead_emails
  for select to authenticated
  using ((select public.is_org_member(organization_id)));

drop policy if exists lead_emails_insert on public.lead_emails;
create policy lead_emails_insert on public.lead_emails
  for insert to authenticated
  with check (
    (select public.can_write_org(organization_id))
    and sent_by = (select auth.uid())
  );

drop policy if exists lead_emails_update on public.lead_emails;
create policy lead_emails_update on public.lead_emails
  for update to authenticated
  using ((select public.can_write_org(organization_id)) and sent_by = (select auth.uid()))
  with check ((select public.can_write_org(organization_id)) and sent_by = (select auth.uid()));

drop policy if exists lead_emails_delete on public.lead_emails;
create policy lead_emails_delete on public.lead_emails
  for delete to authenticated
  using ((select public.can_write_org(organization_id)) and sent_by = (select auth.uid()));

-- Counts one open for whichever tracked email owns the token. Hits in the first seconds
-- after sending are ignored: those are link scanners, not people.
create or replace function public.track_mail_open(p_token text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_hash text;
  v_doc record;
  v_mail record;
  v_slug text;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 128 then
    return;
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  update public.document_sends s
     set open_count = s.open_count + 1,
         first_opened_at = coalesce(s.first_opened_at, now()),
         last_opened_at = now()
   where s.token_hash = v_hash
     and s.revoked_at is null
     and s.track_opens
     and s.sent_at < now() - interval '10 seconds'
  returning s.organization_id, s.document_id, s.title, s.recipient_email, s.recipient_name,
            s.sent_by, s.open_count = 1 as first_time
  into v_doc;

  if found then
    if v_doc.first_time and v_doc.sent_by is not null then
      select o.slug into v_slug from public.organizations o where o.id = v_doc.organization_id;
      insert into public.notifications
        (organization_id, user_id, kind, category, title, body, href, entity_type, entity_id)
      values (
        v_doc.organization_id,
        v_doc.sent_by,
        'info',
        'clients',
        coalesce(nullif(v_doc.recipient_name, ''), v_doc.recipient_email)
          || ' opened the email for ' || v_doc.title,
        v_doc.recipient_email || ' opened the email you sent.',
        case when v_slug is null then null else '/' || v_slug || '/documents/' || v_doc.document_id end,
        'document',
        v_doc.document_id
      );
    end if;
    return;
  end if;

  update public.lead_emails e
     set open_count = e.open_count + 1,
         first_opened_at = coalesce(e.first_opened_at, now()),
         last_opened_at = now()
   where e.token_hash = v_hash
     and e.track_opens
     and e.sent_at < now() - interval '10 seconds'
  returning e.organization_id, e.lead_id, e.subject, e.to_email, e.to_name, e.sent_by,
            e.open_count = 1 as first_time
  into v_mail;

  if found and v_mail.first_time and v_mail.sent_by is not null then
    select o.slug into v_slug from public.organizations o where o.id = v_mail.organization_id;
    insert into public.notifications
      (organization_id, user_id, kind, category, title, body, href, entity_type, entity_id)
    values (
      v_mail.organization_id,
      v_mail.sent_by,
      'info',
      'leads',
      coalesce(nullif(v_mail.to_name, ''), v_mail.to_email) || ' opened “' || v_mail.subject || '”',
      'They just read your email. A good moment to follow up.',
      case when v_slug is null then null else '/' || v_slug || '/crm?lead=' || v_mail.lead_id end,
      'lead',
      v_mail.lead_id
    );
  end if;
end;
$$;

revoke all on function public.track_mail_open(text) from public, anon, authenticated;
grant execute on function public.track_mail_open(text) to service_role;
