-- More invoice looks: swiss, edge, letterhead, ribbon.
alter table public.invoice_templates drop constraint if exists invoice_templates_layout_check;
alter table public.invoice_templates
  add constraint invoice_templates_layout_check
  check (layout in (
    'classic', 'minimal', 'bold', 'modern', 'elegant', 'studio', 'corporate',
    'swiss', 'edge', 'letterhead', 'ribbon'
  ));

-- Give studios that already have templates one ready-made template per new look.
insert into public.invoice_templates (organization_id, name, layout, is_default, terms, starter_lines)
select orgs.organization_id, seed.name, seed.layout, false, seed.terms, '[]'::jsonb
from (select distinct organization_id from public.invoice_templates) as orgs
cross join (
  values
    ('Swiss', 'swiss', 'Payment due within 14 days.'),
    ('Edge', 'edge', 'Net 14. Thank you for working with us.'),
    ('Letterhead', 'letterhead', 'Payment due within 30 days of invoice date.'),
    ('Ribbon', 'ribbon', 'Thanks! Payment due within 14 days.')
) as seed(name, layout, terms)
where not exists (
  select 1 from public.invoice_templates existing
  where existing.organization_id = orgs.organization_id
    and existing.layout = seed.layout
);
