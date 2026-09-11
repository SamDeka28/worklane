-- Partner contact + login invites (email → org membership as partner role).

alter table public.partners
  add column if not exists email text;

create unique index if not exists partners_org_email_uidx
  on public.partners (organization_id, lower(email))
  where email is not null;

alter table public.organization_invitations
  add column if not exists partner_id uuid references public.partners (id) on delete set null;

create index if not exists organization_invitations_partner_idx
  on public.organization_invitations (organization_id, partner_id)
  where partner_id is not null;
