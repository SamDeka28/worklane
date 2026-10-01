alter table public.projects
  add column if not exists retainer_basis text;

alter table public.projects
  drop constraint if exists projects_retainer_basis_check;

alter table public.projects
  add constraint projects_retainer_basis_check
  check (retainer_basis is null or retainer_basis in ('fixed', 'hourly'));
