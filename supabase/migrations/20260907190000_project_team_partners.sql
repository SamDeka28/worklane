-- Project team (access) + project partners (splits). Different projects, different people.

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_idx
  on public.project_members (organization_id, project_id);
create index if not exists project_members_user_idx
  on public.project_members (organization_id, user_id);

create table if not exists public.project_partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, partner_id)
);

create index if not exists project_partners_project_idx
  on public.project_partners (organization_id, project_id);
create index if not exists project_partners_partner_idx
  on public.project_partners (organization_id, partner_id);

create or replace function public.is_org_owner_or_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and (
        public.is_org_owner_or_admin(p.organization_id)
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.project_partners pp
          join public.partners pr on pr.id = pp.partner_id
          where pp.project_id = p.id
            and pr.user_id = auth.uid()
            and pr.active = true
        )
      )
  );
$$;

grant execute on function public.is_org_owner_or_admin(uuid) to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;
revoke all on function public.is_org_owner_or_admin(uuid) from public, anon;
revoke all on function public.can_access_project(uuid) from public, anon;

-- Backfill: every active write-capable member gets access to existing projects.
insert into public.project_members (organization_id, project_id, user_id, role)
select p.organization_id, p.id, m.user_id,
  case when m.role in ('owner', 'admin') then 'lead' else 'member' end
from public.projects p
join public.organization_members m
  on m.organization_id = p.organization_id
 and m.status = 'active'
 and m.role in ('owner', 'admin', 'member')
on conflict (project_id, user_id) do nothing;

-- If a project already has a distribution, seed project_partners from latest lines.
insert into public.project_partners (organization_id, project_id, partner_id)
select distinct dv.organization_id, dv.project_id, dl.partner_id
from public.distribution_lines dl
join public.distribution_versions dv on dv.id = dl.version_id
on conflict (project_id, partner_id) do nothing;

alter table public.project_members enable row level security;
alter table public.project_partners enable row level security;

drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members
  for select using (public.can_access_project(project_id));

drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members
  for insert with check (
    public.can_write_org(organization_id)
    and (
      public.is_org_owner_or_admin(organization_id)
      or public.can_access_project(project_id)
      or not exists (
        select 1 from public.project_members pm where pm.project_id = project_members.project_id
      )
    )
  );

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update using (
    public.can_write_org(organization_id)
    and (
      public.is_org_owner_or_admin(organization_id)
      or public.can_access_project(project_id)
    )
  );

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete using (
    public.can_write_org(organization_id)
    and (
      public.is_org_owner_or_admin(organization_id)
      or public.can_access_project(project_id)
    )
  );

drop policy if exists project_partners_read on public.project_partners;
create policy project_partners_read on public.project_partners
  for select using (public.can_access_project(project_id));

drop policy if exists project_partners_write on public.project_partners;
create policy project_partners_write on public.project_partners
  for insert with check (
    public.can_write_org(organization_id)
    and (
      public.is_org_owner_or_admin(organization_id)
      or public.can_access_project(project_id)
    )
  );

drop policy if exists project_partners_delete on public.project_partners;
create policy project_partners_delete on public.project_partners
  for delete using (
    public.can_write_org(organization_id)
    and (
      public.is_org_owner_or_admin(organization_id)
      or public.can_access_project(project_id)
    )
  );

-- Tighten project access: owners/admins or assigned team/partners.
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select using (public.can_access_project(id));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (public.can_write_org(organization_id) and public.can_access_project(id));

-- Delivery children follow project access.
drop policy if exists milestones_read on public.milestones;
create policy milestones_read on public.milestones
  for select using (public.can_access_project(project_id));
drop policy if exists milestones_write on public.milestones;
create policy milestones_write on public.milestones
  for insert with check (public.can_write_org(organization_id) and public.can_access_project(project_id));
drop policy if exists milestones_update on public.milestones;
create policy milestones_update on public.milestones
  for update using (public.can_write_org(organization_id) and public.can_access_project(project_id));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select using (public.can_access_project(project_id));
drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks
  for insert with check (public.can_write_org(organization_id) and public.can_access_project(project_id));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (public.can_write_org(organization_id) and public.can_access_project(project_id));

drop policy if exists work_logs_read on public.work_logs;
create policy work_logs_read on public.work_logs
  for select using (public.can_access_project(project_id));
drop policy if exists work_logs_write on public.work_logs;
create policy work_logs_write on public.work_logs
  for insert with check (public.can_write_org(organization_id) and public.can_access_project(project_id));
drop policy if exists work_logs_update on public.work_logs;
create policy work_logs_update on public.work_logs
  for update using (public.can_write_org(organization_id) and public.can_access_project(project_id));
