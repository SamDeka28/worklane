-- Multi-assignee: array of project member user ids (primary assignee_user_id kept in sync as first).
alter table public.tasks
  add column if not exists assignee_user_ids uuid[] not null default '{}';

update public.tasks
set assignee_user_ids = array[assignee_user_id]
where assignee_user_id is not null
  and cardinality(assignee_user_ids) = 0;

create index if not exists tasks_assignee_user_ids_gin
  on public.tasks using gin (assignee_user_ids);
