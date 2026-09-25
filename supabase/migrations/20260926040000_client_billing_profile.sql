-- Saved billing details per client (address, tax ID, contact, custom fields),
-- used to pre-fill the "Billed to" block on new invoices.
alter table public.clients
  add column if not exists billing jsonb;

comment on column public.clients.billing is
  'Invoice billing profile: {name, contactName, email, phone, address, taxId, extras:[{label,value}]}';
