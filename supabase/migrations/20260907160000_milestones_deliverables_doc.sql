-- Rich deliverables on milestones (TipTap JSON + plain text mirror).
alter table public.milestones
  add column if not exists deliverables_doc jsonb;
