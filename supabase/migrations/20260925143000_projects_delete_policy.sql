-- Owners and admins can delete projects. Milestones, tasks, work logs, splits, and
-- project membership cascade; charges, invoices, and documents are kept (project_id set null).
-- Recorded partner allocations restrict the delete via distribution_versions.
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete
  using (public.is_org_owner_or_admin(organization_id));
