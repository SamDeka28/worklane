-- Append-only audit trail for leads and tasks. Rows are written only by the
-- trigger below (security definer); clients can read, never write.

create table if not exists public.record_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'task')),
  entity_id uuid not null,
  entity_label text,
  project_id uuid,
  actor_id uuid references auth.users (id) on delete set null,
  actor_label text,
  action text not null check (action in ('created', 'updated', 'deleted')),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists record_events_entity_idx
  on public.record_events (entity_type, entity_id, created_at desc);
create index if not exists record_events_org_created_idx
  on public.record_events (organization_id, created_at desc);

alter table public.record_events enable row level security;

drop policy if exists record_events_read on public.record_events;
create policy record_events_read on public.record_events
  for select using (
    public.is_org_member(organization_id)
    and (entity_type <> 'task' or project_id is null or public.can_access_project(project_id))
  );

revoke insert, update, delete on public.record_events from anon, authenticated;

create or replace function public.audit_user_labels(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Someone')
      order by array_position(p_ids, p.id)
    ),
    '[]'::jsonb
  )
  from public.profiles p
  where p.id = any(p_ids);
$$;

create or replace function public.audit_task_assignees(p_row jsonb)
returns uuid[]
language sql
immutable
as $$
  select case
    when jsonb_array_length(coalesce(p_row->'assignee_user_ids', '[]'::jsonb)) > 0 then
      array(select jsonb_array_elements_text(p_row->'assignee_user_ids')::uuid order by 1)
    when p_row->>'assignee_user_id' is not null then
      array[(p_row->>'assignee_user_id')::uuid]
    else '{}'::uuid[]
  end;
$$;

create or replace function public.record_entity_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := tg_argv[0];
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid := (v_row->>'organization_id')::uuid;
  v_actor uuid := auth.uid();
  v_actor_label text;
  v_changes jsonb := '{}'::jsonb;
  v_tracked text[];
  v_redacted text[];
  v_key text;
  v_from text;
  v_to text;
  v_old_ids uuid[];
  v_new_ids uuid[];
begin
  -- Cascading org deletes: nothing left to audit against.
  if not exists (select 1 from public.organizations where id = v_org) then
    return null;
  end if;

  if v_type = 'lead' then
    v_tracked := array['name', 'company', 'contact_name', 'email', 'phone', 'whatsapp', 'source',
                       'estimated_value_minor', 'currency', 'close_on', 'tags'];
    v_redacted := array['notes', 'deal_share_bps'];
  else
    v_tracked := array['title', 'status', 'priority', 'kind', 'due_on', 'labels'];
    v_redacted := array['description'];
  end if;

  if tg_op = 'UPDATE' then
    foreach v_key in array v_tracked loop
      if v_old->v_key is distinct from v_new->v_key then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('from', v_old->v_key, 'to', v_new->v_key));
      end if;
    end loop;
    foreach v_key in array v_redacted loop
      if v_old->v_key is distinct from v_new->v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('changed', true));
      end if;
    end loop;
  end if;

  if v_type = 'lead' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and v_old->>'stage' is distinct from v_new->>'stage') then
      select name into v_to from public.lead_stages
        where organization_id = v_org and slug = v_new->>'stage';
      v_from := null;
      if tg_op = 'UPDATE' then
        select name into v_from from public.lead_stages
          where organization_id = v_org and slug = v_old->>'stage';
        v_from := coalesce(v_from, v_old->>'stage');
      end if;
      v_changes := v_changes || jsonb_build_object(
        'stage', jsonb_build_object('from', v_from, 'to', coalesce(v_to, v_new->>'stage')));
    end if;
    if tg_op = 'UPDATE' and v_old->>'owner_user_id' is distinct from v_new->>'owner_user_id' then
      v_changes := v_changes || jsonb_build_object('owner', jsonb_build_object(
        'from', public.audit_user_labels(array_remove(array[(v_old->>'owner_user_id')::uuid], null)),
        'to', public.audit_user_labels(array_remove(array[(v_new->>'owner_user_id')::uuid], null))));
    end if;
    if tg_op = 'UPDATE' and v_old->>'client_id' is distinct from v_new->>'client_id'
       and v_new->>'client_id' is not null then
      select name into v_to from public.clients where id = (v_new->>'client_id')::uuid;
      v_changes := v_changes || jsonb_build_object(
        'client', jsonb_build_object('from', null, 'to', v_to));
    end if;
  else
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and v_old->>'column_id' is distinct from v_new->>'column_id') then
      v_to := null;
      v_from := null;
      if v_new->>'column_id' is not null then
        select name into v_to from public.project_columns where id = (v_new->>'column_id')::uuid;
      end if;
      if tg_op = 'UPDATE' and v_old->>'column_id' is not null then
        select name into v_from from public.project_columns where id = (v_old->>'column_id')::uuid;
      end if;
      if v_to is not null or v_from is not null then
        v_changes := v_changes || jsonb_build_object(
          'column', jsonb_build_object('from', v_from, 'to', v_to));
      end if;
    end if;
    if tg_op = 'UPDATE' and v_old->>'project_id' is distinct from v_new->>'project_id' then
      select name into v_from from public.projects where id = (v_old->>'project_id')::uuid;
      select name into v_to from public.projects where id = (v_new->>'project_id')::uuid;
      v_changes := v_changes || jsonb_build_object(
        'project', jsonb_build_object('from', v_from, 'to', v_to));
    end if;
    if tg_op = 'UPDATE' and v_old->>'milestone_id' is distinct from v_new->>'milestone_id' then
      v_from := null;
      v_to := null;
      if v_old->>'milestone_id' is not null then
        select name into v_from from public.milestones where id = (v_old->>'milestone_id')::uuid;
      end if;
      if v_new->>'milestone_id' is not null then
        select name into v_to from public.milestones where id = (v_new->>'milestone_id')::uuid;
      end if;
      v_changes := v_changes || jsonb_build_object(
        'milestone', jsonb_build_object('from', v_from, 'to', v_to));
    end if;
    v_new_ids := case when tg_op <> 'DELETE' then public.audit_task_assignees(v_new) end;
    v_old_ids := case when tg_op = 'UPDATE' then public.audit_task_assignees(v_old) end;
    if (tg_op = 'INSERT' and cardinality(v_new_ids) > 0)
       or (tg_op = 'UPDATE' and v_old_ids is distinct from v_new_ids) then
      v_changes := v_changes || jsonb_build_object('assignees', jsonb_build_object(
        'from', case when tg_op = 'UPDATE' then public.audit_user_labels(v_old_ids) end,
        'to', public.audit_user_labels(v_new_ids)));
    end if;
  end if;

  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return null;
  end if;

  if v_actor is not null then
    select coalesce(nullif(trim(display_name), ''), split_part(email, '@', 1))
      into v_actor_label from public.profiles where id = v_actor;
  end if;

  insert into public.record_events (
    organization_id, entity_type, entity_id, entity_label, project_id,
    actor_id, actor_label, action, changes
  ) values (
    v_org,
    v_type,
    (v_row->>'id')::uuid,
    coalesce(v_row->>'name', v_row->>'title'),
    (v_row->>'project_id')::uuid,
    v_actor,
    v_actor_label,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    v_changes
  );
  return null;
