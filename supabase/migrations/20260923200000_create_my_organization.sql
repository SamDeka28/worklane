-- Let any authenticated user create an additional organization (owner).

create or replace function public.create_my_organization(p_name text)
returns table (org_id uuid, org_slug text, org_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_slug text;
  new_id uuid;
  clean_name text;
  reserved text[] := array[
    'login','signup','auth','api','brand','onboarding','invite','app','portal'
  ];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  clean_name := trim(coalesce(p_name, ''));
  if clean_name = '' then
    raise exception 'Organization name is required';
  end if;
  if char_length(clean_name) > 80 then
    raise exception 'Keep the name under 80 characters';
  end if;

  new_slug := lower(regexp_replace(clean_name, '[^a-z0-9]+', '-', 'g'));
  new_slug := trim(both '-' from new_slug);
  if new_slug is null or new_slug = '' or new_slug = any(reserved) then
    new_slug := 'studio';
  end if;
  while exists (select 1 from public.organizations where slug = new_slug) loop
    new_slug := new_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  end loop;

  insert into public.organizations (slug, name, default_currency, timezone, settings)
  values (
    new_slug,
    clean_name,
    'USD',
    'UTC',
    '{"modules":{"crm":true,"documents":true,"delivery":true,"finance":true,"partners":true,"portal":false}}'::jsonb
  )
  returning id into new_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_id, uid, 'owner', 'active');

  return query
  select new_id, new_slug, clean_name;
end;
$$;

revoke all on function public.create_my_organization(text) from public;
grant execute on function public.create_my_organization(text) to authenticated;

comment on function public.create_my_organization(text) is
  'Creates a new organization owned by the caller; used from the studio switcher.';
