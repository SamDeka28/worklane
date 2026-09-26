-- Documents linked to a lead feed its timeline: sending logs a touch and advances
-- the lead to a "proposal" stage when it is earlier in the pipeline; acceptance is logged.

create or replace function public.lead_document_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_current int;
  v_target text;
  v_target_pos int;
  v_closed boolean;
begin
  if new.lead_id is null or new.status is not distinct from old.status then
    return null;
  end if;
  if new.status not in ('sent', 'accepted', 'signed') then
    return null;
  end if;

  select * into v_lead from public.leads where id = new.lead_id;
  if v_lead.id is null then
    return null;
  end if;

  insert into public.lead_activities (organization_id, lead_id, kind, body, actor_id)
  values (
    new.organization_id,
    new.lead_id,
    case when new.status = 'sent' then 'email' else 'note' end,
    case new.status
      when 'sent' then 'Sent “' || new.title || '”'
      when 'accepted' then 'Client accepted “' || new.title || '”'
      else 'Client signed “' || new.title || '”'
    end,
    auth.uid()
  );

  if new.status = 'sent' then
    select position, system_key is not null into v_current, v_closed
    from public.lead_stages
    where organization_id = v_lead.organization_id and slug = v_lead.stage;

    select slug, position into v_target, v_target_pos
    from public.lead_stages
    where organization_id = v_lead.organization_id
      and system_key is null
      and (slug = 'proposal' or name ilike 'proposal%')
    order by position
    limit 1;

    if v_target is not null and not coalesce(v_closed, false)
       and coalesce(v_current, -1) < v_target_pos then
      update public.leads set stage = v_target where id = v_lead.id;
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.lead_document_status_event() from public, anon, authenticated;

drop trigger if exists documents_lead_status_event on public.documents;
create trigger documents_lead_status_event
  after update of status on public.documents
  for each row execute function public.lead_document_status_event();
