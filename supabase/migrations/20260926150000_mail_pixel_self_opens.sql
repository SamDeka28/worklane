-- Pasting a pixel into Gmail's compose window makes Google's image proxy fetch it at
-- once, from Google's network rather than the sender's, so the network check can't
-- catch it. Hits shortly after the sender copies the pixel are treated as that paste.
-- Senders can also dismiss an open as their own ("This was me").

alter table public.mail_pixels
  add column if not exists copied_at timestamptz not null default now();

alter table public.mail_pixel_opens
  add column if not exists ip_hash text;

drop policy if exists mail_pixel_opens_delete on public.mail_pixel_opens;
create policy mail_pixel_opens_delete on public.mail_pixel_opens
  for delete to authenticated
  using (
    exists (
      select 1 from public.mail_pixels p
       where p.id = mail_pixel_opens.pixel_id
         and (select public.is_org_member(p.organization_id))
         and p.created_by = (select auth.uid())
    )
  );

create or replace function public.track_mail_open(
  p_token text,
  p_ip text default null,
  p_client text default null,
  p_claim text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_hash text;
  v_doc record;
  v_mail record;
  v_pixel record;
  v_ip_hash text;
  v_count integer;
  v_slug text;
  v_who text;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 128 then
    return;
  end if;

  select p.id, p.organization_id, p.created_by, p.claim, p.subject, p.recipient, p.lead_id,
         p.self_ip_hashes, p.created_at, p.copied_at
    into v_pixel
    from public.mail_pixels p
   where p.token = p_token;

  if found then
    v_ip_hash := case
      when nullif(p_ip, '') is null then null
      else encode(extensions.digest(p_ip || ':' || v_pixel.claim, 'sha256'), 'hex')
    end;

    if p_claim is not null then
      if p_claim = v_pixel.claim and v_ip_hash is not null
         and not (v_ip_hash = any (v_pixel.self_ip_hashes)) then
        update public.mail_pixels
           set self_ip_hashes = (array_prepend(v_ip_hash, self_ip_hashes))[1:8]
         where id = v_pixel.id;
      end if;
      return;
    end if;

    if greatest(v_pixel.created_at, v_pixel.copied_at) > now() - interval '2 minutes'
       or (v_ip_hash is not null and v_ip_hash = any (v_pixel.self_ip_hashes)) then
      return;
    end if;

    update public.mail_pixels
       set open_count = open_count + 1,
           first_opened_at = coalesce(first_opened_at, now()),
           last_opened_at = now()
     where id = v_pixel.id
    returning open_count into v_count;

    insert into public.mail_pixel_opens (pixel_id, organization_id, client, ip_hash)
    values (v_pixel.id, v_pixel.organization_id, left(nullif(p_client, ''), 40), v_ip_hash);

    if v_count = 1 then
      select o.slug into v_slug from public.organizations o where o.id = v_pixel.organization_id;
      v_who := coalesce(nullif(v_pixel.recipient, ''), 'Someone');
      insert into public.notifications
        (organization_id, user_id, kind, category, title, body, href, entity_type, entity_id)
      values (
        v_pixel.organization_id,
        v_pixel.created_by,
        'info',
        'emails',
        case
          when nullif(v_pixel.subject, '') is null then v_who || ' opened your tracked email'
          else v_who || ' opened “' || v_pixel.subject || '”'
        end,
        'First open of an email you tracked.',
        case when v_slug is null then null else '/' || v_slug || '/emails?email=' || v_pixel.id end,
        'mail_pixel',
        v_pixel.id
      );
    end if;
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

revoke all on function public.track_mail_open(text, text, text, text) from public, anon, authenticated;
grant execute on function public.track_mail_open(text, text, text, text) to service_role;
