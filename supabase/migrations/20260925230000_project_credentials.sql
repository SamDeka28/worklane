-- Project credential vault.
-- Metadata is RLS-scoped per credential; encrypted secrets live in a table with no
-- client grants at all (service role only), so ciphertext never leaves the server.

create table if not exists public.project_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null default 'login'
    check (kind in ('login', 'api_key', 'database', 'server', 'email', 'other')),
  url text check (url is null or char_length(url) <= 500),
  restricted boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  secret_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_credentials_project_idx
  on public.project_credentials (project_id);
create index if not exists project_credentials_org_idx
  on public.project_credentials (organization_id);

create table if not exists public.project_credential_secrets (
  credential_id uuid primary key references public.project_credentials (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key_version smallint not null default 1,
  iv text not null,
  auth_tag text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_credential_access (
  credential_id uuid not null references public.project_credentials (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (credential_id, user_id)
);

create index if not exists project_credential_access_user_idx
  on public.project_credential_access (user_id);

create table if not exists public.project_credential_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  credential_id uuid references public.project_credentials (id) on delete set null,
  credential_name text not null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null
    check (action in ('created', 'updated', 'revealed', 'copied', 'deleted', 'access_changed')),
  created_at timestamptz not null default now()
);

create index if not exists project_credential_events_cred_idx
  on public.project_credential_events (credential_id, created_at desc);
create index if not exists project_credential_events_project_idx
  on public.project_credential_events (project_id, created_at desc);

-- Credentials tab gate: owners/admins always; members unless the tab is switched off;
-- partners only when the tab is explicitly granted.
create or replace function public.can_use_credentials(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin')
        or (
          m.role in ('member', 'viewer')
          and (
            m.permissions is null
            or (
              coalesce(m.permissions -> 'delivery' ->> 'access', 'none') <> 'none'
              and coalesce((m.permissions -> 'delivery' -> 'tabs' ->> 'credentials')::boolean, true)
            )
          )
        )
        or (
          m.role = 'partner'
          and coalesce(m.permissions -> 'delivery' ->> 'access', 'none') <> 'none'
          and coalesce((m.permissions -> 'delivery' -> 'tabs' ->> 'credentials')::boolean, false)
        )
      )
  );
$$;

create or replace function public.can_view_credential(p_credential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_credentials c
    where c.id = p_credential_id
      and (
        public.is_org_owner_or_admin(c.organization_id)
        or (
          public.can_use_credentials(c.organization_id)
          and public.can_access_project(c.project_id)
          and (
            not c.restricted
            or c.created_by = auth.uid()
            or exists (
              select 1
              from public.project_credential_access a
              where a.credential_id = c.id
                and a.user_id = auth.uid()
            )
          )
        )
      )
  );
$$;

-- Delete and access changes: owners/admins, or the writer who created it.
create or replace function public.can_manage_credential(p_credential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_credentials c
    where c.id = p_credential_id
      and (
        public.is_org_owner_or_admin(c.organization_id)
        or (
          c.created_by = auth.uid()
          and public.can_write_org(c.organization_id)
          and public.can_view_credential(c.id)
        )
      )
  );
$$;

revoke execute on function public.can_use_credentials(uuid) from public, anon;
revoke execute on function public.can_view_credential(uuid) from public, anon;
revoke execute on function public.can_manage_credential(uuid) from public, anon;
grant execute on function public.can_use_credentials(uuid) to authenticated;
grant execute on function public.can_view_credential(uuid) to authenticated;
grant execute on function public.can_manage_credential(uuid) to authenticated;

alter table public.project_credentials enable row level security;
alter table public.project_credential_secrets enable row level security;
alter table public.project_credential_access enable row level security;
alter table public.project_credential_events enable row level security;

-- Secrets: no policies and no grants for client roles.
revoke all on table public.project_credential_secrets from anon, authenticated;
-- Audit log is append-only via the service role.
revoke insert, update, delete on table public.project_credential_events from anon, authenticated;
revoke all on table public.project_credentials from anon;
revoke all on table public.project_credential_access from anon;
revoke all on table public.project_credential_events from anon;

drop policy if exists project_credentials_select on public.project_credentials;
create policy project_credentials_select on public.project_credentials
  for select to authenticated
  using (public.can_view_credential(id));

drop policy if exists project_credentials_insert on public.project_credentials;
create policy project_credentials_insert on public.project_credentials
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_write_org(organization_id)
    and public.can_use_credentials(organization_id)
    and public.can_access_project(project_id)
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.organization_id = project_credentials.organization_id
    )
  );

drop policy if exists project_credentials_update on public.project_credentials;
create policy project_credentials_update on public.project_credentials
  for update to authenticated
  using (public.can_write_org(organization_id) and public.can_view_credential(id))
  with check (public.can_write_org(organization_id) and public.can_view_credential(id));

drop policy if exists project_credentials_delete on public.project_credentials;
create policy project_credentials_delete on public.project_credentials
  for delete to authenticated
  using (public.can_manage_credential(id));

drop policy if exists project_credential_access_select on public.project_credential_access;
create policy project_credential_access_select on public.project_credential_access
  for select to authenticated
  using (public.can_view_credential(credential_id));

drop policy if exists project_credential_access_insert on public.project_credential_access;
create policy project_credential_access_insert on public.project_credential_access
  for insert to authenticated
  with check (
    public.can_manage_credential(credential_id)
    and exists (
      select 1 from public.project_credentials c
      where c.id = credential_id and c.organization_id = project_credential_access.organization_id
    )
  );

drop policy if exists project_credential_access_delete on public.project_credential_access;
create policy project_credential_access_delete on public.project_credential_access
  for delete to authenticated
  using (public.can_manage_credential(credential_id));

drop policy if exists project_credential_events_select on public.project_credential_events;
create policy project_credential_events_select on public.project_credential_events
  for select to authenticated
  using (
    public.is_org_owner_or_admin(organization_id)
    or (credential_id is not null and public.can_manage_credential(credential_id))
  );

-- Direct PostgREST updates can't widen access or take over a credential.
create or replace function public.project_credentials_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by
    or new.organization_id <> old.organization_id
    or new.project_id <> old.project_id then
    raise exception 'Credential owner and project cannot be changed';
  end if;
  if new.restricted is distinct from old.restricted
    and auth.uid() is not null
    and not public.can_manage_credential(old.id) then
    raise exception 'Only owners, admins, or the creator can change who sees a credential';
  end if;
  return new;
end;
$$;

revoke execute on function public.project_credentials_guard() from public, anon, authenticated;

drop trigger if exists project_credentials_guard on public.project_credentials;
create trigger project_credentials_guard
  before update on public.project_credentials
  for each row execute function public.project_credentials_guard();

comment on table public.project_credential_secrets is
  'AES-256-GCM ciphertext for project credentials. Service role only; decrypted server-side after an RLS access check.';