end;
$$;

drop trigger if exists leads_record_events on public.leads;
create trigger leads_record_events
  after insert or update or delete on public.leads
  for each row execute function public.record_entity_event('lead');

drop trigger if exists tasks_record_events on public.tasks;
create trigger tasks_record_events
  after insert or update or delete on public.tasks
  for each row execute function public.record_entity_event('task');

-- Backfill: a "created" entry for everything that already exists, plus earlier lead stage moves.
insert into public.record_events (
  organization_id, entity_type, entity_id, entity_label, actor_id, actor_label, action, changes, created_at
)
select
  l.organization_id, 'lead', l.id, l.name, a.actor_id,
  (select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
     from public.profiles p where p.id = a.actor_id),
  'created', '{}'::jsonb, l.created_at
from public.leads l
left join lateral (
  select actor_id from public.activities
  where entity_type = 'lead' and entity_id = l.id and verb = 'created'
  order by created_at limit 1
) a on true
where not exists (
  select 1 from public.record_events e where e.entity_type = 'lead' and e.entity_id = l.id
);

insert into public.record_events (
  organization_id, entity_type, entity_id, entity_label, actor_id, actor_label, action, changes, created_at
)
select
  a.organization_id, 'lead', a.entity_id, l.name, a.actor_id,
  (select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
     from public.profiles p where p.id = a.actor_id),
  'updated',
  jsonb_build_object('stage', jsonb_build_object(
    'from', null,
    'to', coalesce(
      (select s.name from public.lead_stages s
        where s.organization_id = a.organization_id and s.slug = a.metadata->>'stage'),
      a.metadata->>'stage'))),
  a.created_at
from public.activities a
join public.leads l on l.id = a.entity_id
where a.entity_type = 'lead' and a.verb = 'stage_moved';

insert into public.record_events (
  organization_id, entity_type, entity_id, entity_label, project_id, action, changes, created_at
)
select t.organization_id, 'task', t.id, t.title, t.project_id, 'created', '{}'::jsonb, t.created_at
from public.tasks t
where not exists (
  select 1 from public.record_events e where e.entity_type = 'task' and e.entity_id = t.id
);
