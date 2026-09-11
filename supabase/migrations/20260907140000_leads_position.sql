-- Lead board ordering within a stage.

alter table public.leads
  add column if not exists position integer not null default 0;

create index if not exists leads_org_stage_position_idx
  on public.leads (organization_id, stage, position);
