-- Reserve the public /docs route (and keep both slug generators in sync).
-- Also lowercase before stripping so capital letters survive in slugs.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_slug text;
  org_id uuid;
  reserved text[] := array[
    'login','signup','auth','api','brand','onboarding','invite','app','portal','docs'
  ];
  skip_org boolean;
  meta_name text;
  meta_avatar text;
begin
  meta_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'org_name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  meta_avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', '')
  );

  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    meta_name,
    meta_avatar
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        updated_at = now();

  skip_org := coalesce((new.raw_user_meta_data->>'skip_org')::boolean, false)
    or nullif(new.raw_user_meta_data->>'invite_token', '') is not null
    or exists (
      select 1
      from public.organization_invitations i
      where i.accepted_at is null
        and lower(i.email) = lower(coalesce(new.email, ''))
        and (i.expires_at is null or i.expires_at > now())
    );

  if skip_org then
    return new;
  end if;

  new_slug := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
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
    coalesce(nullif(new.raw_user_meta_data->>'org_name', ''), 'Worklane Studio'),
    'USD',
    'UTC',
    '{"modules":{"crm":true,"documents":true,"delivery":true,"finance":true,"partners":true,"portal":false}}'::jsonb
  )
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (org_id, new.id, 'owner', 'active');

  return new;
end;
$$;

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
    'login','signup','auth','api','brand','onboarding','invite','app','portal','docs'
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

  new_slug := regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g');
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
