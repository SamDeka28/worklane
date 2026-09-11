-- Polymorphic files + rich task docs + documents engine.

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null,
  name text not null,
  mime text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  visibility text not null default 'internal'
    check (visibility in ('internal', 'shared')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists files_entity_idx
  on public.files (organization_id, entity_type, entity_id)
  where deleted_at is null;

alter table public.tasks
  add column if not exists description_doc jsonb;

alter table public.task_comments
  add column if not exists body_doc jsonb,
  add column if not exists body_text text;

update public.task_comments
set body_text = body
where body_text is null;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null default 'proposal'
    check (kind in ('proposal', 'sow', 'other')),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'signed', 'void')),
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  source_document_id uuid references public.documents (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_org_status_idx
  on public.documents (organization_id, status, updated_at desc);

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  version_number integer not null default 1,
  content_doc jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  snapshot jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'signed', 'void')),
  pdf_file_id uuid references public.files (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (document_id, version_number)
);

create index if not exists document_versions_doc_idx
  on public.document_versions (organization_id, document_id, version_number desc);

create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  signer_name text not null,
  signer_email text not null,
  intent_text text not null,
  signed_at timestamptz not null default now(),
  user_agent text,
  provider_id text,
  created_at timestamptz not null default now()
);

create index if not exists document_signatures_version_idx
  on public.document_signatures (organization_id, document_version_id);

alter table public.files enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_signatures enable row level security;

drop policy if exists files_read on public.files;
create policy files_read on public.files
  for select using (public.is_org_member(organization_id));
drop policy if exists files_write on public.files;
create policy files_write on public.files
  for insert with check (public.can_write_org(organization_id));
drop policy if exists files_update on public.files;
create policy files_update on public.files
  for update using (public.can_write_org(organization_id));

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select using (public.is_org_member(organization_id));
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for insert with check (public.can_write_org(organization_id));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update using (public.can_write_org(organization_id));

drop policy if exists document_versions_read on public.document_versions;
create policy document_versions_read on public.document_versions
  for select using (public.is_org_member(organization_id));
drop policy if exists document_versions_write on public.document_versions;
create policy document_versions_write on public.document_versions
  for insert with check (public.can_write_org(organization_id));
drop policy if exists document_versions_update on public.document_versions;
create policy document_versions_update on public.document_versions
  for update using (public.can_write_org(organization_id));

drop policy if exists document_signatures_read on public.document_signatures;
create policy document_signatures_read on public.document_signatures
  for select using (public.is_org_member(organization_id));
drop policy if exists document_signatures_write on public.document_signatures;
create policy document_signatures_write on public.document_signatures
  for insert with check (public.can_write_org(organization_id));

-- Storage bucket for org files (policies applied when bucket exists).
insert into storage.buckets (id, name, public)
values ('org-files', 'org-files', false)
on conflict (id) do nothing;

drop policy if exists org_files_read on storage.objects;
create policy org_files_read on storage.objects
  for select using (
    bucket_id = 'org-files'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists org_files_write on storage.objects;
create policy org_files_write on storage.objects
  for insert with check (
    bucket_id = 'org-files'
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  );

drop policy if exists org_files_update on storage.objects;
create policy org_files_update on storage.objects
  for update using (
    bucket_id = 'org-files'
    and public.can_write_org((storage.foldername(name))[1]::uuid)
  );
