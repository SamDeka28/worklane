-- Pool + remainder distribution metadata.

alter table public.distribution_versions
  add column if not exists pool_amount_minor bigint
    check (pool_amount_minor is null or pool_amount_minor >= 0);

alter table public.distribution_lines
  add column if not exists role text not null default 'pool'
    check (role in ('pool', 'remainder'));

alter table public.distribution_lines
  add column if not exists pool_share_bps integer
    check (pool_share_bps is null or (pool_share_bps >= 0 and pool_share_bps <= 10000));

-- Existing flat 100% splits stay as pool lines (no pool_amount_minor).
update public.distribution_lines
set role = 'pool'
where role is null or role = '';
