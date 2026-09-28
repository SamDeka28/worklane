-- Time tracking on hourly projects: logs point at the task they cover and keep
-- when the work started and ended. A task carries the clock started by moving it
-- into progress; stopped-but-unlogged sessions keep time_stopped_at until logged.
alter table public.work_logs
  add column if not exists task_id uuid references public.tasks (id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;

alter table public.work_logs drop constraint if exists work_logs_time_order;
alter table public.work_logs
  add constraint work_logs_time_order
    check (started_at is null or ended_at is null or ended_at > started_at);

create index if not exists work_logs_task_idx
  on public.work_logs (task_id) where task_id is not null;

alter table public.tasks
  add column if not exists time_started_at timestamptz,
  add column if not exists time_stopped_at timestamptz;

alter table public.tasks drop constraint if exists tasks_time_order;
alter table public.tasks
  add constraint tasks_time_order
    check (
      time_stopped_at is null
      or (time_started_at is not null and time_stopped_at >= time_started_at)
    );
