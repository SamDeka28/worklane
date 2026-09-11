-- Trello-style board columns, card descriptions, ordering, and comments.
-- Task status stays in sync with system columns; remaining money is never stored.

create table if not exists public.project_columns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  system_key text check (system_key is null or system_key in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now()
);

create unique index if not exists project_columns_system_key_uidx
  on public.project_columns (project_id, system_key)
  where system_key is not null;

create index if not exists project_columns_project_idx
  on public.project_columns (organization_id, project_id, position);

insert into public.project_columns (organization_id, project_id, name, position, system_key)
select
  p.organization_id,
  p.id,
  v.name,
  v.position,
  v.system_key
from public.projects p
cross join (
  values
    ('To do', 0, 'todo'),
    ('Doing', 1, 'doing'),
    ('Done', 2, 'done')
) as v(name, position, system_key)
where not exists (
  select 1 from public.project_columns c where c.project_id = p.id
);

alter table public.tasks
  add column if not exists description text,
  add column if not exists column_id uuid references public.project_columns (id) on delete set null,
  add column if not exists position integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

with ranked as (
  select
    t.id,
    c.id as column_id,
    row_number() over (partition by t.project_id, t.status order by t.created_at) - 1 as ord
  from public.tasks t
  join public.project_columns c
    on c.project_id = t.project_id
   and c.system_key = t.status
  where t.column_id is null
)
update public.tasks t
set
  column_id = ranked.column_id,
  position = ranked.ord
from ranked
where t.id = ranked.id;

create index if not exists tasks_column_position_idx
  on public.tasks (organization_id, column_id, position);

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create or replace function public.seed_project_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.project_columns (organization_id, project_id, name, position, system_key)
  values
    (new.organization_id, new.id, 'To do', 0, 'todo'),
    (new.organization_id, new.id, 'Doing', 1, 'doing'),
    (new.organization_id, new.id, 'Done', 2, 'done');
  return new;
end;
$$;

drop trigger if exists projects_seed_columns on public.projects;
create trigger projects_seed_columns
  after insert on public.projects
  for each row execute function public.seed_project_columns();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_idx
  on public.task_comments (organization_id, task_id, created_at);

alter table public.project_columns enable row level security;
alter table public.task_comments enable row level security;

drop policy if exists project_columns_read on public.project_columns;
create policy project_columns_read on public.project_columns
  for select using (public.is_org_member(organization_id));
drop policy if exists project_columns_write on public.project_columns;
create policy project_columns_write on public.project_columns
  for insert with check (public.can_write_org(organization_id));
drop policy if exists project_columns_update on public.project_columns;
create policy project_columns_update on public.project_columns
  for update using (public.can_write_org(organization_id));
drop policy if exists project_columns_delete on public.project_columns;
create policy project_columns_delete on public.project_columns
  for delete using (public.can_write_org(organization_id));

drop policy if exists task_comments_read on public.task_comments;
create policy task_comments_read on public.task_comments
  for select using (public.is_org_member(organization_id));
drop policy if exists task_comments_write on public.task_comments;
create policy task_comments_write on public.task_comments
  for insert with check (public.can_write_org(organization_id));
drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete using (public.can_write_org(organization_id));
