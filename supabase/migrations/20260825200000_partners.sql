-- Partners ledger: parties, distribution versions/lines, allocations, settlements.
-- Client receipts never settle partners. Payable = earned − settled (derived).

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  kind text not null default 'participant'
    check (kind in ('originator', 'participant', 'referral')),
  user_id uuid references auth.users (id) on delete set null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_org_name_idx
  on public.partners (organization_id, name);
create index if not exists partners_org_user_idx
  on public.partners (organization_id, user_id)
  where user_id is not null;

drop trigger if exists partners_updated_at on public.partners;
create trigger partners_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

-- Project-level or charge-level split versions. History is append-only.
create table if not exists public.distribution_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  charge_id uuid references public.charges (id) on delete cascade,
  label text,
  effective_on date not null default (timezone('utc', now()))::date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists distribution_versions_project_idx
  on public.distribution_versions (organization_id, project_id, effective_on desc, created_at desc);
create index if not exists distribution_versions_charge_idx
  on public.distribution_versions (organization_id, charge_id)
  where charge_id is not null;

create table if not exists public.distribution_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_id uuid not null references public.distribution_versions (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete restrict,
  share_bps integer not null check (share_bps >= 0 and share_bps <= 10000),
  unique (version_id, partner_id)
);

create index if not exists distribution_lines_version_idx
  on public.distribution_lines (organization_id, version_id);

create table if not exists public.partner_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete restrict,
  distribution_version_id uuid not null references public.distribution_versions (id) on delete restrict,
  charge_id uuid not null references public.charges (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,
  payment_allocation_id uuid references public.payment_allocations (id) on delete set null,
  earned_minor bigint not null check (earned_minor >= 0),
  currency text not null default 'USD',
  earned_on date not null,
  status text not null default 'posted' check (status in ('posted', 'void')),
  created_at timestamptz not null default now()
);

create index if not exists partner_allocations_partner_date_idx
  on public.partner_allocations (organization_id, partner_id, earned_on);
create index if not exists partner_allocations_charge_idx
  on public.partner_allocations (organization_id, charge_id);
create unique index if not exists partner_allocations_charge_partner_uidx
  on public.partner_allocations (charge_id, partner_id)
  where status = 'posted' and payment_id is null;
create unique index if not exists partner_allocations_pa_partner_uidx
  on public.partner_allocations (payment_allocation_id, partner_id)
  where status = 'posted' and payment_allocation_id is not null;

create table if not exists public.partner_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'USD',
  settled_on date not null default (timezone('utc', now()))::date,
  method text not null default 'other' check (method in ('upwork', 'bank', 'stripe', 'other')),
  memo text,
  status text not null default 'posted' check (status in ('posted', 'void')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists partner_settlements_partner_date_idx
  on public.partner_settlements (organization_id, partner_id, settled_on);

-- Partner role sees only own linked partner rows; others see all org partners.
create or replace function public.can_read_partner(p_org_id uuid, p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin', 'member', 'viewer')
        or exists (
          select 1 from public.partners p
          where p.id = p_partner_id
            and p.organization_id = p_org_id
            and p.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_read_partner(uuid, uuid) from public, anon;
grant execute on function public.can_read_partner(uuid, uuid) to authenticated;

alter table public.partners enable row level security;
alter table public.distribution_versions enable row level security;
alter table public.distribution_lines enable row level security;
alter table public.partner_allocations enable row level security;
alter table public.partner_settlements enable row level security;

drop policy if exists partners_read on public.partners;
create policy partners_read on public.partners
  for select using (public.can_read_partner(organization_id, id));
drop policy if exists partners_write on public.partners;
create policy partners_write on public.partners
  for insert with check (public.can_write_org(organization_id));
drop policy if exists partners_update on public.partners;
create policy partners_update on public.partners
  for update using (public.can_write_org(organization_id));

drop policy if exists distribution_versions_read on public.distribution_versions;
create policy distribution_versions_read on public.distribution_versions
  for select using (public.can_write_org(organization_id));
drop policy if exists distribution_versions_write on public.distribution_versions;
create policy distribution_versions_write on public.distribution_versions
  for insert with check (public.can_write_org(organization_id));

drop policy if exists distribution_lines_read on public.distribution_lines;
create policy distribution_lines_read on public.distribution_lines
  for select using (public.can_write_org(organization_id));
drop policy if exists distribution_lines_write on public.distribution_lines;
create policy distribution_lines_write on public.distribution_lines
  for insert with check (public.can_write_org(organization_id));

drop policy if exists partner_allocations_read on public.partner_allocations;
create policy partner_allocations_read on public.partner_allocations
  for select using (public.can_read_partner(organization_id, partner_id));
drop policy if exists partner_allocations_write on public.partner_allocations;
create policy partner_allocations_write on public.partner_allocations
  for insert with check (public.can_write_org(organization_id));
drop policy if exists partner_allocations_update on public.partner_allocations;
create policy partner_allocations_update on public.partner_allocations
  for update using (public.can_write_org(organization_id));

drop policy if exists partner_settlements_read on public.partner_settlements;
create policy partner_settlements_read on public.partner_settlements
  for select using (public.can_read_partner(organization_id, partner_id));
drop policy if exists partner_settlements_write on public.partner_settlements;
create policy partner_settlements_write on public.partner_settlements
  for insert with check (public.can_write_org(organization_id));
drop policy if exists partner_settlements_update on public.partner_settlements;
create policy partner_settlements_update on public.partner_settlements
  for update using (public.can_write_org(organization_id));
