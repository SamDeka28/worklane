-- Invoice studio: brand snapshot on invoices + reusable templates.

alter table public.invoices
  add column if not exists brand_snapshot jsonb;

alter table public.invoices
  add column if not exists template_id uuid;

create table if not exists public.invoice_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  layout text not null default 'classic'
    check (layout in ('classic', 'minimal', 'bold')),
  accent_hex text,
  default_due_days integer check (default_due_days is null or default_due_days >= 0),
  default_tax_bps integer check (
    default_tax_bps is null or (default_tax_bps >= 0 and default_tax_bps <= 10000)
  ),
  terms text,
  terms_doc jsonb,
  memo text,
  memo_doc jsonb,
  starter_lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists invoice_templates_org_idx
  on public.invoice_templates (organization_id, is_default desc, name);

drop trigger if exists invoice_templates_updated_at on public.invoice_templates;
create trigger invoice_templates_updated_at
  before update on public.invoice_templates
  for each row execute function public.set_updated_at();

alter table public.invoice_templates enable row level security;

drop policy if exists invoice_templates_read on public.invoice_templates;
create policy invoice_templates_read on public.invoice_templates
  for select using (public.is_org_member(organization_id));

drop policy if exists invoice_templates_insert on public.invoice_templates;
create policy invoice_templates_insert on public.invoice_templates
  for insert with check (public.can_write_org(organization_id));

drop policy if exists invoice_templates_update on public.invoice_templates;
create policy invoice_templates_update on public.invoice_templates
  for update using (public.can_write_org(organization_id));

drop policy if exists invoice_templates_delete on public.invoice_templates;
create policy invoice_templates_delete on public.invoice_templates
  for delete using (public.can_write_org(organization_id));

-- Optional FK after templates exist (nullable; copy-on-apply still primary).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_template_id_fkey'
  ) then
    alter table public.invoices
      add constraint invoices_template_id_fkey
      foreign key (template_id) references public.invoice_templates (id)
      on delete set null;
  end if;
end $$;

create index if not exists invoices_org_template_idx
  on public.invoices (organization_id, template_id)
  where template_id is not null;
