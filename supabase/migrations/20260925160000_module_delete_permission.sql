-- Per-module delete permission: owners/admins always; members need write access
-- plus `permissions -> module -> delete = true`. Partners and viewers never.
create or replace function public.can_delete_module(p_org_id uuid, p_module text)
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
          m.role = 'member'
          and m.permissions -> p_module ->> 'access' = 'write'
          and coalesce((m.permissions -> p_module ->> 'delete')::boolean, false)
        )
      )
  );
$$;

revoke all on function public.can_delete_module(uuid, text) from public;
grant execute on function public.can_delete_module(uuid, text) to authenticated;

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete
  using (public.can_delete_module(organization_id, 'delivery'));

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete
  using (public.can_delete_module(organization_id, 'crm'));

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete
  using (public.can_delete_module(organization_id, 'crm'));

drop policy if exists partners_delete on public.partners;
create policy partners_delete on public.partners
  for delete
  using (public.can_delete_module(organization_id, 'partners'));
