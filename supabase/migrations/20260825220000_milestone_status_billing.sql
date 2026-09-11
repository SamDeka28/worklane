-- Milestone delivery status is independent of billing.
-- Billing is derived from charge_id + charge outstanding (not status='billed').

update public.milestones
set status = 'in_progress'
where status = 'billed';

alter table public.milestones
  drop constraint if exists milestones_status_check;

alter table public.milestones
  add constraint milestones_status_check
  check (status in ('planned', 'in_progress', 'completed', 'cancelled'));
