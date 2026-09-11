-- Harden project-access helpers + board columns follow project access.

revoke all on function public.is_org_owner_or_admin(uuid) from public, anon;
revoke all on function public.can_access_project(uuid) from public, anon;
grant execute on function public.is_org_owner_or_admin(uuid) to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;

drop policy if exists project_columns_read on public.project_columns;
create policy project_columns_read on public.project_columns
  for select using (public.can_access_project(project_id));

drop policy if exists project_columns_write on public.project_columns;
create policy project_columns_write on public.project_columns
  for insert with check (public.can_write_org(organization_id) and public.can_access_project(project_id));

drop policy if exists project_columns_update on public.project_columns;
create policy project_columns_update on public.project_columns
  for update using (public.can_write_org(organization_id) and public.can_access_project(project_id));

drop policy if exists project_columns_delete on public.project_columns;
create policy project_columns_delete on public.project_columns
  for delete using (public.can_write_org(organization_id) and public.can_access_project(project_id));
