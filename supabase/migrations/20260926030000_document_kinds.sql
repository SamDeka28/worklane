-- Industry-standard document kinds, each with its own starter template.
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents
  add constraint documents_kind_check
  check (kind in ('proposal', 'sow', 'contract', 'nda', 'brief', 'change_order', 'report', 'other'));
