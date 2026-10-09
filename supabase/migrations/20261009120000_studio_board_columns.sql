-- Studio-wide board lists. Project columns can point at one shared id
-- so project boards and the studio board show the same columns.

alter table public.project_columns
  add column if not exists studio_column_id text;

create unique index if not exists project_columns_studio_uidx
  on public.project_columns (project_id, studio_column_id)
  where studio_column_id is not null;

create or replace function public.seed_project_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_board jsonb;
  v_col jsonb;
  v_index integer := 0;
  v_key text;
  v_seen text[] := array[]::text[];
begin
  select settings->'board' into v_board
  from public.organizations
  where id = new.organization_id;

  if coalesce(v_board->>'shared', 'false') = 'true'
     and jsonb_typeof(v_board->'columns') = 'array'
     and jsonb_array_length(v_board->'columns') > 0 then
    for v_col in select value from jsonb_array_elements(v_board->'columns')
    loop
      v_key := case
        when v_col->>'systemKey' in ('todo', 'doing', 'done') then v_col->>'systemKey'
        else null
      end;
      if v_key is not null and v_key = any (v_seen) then
        continue;
      end if;
      if v_key is not null then
        v_seen := v_seen || v_key;
      end if;
      insert into public.project_columns (
        organization_id, project_id, name, position, system_key, studio_column_id
      ) values (
        new.organization_id,
        new.id,
        coalesce(nullif(btrim(v_col->>'name'), ''), 'List'),
        coalesce((v_col->>'position')::integer, v_index),
        v_key,
        nullif(v_col->>'id', '')
      );
      v_index := v_index + 1;
    end loop;
    return new;
  end if;

  insert into public.project_columns (organization_id, project_id, name, position, system_key)
  values
    (new.organization_id, new.id, 'To do', 0, 'todo'),
    (new.organization_id, new.id, 'Doing', 1, 'doing'),
    (new.organization_id, new.id, 'Done', 2, 'done');
  return new;
end;
$$;

revoke execute on function public.seed_project_columns() from public, anon, authenticated;
