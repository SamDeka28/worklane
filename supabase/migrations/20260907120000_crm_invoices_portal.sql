-- CRM leads, invoices + lines, share grants (portal), rich notes columns.

-- ---------------------------------------------------------------------------
-- Rich notes / prose columns on existing tables
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists notes_doc jsonb;

alter table public.projects
  add column if not exists scope_doc jsonb;

alter table public.partners
  add column if not exists notes_doc jsonb;

alter table public.work_logs
  add column if not exists description_doc jsonb;

alter table public.organizations
  add column if not exists invoice_next_number integer not null default 1
    check (invoice_next_number >= 1);

-- ---------------------------------------------------------------------------
-- Leads (CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  company text,
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  source text,
  estimated_value_minor bigint check (estimated_value_minor is null or estimated_value_minor >= 0),
  currency text not null default 'USD',
  close_on date,
  owner_user_id uuid references auth.users (id) on delete set null,
  tags text[] not null default '{}'::text[],
  notes text,
  notes_doc jsonb,
  stage text not null default 'new'
    check (stage in (
      'new', 'contacted', 'discovery', 'qualified',
      'proposal', 'negotiation', 'won', 'lost'
    )),
  client_id uuid references public.clients (id) on delete set null,
  deal_share_bps jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_org_stage_idx
  on public.leads (organization_id, stage, updated_at desc);
create index if not exists leads_org_name_idx
  on public.leads (organization_id, name);
create index if not exists leads_org_owner_idx
  on public.leads (organization_id, owner_user_id)
  where owner_user_id is not null;
create index if not exists leads_org_client_idx
  on public.leads (organization_id, client_id)
  where client_id is not null;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads
  for select using (public.is_org_member(organization_id));
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (public.can_write_org(organization_id));
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update using (public.can_write_org(organization_id));
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete using (public.can_write_org(organization_id));

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  number text not null,
  status text not null default 'draft'
    check (status in (
      'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void'
    )),
  currency text not null default 'USD',
  issued_on date,
  due_on date,
  terms text,
  terms_doc jsonb,
  memo text,
  memo_doc jsonb,
  pdf_file_id uuid,
  issued_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create index if not exists invoices_org_status_idx
  on public.invoices (organization_id, status, issued_on desc nulls last);
create index if not exists invoices_org_client_idx
  on public.invoices (organization_id, client_id);
create index if not exists invoices_org_project_idx
  on public.invoices (organization_id, project_id)
  where project_id is not null;

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  tax_bps integer not null default 0 check (tax_bps >= 0 and tax_bps <= 10000),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  milestone_id uuid references public.milestones (id) on delete set null,
  work_log_id uuid references public.work_logs (id) on delete set null,
  charge_id uuid references public.charges (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invoice_lines_invoice_idx
  on public.invoice_lines (organization_id, invoice_id, position);
create index if not exists invoice_lines_charge_idx
  on public.invoice_lines (organization_id, charge_id)
  where charge_id is not null;

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices
  for select using (public.is_org_member(organization_id));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert with check (public.can_write_org(organization_id));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update using (public.can_write_org(organization_id));

drop policy if exists invoice_lines_read on public.invoice_lines;
create policy invoice_lines_read on public.invoice_lines
  for select using (public.is_org_member(organization_id));
drop policy if exists invoice_lines_insert on public.invoice_lines;
create policy invoice_lines_insert on public.invoice_lines
  for insert with check (public.can_write_org(organization_id));
drop policy if exists invoice_lines_update on public.invoice_lines;
create policy invoice_lines_update on public.invoice_lines
  for update using (public.can_write_org(organization_id));
drop policy if exists invoice_lines_delete on public.invoice_lines;
create policy invoice_lines_delete on public.invoice_lines
  for delete using (public.can_write_org(organization_id));

-- FK for pdf_file_id after files table exists (already in prior migration)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_pdf_file_id_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_pdf_file_id_fkey
      foreign key (pdf_file_id) references public.files (id) on delete set null;
  end if;
exception
  when undefined_table then null;
end $$;

-- ---------------------------------------------------------------------------
-- Share grants (portal tokens — hashed; lookup via service role)
-- ---------------------------------------------------------------------------
create table if not exists public.share_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  token_hash text not null unique,
  label text,
  scope jsonb not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists share_grants_org_idx
  on public.share_grants (organization_id, created_at desc);
create index if not exists share_grants_token_hash_idx
  on public.share_grants (token_hash)
  where revoked_at is null;

alter table public.share_grants enable row level security;

-- Org members manage grants; portal visitors never use anon RLS — server hashes token.
drop policy if exists share_grants_read on public.share_grants;
create policy share_grants_read on public.share_grants
  for select using (public.is_org_member(organization_id));
drop policy if exists share_grants_insert on public.share_grants;
create policy share_grants_insert on public.share_grants
  for insert with check (public.can_write_org(organization_id));
drop policy if exists share_grants_update on public.share_grants;
create policy share_grants_update on public.share_grants
  for update using (public.can_write_org(organization_id));
