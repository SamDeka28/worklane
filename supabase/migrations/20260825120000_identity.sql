-- Worklane identity, clients, activity, finance.
-- RLS uses security-definer membership helpers (no recursive policies).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  default_currency text not null default 'USD',
  timezone text not null default 'UTC',
  fiscal_year_start_month integer not null default 1,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_currency_iso check (char_length(default_currency) = 3)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer', 'partner')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer', 'partner')),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.can_write_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin', 'member')
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.can_write_org(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_slug text;
  org_id uuid;
  reserved text[] := array['login','signup','auth','api','brand','onboarding'];
begin
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null default 'company' check (kind in ('company', 'person')),
  name text not null,
  notes text,
  currency text not null default 'USD',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  verb text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  gross_minor bigint not null check (gross_minor >= 0),
  fee_bps integer not null default 0 check (fee_bps >= 0 and fee_bps <= 10000),
  net_minor bigint not null check (net_minor >= 0),
  currency text not null default 'USD',
  charged_on date not null default (timezone('utc', now()))::date,
  due_on date,
  source text not null default 'manual' check (source in ('manual', 'work_log', 'milestone', 'invoice', 'document')),
  status text not null default 'open' check (status in ('open', 'void')),
  memo text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'USD',
  paid_on date not null default (timezone('utc', now()))::date,
  method text not null default 'other' check (method in ('upwork', 'bank', 'stripe', 'other')),
  reference text,
  kind text not null default 'receipt' check (kind in ('receipt', 'refund')),
  status text not null default 'posted' check (status in ('posted', 'void')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  charge_id uuid not null references public.charges (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  unique (payment_id, charge_id)
);

create index if not exists clients_org_name_idx on public.clients (organization_id, name);
create index if not exists charges_org_client_date_idx on public.charges (organization_id, client_id, charged_on);
create index if not exists payments_org_client_date_idx on public.payments (organization_id, client_id, paid_on);
create index if not exists activities_org_created_idx on public.activities (organization_id, created_at desc);
create index if not exists organization_members_user_id_idx on public.organization_members (user_id);

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.activities enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;

create policy organizations_member_read on public.organizations
  for select using (public.is_org_member(id));

create policy organization_members_member_read on public.organization_members
  for select using (public.is_org_member(organization_id));

create policy organization_invitations_admin_read on public.organization_invitations
  for select using (public.can_write_org(organization_id));

create policy clients_read on public.clients
  for select using (public.is_org_member(organization_id));
create policy clients_write on public.clients
  for insert with check (public.can_write_org(organization_id));
create policy clients_update on public.clients
  for update using (public.can_write_org(organization_id));

create policy contacts_read on public.contacts
  for select using (public.is_org_member(organization_id));
create policy contacts_write on public.contacts
  for insert with check (public.can_write_org(organization_id));
create policy contacts_update on public.contacts
  for update using (public.can_write_org(organization_id));
create policy contacts_delete on public.contacts
  for delete using (public.can_write_org(organization_id));

create policy activities_read on public.activities
  for select using (public.is_org_member(organization_id));
create policy activities_write on public.activities
  for insert with check (public.can_write_org(organization_id));

create policy charges_read on public.charges
  for select using (public.is_org_member(organization_id));
create policy charges_write on public.charges
  for insert with check (public.can_write_org(organization_id));
create policy charges_update on public.charges
  for update using (public.can_write_org(organization_id));

create policy payments_read on public.payments
  for select using (public.is_org_member(organization_id));
create policy payments_write on public.payments
  for insert with check (public.can_write_org(organization_id));
create policy payments_update on public.payments
  for update using (public.can_write_org(organization_id));

create policy allocations_read on public.payment_allocations
  for select using (public.is_org_member(organization_id));
create policy allocations_write on public.payment_allocations
  for insert with check (public.can_write_org(organization_id));
