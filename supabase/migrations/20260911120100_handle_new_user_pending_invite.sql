-- Also skip auto-org when a pending invite matches the new user's email (Google OAuth invites)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_slug text;
  org_id uuid;
  reserved text[] := array['login','signup','auth','api','brand','onboarding','invite'];
  skip_org boolean;
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'org_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
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

  new_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
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
