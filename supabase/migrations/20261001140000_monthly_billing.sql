alter table public.projects drop constraint if exists projects_billing_mode_check;

alter table public.projects
  add constraint projects_billing_mode_check
  check (billing_mode in ('none', 'single_charge', 'milestones', 'hourly', 'manual', 'monthly'));
