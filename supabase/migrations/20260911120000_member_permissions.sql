-- Member / invite permissions (module + project-tab level)

alter table public.organization_members
  add column if not exists permissions jsonb;

alter table public.organization_invitations
  add column if not exists permissions jsonb;

comment on column public.organization_members.permissions is
  'Per-member module access. null = full staff defaults for role.';
comment on column public.organization_invitations.permissions is
  'Copied onto organization_members.permissions on accept.';

-- Finance read: owners/admins always; others need finance.access != none in permissions
-- (null permissions = legacy full access via is_org_member)
create or replace function public.can_read_finance(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin')
        or m.permissions is null
        or coalesce(m.permissions->'finance'->>'access', 'write') <> 'none'
      )
  );
$$;

revoke all on function public.can_read_finance(uuid) from public, anon;
grant execute on function public.can_read_finance(uuid) to authenticated;

drop policy if exists charges_read on public.charges;
create policy charges_read on public.charges
  for select using (public.can_read_finance(organization_id));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (public.can_read_finance(organization_id));

-- Partner module gate for non-partner staff with partners.access = none
create or replace function public.can_read_partner(p_org_id uuid, p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin')
        or (
          m.role = 'partner'
          and exists (
            select 1 from public.partners p
            where p.id = p_partner_id
              and p.organization_id = p_org_id
              and p.user_id = auth.uid()
              and p.active
          )
        )
        or (
          m.role in ('member', 'viewer')
          and (
            m.permissions is null
            or coalesce(m.permissions->'partners'->>'access', 'write') <> 'none'
          )
        )
      )
  );
$$;
