-- Org-configurable CRM lead journey stages (slug stored on leads.stage).

create table if not exists public.lead_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  position integer not null default 0,
  system_key text check (system_key is null or system_key in ('won', 'lost')),
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create unique index if not exists lead_stages_system_key_uidx
  on public.lead_stages (organization_id, system_key)
  where system_key is not null;

create index if not exists lead_stages_org_position_idx
  on public.lead_stages (organization_id, position);

-- Drop fixed-stage CHECK so custom slugs are allowed.
alter table public.leads drop constraint if exists leads_stage_check;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.leads'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stage%'
  ) then
    execute (
      select 'alter table public.leads drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.leads'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%stage%'
      limit 1
    );
  end if;
end $$;

create or replace function public.seed_lead_stages(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_stages (organization_id, name, slug, position, system_key)
  select p_org_id, v.name, v.slug, v.position, v.system_key
  from (
    values
      ('New', 'new', 0, null::text),
      ('Contacted', 'contacted', 1, null),
      ('Discovery', 'discovery', 2, null),
      ('Qualified', 'qualified', 3, null),
      ('Proposal', 'proposal', 4, null),
      ('Negotiation', 'negotiation', 5, null),
      ('Won', 'won', 6, 'won'),
      ('Lost', 'lost', 7, 'lost')
  ) as v(name, slug, position, system_key)
  where not exists (
    select 1 from public.lead_stages s where s.organization_id = p_org_id
  );
end;
$$;

-- Seed every existing org.
do $$
declare
  org record;
begin
  for org in select id from public.organizations loop
    perform public.seed_lead_stages(org.id);
  end loop;
end $$;

create or replace function public.seed_lead_stages_on_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_lead_stages(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_seed_lead_stages on public.organizations;
create trigger organizations_seed_lead_stages
  after insert on public.organizations
  for each row execute function public.seed_lead_stages_on_org();

alter table public.lead_stages enable row level security;

drop policy if exists lead_stages_read on public.lead_stages;
create policy lead_stages_read on public.lead_stages
  for select using (public.is_org_member(organization_id));

drop policy if exists lead_stages_insert on public.lead_stages;
create policy lead_stages_insert on public.lead_stages
  for insert with check (public.can_write_org(organization_id));

drop policy if exists lead_stages_update on public.lead_stages;
create policy lead_stages_update on public.lead_stages
  for update using (public.can_write_org(organization_id));

drop policy if exists lead_stages_delete on public.lead_stages;
create policy lead_stages_delete on public.lead_stages
  for delete using (public.can_write_org(organization_id));
