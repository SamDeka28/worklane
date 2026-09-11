-- Apply a receipt to a chosen billed item first, then FIFO the rest.
-- Outstanding stays derived from allocations vs gross.

drop function if exists public.post_client_receipt(uuid, uuid, bigint, text, date, text, text);

create or replace function public.post_client_receipt(
  p_org_id uuid,
  p_client_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_paid_on date,
  p_method text,
  p_reference text default null,
  p_charge_id uuid default null
)
returns table (payment_id uuid, unallocated_minor bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_remaining bigint;
  r record;
  v_take bigint;
begin
  if p_amount_minor <= 0 then
    raise exception 'amount must be positive';
  end if;
  if not public.can_write_org(p_org_id) then
    raise exception 'not allowed';
  end if;

  if p_charge_id is not null then
    if not exists (
      select 1
      from public.charges c
      where c.id = p_charge_id
        and c.organization_id = p_org_id
        and c.client_id = p_client_id
        and c.currency = p_currency
        and c.status = 'open'
    ) then
      raise exception 'charge not found';
    end if;
  end if;

  insert into public.payments (
    organization_id, client_id, amount_minor, currency, paid_on, method, reference, kind, status, created_by
  ) values (
    p_org_id, p_client_id, p_amount_minor, p_currency, p_paid_on, p_method, p_reference, 'receipt', 'posted', auth.uid()
  )
  returning id into v_payment_id;

  v_remaining := p_amount_minor;

  for r in
    select
      c.id,
      c.gross_minor - coalesce((
        select sum(pa.amount_minor)
        from public.payment_allocations pa
        inner join public.payments p on p.id = pa.payment_id
        where pa.charge_id = c.id
          and p.status = 'posted'
          and p.kind = 'receipt'
      ), 0) as outstanding
    from public.charges c
    where c.organization_id = p_org_id
      and c.client_id = p_client_id
      and c.status = 'open'
      and c.currency = p_currency
    order by
      case when p_charge_id is not null and c.id = p_charge_id then 0 else 1 end,
      c.charged_on asc,
      c.created_at asc
  loop
    exit when v_remaining <= 0;
    continue when r.outstanding <= 0;
    v_take := least(v_remaining, r.outstanding);
    insert into public.payment_allocations (organization_id, payment_id, charge_id, amount_minor)
    values (p_org_id, v_payment_id, r.id, v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  return query select v_payment_id, v_remaining;
end;
$$;

revoke all on function public.post_client_receipt(uuid, uuid, bigint, text, date, text, text, uuid) from public, anon;
grant execute on function public.post_client_receipt(uuid, uuid, bigint, text, date, text, text, uuid) to authenticated;
