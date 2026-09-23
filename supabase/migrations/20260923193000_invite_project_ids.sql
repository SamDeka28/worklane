-- Multi-project invite access (studio membership + optional project list).
alter table public.organization_invitations
  add column if not exists project_ids uuid[] not null default '{}'::uuid[];

comment on column public.organization_invitations.project_ids is
  'Projects to grant on accept. project_id remains the primary/first for backward compatibility.';

update public.organization_invitations
set project_ids = array[project_id]
where project_id is not null
  and cardinality(project_ids) = 0;

drop function if exists public.preview_organization_invitation(text);

create function public.preview_organization_invitation(p_token_hash text)
returns table (
  id uuid,
  email text,
  role text,
  organization_id uuid,
  project_id uuid,
  project_ids uuid[],
  project_role text,
  partner_id uuid,
  permissions jsonb,
  expires_at timestamptz,
  accepted_at timestamptz,
  org_id uuid,
  org_slug text,
  org_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.id,
    i.email,
    i.role,
    i.organization_id,
    i.project_id,
    coalesce(
      nullif(i.project_ids, '{}'::uuid[]),
      case when i.project_id is not null then array[i.project_id] else '{}'::uuid[] end
    ),
    i.project_role,
    i.partner_id,
    i.permissions,
    i.expires_at,
    i.accepted_at,
    o.id,
    o.slug,
    o.name
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = p_token_hash
  limit 1;
$$;

revoke all on function public.preview_organization_invitation(text) from public;
grant execute on function public.preview_organization_invitation(text) to anon, authenticated;

create or replace function public.accept_organization_invitation(p_token_hash text)
returns table (org_slug text, org_name text, project_id uuid, already_member boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  inv public.organization_invitations%rowtype;
  org public.organizations%rowtype;
  v_already boolean := false;
  v_pids uuid[];
  v_pid uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null or v_email = '' then
    raise exception 'Account has no email';
  end if;

  select * into inv
  from public.organization_invitations
  where token_hash = p_token_hash
  limit 1;

  if not found then
    raise exception 'Invite not found';
  end if;

  if inv.expires_at is not null and inv.expires_at < now() and inv.accepted_at is null then
    raise exception 'Invite expired';
  end if;

  if lower(inv.email) <> v_email then
    raise exception 'Sign in as % to accept this invite', inv.email;
  end if;

  select * into org from public.organizations where id = inv.organization_id;
  if not found then
    raise exception 'Studio not found';
  end if;

  select exists(
    select 1 from public.organization_members m
    where m.organization_id = inv.organization_id
      and m.user_id = v_uid
      and m.status = 'active'
  ) into v_already;

  insert into public.organization_members (
    organization_id, user_id, role, status, permissions
  ) values (
    inv.organization_id, v_uid, inv.role, 'active', inv.permissions
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        permissions = coalesce(excluded.permissions, organization_members.permissions);

  v_pids := coalesce(nullif(inv.project_ids, '{}'::uuid[]),
    case when inv.project_id is not null then array[inv.project_id] else '{}'::uuid[] end);

  foreach v_pid in array v_pids loop
    insert into public.project_members (
      organization_id, project_id, user_id, role
    ) values (
      inv.organization_id,
      v_pid,
      v_uid,
      case when inv.project_role = 'lead' then 'lead' else 'member' end
    )
    on conflict (project_id, user_id) do update
      set role = excluded.role;
  end loop;

  if inv.partner_id is not null then
    update public.partners
    set user_id = v_uid, email = v_email
    where id = inv.partner_id
      and organization_id = inv.organization_id;
  end if;

  update public.organization_invitations
  set accepted_at = coalesce(accepted_at, now())
  where id = inv.id;

  insert into public.profiles (id, email, display_name)
  values (
    v_uid,
    v_email,
    split_part(v_email, '@', 1)
  )
  on conflict (id) do update
    set email = excluded.email;

  org_slug := org.slug;
  org_name := org.name;
  project_id := case when cardinality(v_pids) > 0 then v_pids[1] else null end;
  already_member := v_already;
  return next;
end;
$$;

create or replace function public.claim_my_organization_invitations()
returns table (org_slug text, org_name text, project_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  inv record;
  v_pids uuid[];
  v_pid uuid;
begin
  if v_uid is null then
    return;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null or v_email = '' then
    return;
  end if;

  for inv in
    select i.*, o.slug as o_slug, o.name as o_name
    from public.organization_invitations i
    join public.organizations o on o.id = i.organization_id
    where lower(i.email) = v_email
      and not exists (
        select 1 from public.organization_members m
        where m.organization_id = i.organization_id
          and m.user_id = v_uid
          and m.status = 'active'
      )
    order by i.accepted_at nulls first, i.created_at desc
  loop
    if inv.accepted_at is null and inv.expires_at is not null and inv.expires_at < now() then
      continue;
    end if;

    insert into public.organization_members (
      organization_id, user_id, role, status, permissions
    ) values (
      inv.organization_id, v_uid, inv.role, 'active', inv.permissions
    )
    on conflict (organization_id, user_id) do update
      set role = excluded.role,
          status = 'active',
          permissions = coalesce(excluded.permissions, organization_members.permissions);

    v_pids := coalesce(nullif(inv.project_ids, '{}'::uuid[]),
      case when inv.project_id is not null then array[inv.project_id] else '{}'::uuid[] end);

    foreach v_pid in array v_pids loop
      insert into public.project_members (
        organization_id, project_id, user_id, role
      ) values (
        inv.organization_id,
        v_pid,
        v_uid,
        case when inv.project_role = 'lead' then 'lead' else 'member' end
      )
      on conflict (project_id, user_id) do update
        set role = excluded.role;
    end loop;

    if inv.partner_id is not null then
      update public.partners
      set user_id = v_uid, email = v_email
      where id = inv.partner_id
        and organization_id = inv.organization_id;
    end if;

    update public.organization_invitations
    set accepted_at = coalesce(accepted_at, now())
    where id = inv.id;

    insert into public.profiles (id, email, display_name)
    values (v_uid, v_email, split_part(v_email, '@', 1))
    on conflict (id) do update set email = excluded.email;

    org_slug := inv.o_slug;
    org_name := inv.o_name;
    project_id := case when cardinality(v_pids) > 0 then v_pids[1] else null end;
    return next;
  end loop;
end;
$$;
