-- Full lead CRM: next steps, activity log, close outcomes, stage probabilities,
-- lead-linked documents, and a public intake form.

-- ── Leads ──────────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists next_action text,
  add column if not exists next_action_on date,
  add column if not exists last_touched_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists lost_reason text,
  add column if not exists lost_note text,
  add column if not exists origin text not null default 'manual';

alter table public.leads drop constraint if exists leads_origin_check;
alter table public.leads
  add constraint leads_origin_check check (origin in ('manual', 'intake', 'import'));

create index if not exists leads_org_owner_next_idx
  on public.leads (organization_id, owner_user_id, next_action_on);
create index if not exists leads_org_touched_idx
  on public.leads (organization_id, last_touched_at);
create index if not exists leads_org_email_idx
  on public.leads (organization_id, lower(email));

alter table public.leads disable trigger leads_updated_at;

update public.leads set last_touched_at = updated_at;

update public.leads l
set closed_at = coalesce(
  (select max(e.created_at) from public.record_events e
    where e.entity_type = 'lead' and e.entity_id = l.id and e.changes ? 'stage'),
  l.updated_at)
from public.lead_stages s
where s.organization_id = l.organization_id
  and s.slug = l.stage
  and s.system_key is not null
  and l.closed_at is null;

alter table public.leads enable trigger leads_updated_at;

-- Stage moves count as a touch; entering Won/Lost stamps closed_at and clears the next step.
create or replace function public.leads_stage_bookkeeping()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_key text;
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    select s.system_key into v_key
    from public.lead_stages s
    where s.organization_id = new.organization_id and s.slug = new.stage;
    if v_key is null and new.stage in ('won', 'lost') then
      v_key := new.stage;
    end if;

    if v_key is not null then
      new.closed_at := case when tg_op = 'INSERT' then coalesce(new.closed_at, now()) else now() end;
      new.next_action := null;
      new.next_action_on := null;
    else
      new.closed_at := null;
    end if;
    if v_key is distinct from 'lost' then
      new.lost_reason := null;
      new.lost_note := null;
    end if;
    if tg_op = 'UPDATE' then
      new.last_touched_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_stage_bookkeeping on public.leads;
create trigger leads_stage_bookkeeping
  before insert or update on public.leads
  for each row execute function public.leads_stage_bookkeeping();

-- ── Activity log ───────────────────────────────────────────────────────────
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('call', 'email', 'meeting', 'message', 'note', 'form')),
  body text,
  body_doc jsonb,
  happened_at timestamptz not null default now(),
  actor_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx
  on public.lead_activities (lead_id, happened_at desc);
create index if not exists lead_activities_org_idx
  on public.lead_activities (organization_id, happened_at desc);

alter table public.lead_activities enable row level security;

drop policy if exists lead_activities_read on public.lead_activities;
create policy lead_activities_read on public.lead_activities
  for select using (public.is_org_member(organization_id));

drop policy if exists lead_activities_insert on public.lead_activities;
create policy lead_activities_insert on public.lead_activities
  for insert with check (
    public.can_write_org(organization_id)
    and actor_id = (select auth.uid())
  );

drop policy if exists lead_activities_update on public.lead_activities;
create policy lead_activities_update on public.lead_activities
  for update using (
    public.can_write_org(organization_id) and actor_id = (select auth.uid())
  );

drop policy if exists lead_activities_delete on public.lead_activities;
create policy lead_activities_delete on public.lead_activities
  for delete using (
    (public.can_write_org(organization_id) and actor_id = (select auth.uid()))
    or public.can_delete_module(organization_id, 'crm')
  );

create or replace function public.lead_activity_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
  set last_touched_at = greatest(last_touched_at, new.happened_at)
  where id = new.lead_id;
  return null;
end;
$$;

revoke execute on function public.lead_activity_touch() from public, anon, authenticated;

drop trigger if exists lead_activities_touch on public.lead_activities;
create trigger lead_activities_touch
  after insert on public.lead_activities
  for each row execute function public.lead_activity_touch();

-- ── Stage probabilities ────────────────────────────────────────────────────
alter table public.lead_stages
  add column if not exists probability_bps integer
    check (probability_bps is null or probability_bps between 0 and 10000);

update public.lead_stages set probability_bps = case
  when system_key = 'won' then 10000
  when system_key = 'lost' then 0
  when slug = 'new' then 1000
  when slug = 'contacted' then 2000
  when slug = 'discovery' then 3000
  when slug = 'qualified' then 5000
  when slug = 'proposal' then 6000
  when slug = 'negotiation' then 8000
  else null
end
where probability_bps is null;

with ranked as (
  select id,
    row_number() over (partition by organization_id order by position) as rn,
    count(*) over (partition by organization_id) as n
  from public.lead_stages
  where system_key is null
)
update public.lead_stages s
set probability_bps = round(10000.0 * r.rn / (r.n + 1))
from ranked r
where s.id = r.id and s.probability_bps is null;

