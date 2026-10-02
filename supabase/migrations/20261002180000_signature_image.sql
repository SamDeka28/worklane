alter table public.document_signatures
  add column if not exists signature_image text;
