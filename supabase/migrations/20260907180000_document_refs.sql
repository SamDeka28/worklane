-- Durable @-mention index for documents (smart tagging, no AI).

create table if not exists public.document_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('client', 'project', 'milestone', 'task')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (document_id, entity_type, entity_id)
);

create index if not exists document_refs_doc_idx
  on public.document_refs (organization_id, document_id);

create index if not exists document_refs_entity_idx
  on public.document_refs (organization_id, entity_type, entity_id);

alter table public.document_refs enable row level security;

drop policy if exists document_refs_read on public.document_refs;
create policy document_refs_read on public.document_refs
  for select using (public.is_org_member(organization_id));

drop policy if exists document_refs_write on public.document_refs;
create policy document_refs_write on public.document_refs
  for insert with check (public.can_write_org(organization_id));

drop policy if exists document_refs_update on public.document_refs;
create policy document_refs_update on public.document_refs
  for update using (public.can_write_org(organization_id));

drop policy if exists document_refs_delete on public.document_refs;
create policy document_refs_delete on public.document_refs
  for delete using (public.can_write_org(organization_id));