create or replace function public.seed_lead_stages(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_stages (organization_id, name, slug, position, system_key, probability_bps)
  select p_org_id, v.name, v.slug, v.position, v.system_key, v.probability_bps
  from (
    values
      ('New', 'new', 0, null::text, 1000),
      ('Contacted', 'contacted', 1, null, 2000),
      ('Discovery', 'discovery', 2, null, 3000),
      ('Qualified', 'qualified', 3, null, 5000),
      ('Proposal', 'proposal', 4, null, 6000),
      ('Negotiation', 'negotiation', 5, null, 8000),
      ('Won', 'won', 6, 'won', 10000),
      ('Lost', 'lost', 7, 'lost', 0)
  ) as v(name, slug, position, system_key, probability_bps)
  where not exists (
    select 1 from public.lead_stages s where s.organization_id = p_org_id
  );
end;
$$;

-- ── Proposals on leads ─────────────────────────────────────────────────────
alter table public.documents
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

create index if not exists documents_lead_idx
  on public.documents (organization_id, lead_id) where lead_id is not null;

alter table public.document_refs drop constraint if exists document_refs_entity_type_check;
alter table public.document_refs
  add constraint document_refs_entity_type_check
  check (entity_type in ('client', 'project', 'milestone', 'task', 'lead'));

-- ── Audit: track next step and loss reason ─────────────────────────────────
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
  if not exists (select 1 from public.organizations where id = v_org) then
    return null;
  end if;

  if v_type = 'lead' then
    v_tracked := array['name', 'company', 'contact_name', 'email', 'phone', 'whatsapp', 'source',
                       'estimated_value_minor', 'currency', 'close_on', 'tags',
                       'next_action', 'next_action_on', 'lost_reason'];
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

revoke execute on function public.record_entity_event() from public, anon, authenticated;

-- ── Public intake form ─────────────────────────────────────────────────────
-- Config lives in organizations.settings -> crm -> intake: { enabled, code, headline,
-- intro, ownerUserId, source, askCompany, askPhone, askBudget }.

create or replace function public.get_lead_intake(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'orgName', o.name,
    'currency', o.default_currency,
    'headline', o.settings->'crm'->'intake'->>'headline',
    'intro', o.settings->'crm'->'intake'->>'intro',
    'askCompany', coalesce((o.settings->'crm'->'intake'->>'askCompany')::boolean, true),
    'askPhone', coalesce((o.settings->'crm'->'intake'->>'askPhone')::boolean, true),
    'askBudget', coalesce((o.settings->'crm'->'intake'->>'askBudget')::boolean, false)
  )
  from public.organizations o
  where length(coalesce(p_code, '')) >= 8
    and o.settings->'crm'->'intake'->>'code' = p_code
    and coalesce((o.settings->'crm'->'intake'->>'enabled')::boolean, false)
    and coalesce((o.settings->'modules'->>'crm')::boolean, true)
  limit 1;
$$;

create or replace function public.submit_lead_intake(
  p_code text,
  p_name text,
  p_email text,
  p_company text default null,
  p_phone text default null,
  p_message text default null,
  p_budget_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_owner uuid;
  v_stage text;
  v_source text;
  v_lead uuid;
  v_name text := left(trim(coalesce(p_name, '')), 160);
  v_email text := lower(left(trim(coalesce(p_email, '')), 254));
begin
  select * into v_org
  from public.organizations o
  where length(coalesce(p_code, '')) >= 8
    and o.settings->'crm'->'intake'->>'code' = p_code
    and coalesce((o.settings->'crm'->'intake'->>'enabled')::boolean, false)
    and coalesce((o.settings->'modules'->>'crm')::boolean, true)
  limit 1;
  if v_org.id is null then
    raise exception 'This form is not accepting responses';
  end if;

  if v_name = '' then raise exception 'Name is required'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'A valid email is required'; end if;

  if (select count(*) from public.leads
      where organization_id = v_org.id and origin = 'intake'
        and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Too many submissions right now. Try again shortly.';
  end if;
  if exists (select 1 from public.leads
      where organization_id = v_org.id and origin = 'intake'
        and lower(email) = v_email and created_at > now() - interval '5 minutes') then
    raise exception 'We already have your details. We''ll be in touch.';
  end if;

  select m.user_id into v_owner
  from public.organization_members m
  where m.organization_id = v_org.id and m.status = 'active'
    and m.user_id = nullif(v_org.settings->'crm'->'intake'->>'ownerUserId', '')::uuid;

  select slug into v_stage from public.lead_stages
  where organization_id = v_org.id and system_key is null
  order by position limit 1;

  v_source := coalesce(nullif(trim(v_org.settings->'crm'->'intake'->>'source'), ''), 'Website form');

  insert into public.leads (
    organization_id, name, company, contact_name, email, phone, source,
    estimated_value_minor, currency, owner_user_id, stage, origin, notes,
    next_action, next_action_on
  ) values (
    v_org.id,
    coalesce(nullif(left(trim(coalesce(p_company, '')), 160), ''), v_name),
    nullif(left(trim(coalesce(p_company, '')), 160), ''),
    v_name,
    v_email,
    nullif(left(trim(coalesce(p_phone, '')), 40), ''),
    v_source,
    case when p_budget_minor > 0 then p_budget_minor end,
    v_org.default_currency,
    v_owner,
    coalesce(v_stage, 'new'),
    'intake',
    nullif(left(trim(coalesce(p_message, '')), 4000), ''),
    'Reply to form enquiry',
    current_date
  )
  returning id into v_lead;

  if nullif(trim(coalesce(p_message, '')), '') is not null then
    insert into public.lead_activities (organization_id, lead_id, kind, body, actor_id)
    values (v_org.id, v_lead, 'form', left(trim(p_message), 4000), null);
  end if;

  return jsonb_build_object(
    'leadId', v_lead,
    'organizationId', v_org.id,
    'orgSlug', v_org.slug,
    'orgName', v_org.name,
    'ownerUserId', v_owner,
    'leadName', coalesce(nullif(left(trim(coalesce(p_company, '')), 160), ''), v_name)
  );
end;
$$;

revoke execute on function public.get_lead_intake(text) from public;
revoke execute on function public.submit_lead_intake(text, text, text, text, text, text, bigint) from public;
grant execute on function public.get_lead_intake(text) to anon, authenticated;
grant execute on function public.submit_lead_intake(text, text, text, text, text, text, bigint) to anon, authenticated;
