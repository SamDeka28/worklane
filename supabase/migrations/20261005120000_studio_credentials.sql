-- Credentials can live on the studio, or on a project. A project is optional.

alter table public.project_credentials
  alter column project_id drop not null;

alter table public.project_credential_events
  alter column project_id drop not null;

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
          and (c.project_id is null or public.can_access_project(c.project_id))
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

drop policy if exists project_credentials_insert on public.project_credentials;
create policy project_credentials_insert on public.project_credentials
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_write_org(organization_id)
    and public.can_use_credentials(organization_id)
    and (
      project_id is null
      or (
        public.can_access_project(project_id)
        and exists (
          select 1 from public.projects p
          where p.id = project_id and p.organization_id = project_credentials.organization_id
        )
      )
    )
  );

create or replace function public.project_credentials_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by
    or new.organization_id <> old.organization_id then
    raise exception 'Credential owner cannot be changed';
  end if;
  if new.project_id is distinct from old.project_id then
    if auth.uid() is not null and not public.can_manage_credential(old.id) then
      raise exception 'Only owners, admins, or the creator can move a credential';
    end if;
    if new.project_id is not null and not exists (
      select 1 from public.projects p
      where p.id = new.project_id and p.organization_id = new.organization_id
    ) then
      raise exception 'That project is not in this studio';
    end if;
  end if;
  if new.restricted is distinct from old.restricted
    and auth.uid() is not null
    and not public.can_manage_credential(old.id) then
    raise exception 'Only owners, admins, or the creator can change who sees a credential';
  end if;
  return new;
end;
$$;
