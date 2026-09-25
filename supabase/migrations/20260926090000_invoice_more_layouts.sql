-- More invoice looks: modern, elegant, studio, corporate.
alter table public.invoice_templates drop constraint if exists invoice_templates_layout_check;
alter table public.invoice_templates
  add constraint invoice_templates_layout_check
  check (layout in ('classic', 'minimal', 'bold', 'modern', 'elegant', 'studio', 'corporate'));

-- Give studios that already have templates one ready-made template per new look.
insert into public.invoice_templates (organization_id, name, layout, is_default, terms, starter_lines)
select orgs.organization_id, seed.name, seed.layout, false, seed.terms, '[]'::jsonb
from (select distinct organization_id from public.invoice_templates) as orgs
cross join (
  values
    ('Modern', 'modern', 'Payment due within 14 days of invoice date.'),
    ('Elegant', 'elegant', 'With thanks for your business.'),
    ('Studio', 'studio', 'Net 14. Please quote the invoice number with your payment.'),
    ('Corporate', 'corporate', 'Payment due within 30 days. Late payments may incur interest.')
) as seed(name, layout, terms)
where not exists (
  select 1 from public.invoice_templates existing
  where existing.organization_id = orgs.organization_id
    and existing.layout = seed.layout
);
