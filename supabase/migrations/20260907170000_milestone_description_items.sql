-- Milestone narrative = description; checklist items = milestone_items.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'milestones' and column_name = 'deliverables'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'milestones' and column_name = 'description'
  ) then
    alter table public.milestones rename column deliverables to description;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'milestones' and column_name = 'deliverables_doc'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'milestones' and column_name = 'description_doc'
  ) then
    alter table public.milestones rename column deliverables_doc to description_doc;
  end if;
end $$;

alter table public.milestones
  add column if not exists description text,
  add column if not exists description_doc jsonb;

create table if not exists public.milestone_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists milestone_items_milestone_idx
  on public.milestone_items (organization_id, milestone_id, position);

create unique index if not exists milestone_items_task_uidx
  on public.milestone_items (task_id)
  where task_id is not null;

alter table public.milestone_items enable row level security;

drop policy if exists milestone_items_read on public.milestone_items;
create policy milestone_items_read on public.milestone_items
  for select using (public.is_org_member(organization_id));

drop policy if exists milestone_items_write on public.milestone_items;
create policy milestone_items_write on public.milestone_items
  for insert with check (public.can_write_org(organization_id));

drop policy if exists milestone_items_update on public.milestone_items;
create policy milestone_items_update on public.milestone_items
  for update using (public.can_write_org(organization_id));

drop policy if exists milestone_items_delete on public.milestone_items;
create policy milestone_items_delete on public.milestone_items
  for delete using (public.can_write_org(organization_id));
