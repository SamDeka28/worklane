-- Card kind (fixed set; open to org-defined kinds later) + freeform labels.
alter table public.tasks
  add column if not exists kind text not null default 'task',
  add column if not exists labels text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_kind_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_kind_check
      check (kind in ('task', 'bug', 'feature', 'chore'));
  end if;
end $$;
