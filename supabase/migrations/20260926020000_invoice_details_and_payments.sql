-- Invoice details (bill-to snapshot, reference, payment instructions) and
-- payment flow: record receipts against an invoice and keep status in sync.

alter table public.invoices
  add column if not exists bill_to jsonb,
  add column if not exists reference text,
  add column if not exists payment_instructions text,
  add column if not exists sent_at timestamptz,
  add column if not exists paid_at timestamptz;

-- ---------------------------------------------------------------------------
-- Status sync: paid / partially_paid derived from allocations on the
-- invoice's own charges. Runs for receipts posted anywhere (invoice page or
-- finance ledger FIFO), and when a receipt is voided.
-- ---------------------------------------------------------------------------
create or replace function public.sync_invoice_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
  v_total bigint;
  v_paid bigint;
  v_next text;
begin
  select id, status, issued_at, sent_at into v_inv
  from public.invoices
  where id = p_invoice_id;

  if v_inv.id is null or v_inv.status = 'void' or v_inv.issued_at is null then
    return;
  end if;

  select
    coalesce(sum(c.gross_minor), 0),
    coalesce(sum(a.paid), 0)
  into v_total, v_paid
  from public.charges c
  left join lateral (
    select sum(pa.amount_minor) as paid
    from public.payment_allocations pa
    join public.payments p on p.id = pa.payment_id
    where pa.charge_id = c.id
      and p.status = 'posted'
      and p.kind = 'receipt'
  ) a on true
  where c.status = 'open'
    and c.id in (
      select il.charge_id
      from public.invoice_lines il
      where il.invoice_id = p_invoice_id
        and il.charge_id is not null
    );

  if v_total > 0 and v_paid >= v_total then
    v_next := 'paid';
  elsif v_paid > 0 then
    v_next := 'partially_paid';
  elsif v_inv.status in ('paid', 'partially_paid') then
    v_next := case when v_inv.sent_at is not null then 'sent' else 'draft' end;
  else
    v_next := v_inv.status;
  end if;

  if v_next is distinct from v_inv.status then
    update public.invoices
    set status = v_next,
        paid_at = case when v_next = 'paid' then coalesce(paid_at, now()) else null end
    where id = p_invoice_id;
  end if;
end;
$$;

create or replace function public.invoice_status_from_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  for v_invoice_id in
    select distinct il.invoice_id
    from public.invoice_lines il
    where il.charge_id in (
      coalesce(new.charge_id, old.charge_id),
      coalesce(old.charge_id, new.charge_id)
    )
  loop
    perform public.sync_invoice_payment_status(v_invoice_id);
  end loop;
  return null;
end;
$$;

create or replace function public.invoice_status_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  for v_invoice_id in
    select distinct il.invoice_id
    from public.payment_allocations pa
    join public.invoice_lines il on il.charge_id = pa.charge_id
    where pa.payment_id = new.id
  loop
    perform public.sync_invoice_payment_status(v_invoice_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists payment_allocations_invoice_status on public.payment_allocations;
create trigger payment_allocations_invoice_status
  after insert or update or delete on public.payment_allocations
  for each row execute function public.invoice_status_from_allocation();

drop trigger if exists payments_invoice_status on public.payments;
create trigger payments_invoice_status
  after update of status on public.payments
  for each row execute function public.invoice_status_from_payment();

revoke execute on function public.sync_invoice_payment_status(uuid) from public, anon, authenticated;
revoke execute on function public.invoice_status_from_allocation() from public, anon, authenticated;
revoke execute on function public.invoice_status_from_payment() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Record a receipt against one invoice: a single payment row, allocated to
-- the invoice's charges in line order. Runs as the caller (RLS applies).
-- ---------------------------------------------------------------------------
create or replace function public.post_invoice_receipt(
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_paid_on date,
  p_method text,
  p_reference text default null
)
returns table (payment_id uuid, unallocated_minor bigint)
language plpgsql
set search_path = public
as $$
declare
  v_inv record;
  v_payment_id uuid;
  v_remaining bigint;
  r record;
  v_take bigint;
begin
  if p_amount_minor <= 0 then
    raise exception 'amount must be positive';
  end if;

  select id, organization_id, client_id, currency, status, issued_at into v_inv
  from public.invoices
  where id = p_invoice_id;

  if v_inv.id is null then
    raise exception 'invoice not found';
  end if;
  if not public.can_write_org(v_inv.organization_id) then
    raise exception 'not allowed';
  end if;
  if v_inv.issued_at is null then
    raise exception 'issue the invoice before recording a payment';
  end if;
  if v_inv.status = 'void' then
    raise exception 'invoice is void';
  end if;

  insert into public.payments (
    organization_id, client_id, amount_minor, currency, paid_on, method, reference, kind, status, created_by
  ) values (
    v_inv.organization_id, v_inv.client_id, p_amount_minor, v_inv.currency, p_paid_on,
    p_method, p_reference, 'receipt', 'posted', auth.uid()
  )
  returning id into v_payment_id;

  v_remaining := p_amount_minor;

  for r in
    select
      c.id,
      c.gross_minor - coalesce((
        select sum(pa.amount_minor)
        from public.payment_allocations pa
        join public.payments p on p.id = pa.payment_id
        where pa.charge_id = c.id
          and p.status = 'posted'
          and p.kind = 'receipt'
      ), 0) as outstanding
    from public.charges c
    join public.invoice_lines il on il.charge_id = c.id
    where il.invoice_id = p_invoice_id
      and c.status = 'open'
    order by il.position asc
  loop
    exit when v_remaining <= 0;
    continue when r.outstanding <= 0;
    v_take := least(v_remaining, r.outstanding);
    insert into public.payment_allocations (organization_id, payment_id, charge_id, amount_minor)
    values (v_inv.organization_id, v_payment_id, r.id, v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  return query select v_payment_id, v_remaining;
end;
$$;

revoke execute on function public.post_invoice_receipt(uuid, bigint, date, text, text) from public, anon;
grant execute on function public.post_invoice_receipt(uuid, bigint, date, text, text) to authenticated;

-- Backfill statuses for invoices that already have receipts applied.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.invoices where issued_at is not null and status <> 'void'
  loop
    perform public.sync_invoice_payment_status(v_id);
  end loop;
end;
$$;
