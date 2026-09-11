-- Delivery: projects, milestones, tasks, work logs.
-- Charges stay the money source of truth; work logs and milestones only
-- attach optional FKs so remaining is never stored on a project row.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null,
  status text not null default 'active'
    check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  billing_mode text not null default 'hourly'
    check (billing_mode in ('none', 'single_charge', 'milestones', 'hourly', 'manual')),
  default_fee_bps integer not null default 500
    check (default_fee_bps >= 0 and default_fee_bps <= 10000),
  earn_on text not null default 'charge'
    check (earn_on in ('charge', 'receipt')),
  contracted_amount_minor bigint
    check (contracted_amount_minor is null or contracted_amount_minor >= 0),
  scope text,
  starts_on date,
  due_on date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'billed', 'completed', 'cancelled')),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  due_on date,
  deliverables text,
  charge_id uuid,
  billed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  title text not null,
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_on date,
  assignee_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  worked_on date not null default (timezone('utc', now()))::date,
  hours_millis integer check (hours_millis is null or hours_millis > 0),
  hourly_rate_minor bigint check (hourly_rate_minor is null or hourly_rate_minor >= 0),
  fixed_minor bigint check (fixed_minor is null or fixed_minor >= 0),
  description text,
  external_url text,
  charge_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint work_logs_amount_present check (
    (fixed_minor is not null and fixed_minor > 0)
    or (
      hours_millis is not null
      and hours_millis > 0
      and hourly_rate_minor is not null
      and hourly_rate_minor > 0
    )
  )
);

alter table public.charges
  add column if not exists project_id uuid references public.projects (id) on delete set null;

alter table public.charges
  add column if not exists milestone_id uuid references public.milestones (id) on delete set null;

alter table public.charges
  add column if not exists work_log_id uuid references public.work_logs (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'milestones_charge_id_fkey'
  ) then
    alter table public.milestones
      add constraint milestones_charge_id_fkey
      foreign key (charge_id) references public.charges (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'work_logs_charge_id_fkey'
  ) then
    alter table public.work_logs
      add constraint work_logs_charge_id_fkey
      foreign key (charge_id) references public.charges (id) on delete set null;
  end if;
end $$;

create unique index if not exists charges_work_log_id_uidx
  on public.charges (work_log_id) where work_log_id is not null;
create unique index if not exists charges_milestone_id_uidx
  on public.charges (milestone_id) where milestone_id is not null;
create unique index if not exists work_logs_charge_id_uidx
  on public.work_logs (charge_id) where charge_id is not null;
create unique index if not exists milestones_charge_id_uidx
  on public.milestones (charge_id) where charge_id is not null;

create index if not exists projects_org_client_idx
  on public.projects (organization_id, client_id, created_at desc);
create index if not exists milestones_project_idx
  on public.milestones (organization_id, project_id);
create index if not exists tasks_project_status_idx
  on public.tasks (organization_id, project_id, status);
create index if not exists work_logs_project_date_idx
  on public.work_logs (organization_id, project_id, worked_on desc);
create index if not exists charges_project_idx
  on public.charges (organization_id, project_id);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.work_logs enable row level security;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select using (public.is_org_member(organization_id));
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects
  for insert with check (public.can_write_org(organization_id));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (public.can_write_org(organization_id));

drop policy if exists milestones_read on public.milestones;
create policy milestones_read on public.milestones
  for select using (public.is_org_member(organization_id));
drop policy if exists milestones_write on public.milestones;
create policy milestones_write on public.milestones
  for insert with check (public.can_write_org(organization_id));
drop policy if exists milestones_update on public.milestones;
create policy milestones_update on public.milestones
  for update using (public.can_write_org(organization_id));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select using (public.is_org_member(organization_id));
drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks
  for insert with check (public.can_write_org(organization_id));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (public.can_write_org(organization_id));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (public.can_write_org(organization_id));

drop policy if exists work_logs_read on public.work_logs;
create policy work_logs_read on public.work_logs
  for select using (public.is_org_member(organization_id));
drop policy if exists work_logs_write on public.work_logs;
create policy work_logs_write on public.work_logs
  for insert with check (public.can_write_org(organization_id));
drop policy if exists work_logs_update on public.work_logs;
create policy work_logs_update on public.work_logs
  for update using (public.can_write_org(organization_id));
