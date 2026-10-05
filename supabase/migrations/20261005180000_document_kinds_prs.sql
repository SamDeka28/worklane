-- Product and software requirements, plus a document-kind invoice.
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents
  add constraint documents_kind_check
  check (kind in (
    'proposal',
    'sow',
    'contract',
    'nda',
    'brief',
    'change_order',
    'report',
    'prs',
    'srs',
    'invoice',
    'other'
  ));
