-- Owners and admins can permanently delete clients and partners. Financial history
-- (charges, invoices, payments, projects, split lines, allocations, settlements)
-- restricts the delete at the FK level, so only unused records can go.
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete
  using (public.is_org_owner_or_admin(organization_id));

drop policy if exists partners_delete on public.partners;
create policy partners_delete on public.partners
  for delete
  using (public.is_org_owner_or_admin(organization_id));

-- Owners and admins can remove members; the owner membership is never removable.
drop policy if exists organization_members_delete on public.organization_members;
create policy organization_members_delete on public.organization_members
  for delete
  using (public.is_org_owner_or_admin(organization_id) and role <> 'owner');
