-- First-join welcome dismiss timestamp (per studio membership).
alter table public.organization_members
  add column if not exists welcomed_at timestamptz;

comment on column public.organization_members.welcomed_at is
  'Set when the member dismisses the first-join studio welcome.';

-- Narrow RPC: members can only set welcomed_at on their own active row.
drop policy if exists organization_members_self_welcome on public.organization_members;

create or replace function public.mark_member_welcomed(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organization_members
  set welcomed_at = coalesce(welcomed_at, now())
  where organization_id = p_organization_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

revoke all on function public.mark_member_welcomed(uuid) from public;
grant execute on function public.mark_member_welcomed(uuid) to authenticated;
