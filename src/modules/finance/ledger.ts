import { asMinor, formatMoney, monthlyStatement, type IsoCurrency } from "@/shared/money";

export type ChargeRow = {
  id: string;
  clientId: string;
  projectId: string | null;
  milestoneId: string | null;
  workLogId: string | null;
  grossMinor: bigint;
  feeBps: number;
  netMinor: bigint;
  currency: IsoCurrency;
  chargedOn: string;
  dueOn: string | null;
  source: string;
  status: "open" | "void";
  memo: string | null;
  createdAt: string;
};

export type PaymentRow = {
  id: string;
  clientId: string;
  amountMinor: bigint;
  currency: IsoCurrency;
  paidOn: string;
  method: string;
  reference: string | null;
  kind: "receipt" | "refund";
  status: "posted" | "void";
  createdAt: string;
};

export type AllocationRow = {
  paymentId: string;
  chargeId: string;
  amountMinor: bigint;
};

export type ChargeView = ChargeRow & {
  allocatedMinor: bigint;
  outstandingMinor: bigint;
  overdue: boolean;
};

export type ClientMoneySnapshot = {
  currency: IsoCurrency;
  billedMinor: bigint;
  collectedMinor: bigint;
  refundedMinor: bigint;
  outstandingMinor: bigint;
  unallocatedMinor: bigint;
  overdueMinor: bigint;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function allocatedByCharge(
  allocations: AllocationRow[],
  payments: PaymentRow[],
): Map<string, bigint> {
  const postedReceipts = new Set(
    payments
      .filter((row) => row.status === "posted" && row.kind === "receipt")
      .map((row) => row.id),
  );
  const totals = new Map<string, bigint>();
  for (const allocation of allocations) {
    if (!postedReceipts.has(allocation.paymentId)) continue;
    totals.set(
      allocation.chargeId,
      (totals.get(allocation.chargeId) ?? BigInt(0)) + allocation.amountMinor,
    );
  }
  return totals;
}

export function withChargeOutstanding(
  charges: ChargeRow[],
  allocations: AllocationRow[],
  payments: PaymentRow[],
  asOf = todayIso(),
): ChargeView[] {
  const allocated = allocatedByCharge(allocations, payments);
  return charges.map((charge) => {
    const allocatedMinor = allocated.get(charge.id) ?? BigInt(0);
    const outstandingMinor =
      charge.status === "void"
        ? BigInt(0)
        : charge.grossMinor > allocatedMinor
          ? charge.grossMinor - allocatedMinor
          : BigInt(0);
    const overdue = outstandingMinor > BigInt(0) && Boolean(charge.dueOn) && charge.dueOn! < asOf;
    return { ...charge, allocatedMinor, outstandingMinor, overdue };
  });
}

export function clientMoneySnapshot(
  charges: ChargeRow[],
  payments: PaymentRow[],
  allocations: AllocationRow[],
  asOf = todayIso(),
): ClientMoneySnapshot {
  const views = withChargeOutstanding(charges, allocations, payments, asOf);
  const currency = charges[0]?.currency ?? payments[0]?.currency ?? "USD";
  const billedMinor = charges
    .filter((row) => row.status !== "void")
    .reduce((sum, row) => sum + row.grossMinor, BigInt(0));
  const collectedMinor = payments
    .filter((row) => row.status === "posted" && row.kind === "receipt")
    .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const refundedMinor = payments
    .filter((row) => row.status === "posted" && row.kind === "refund")
    .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const allocatedMinor = views.reduce((sum, row) => sum + row.allocatedMinor, BigInt(0));
  const unallocatedMinor =
    collectedMinor > allocatedMinor ? collectedMinor - allocatedMinor : BigInt(0);
  const outstandingMinor = billedMinor - collectedMinor + refundedMinor;
  const overdueMinor = views
    .filter((row) => row.overdue)
    .reduce((sum, row) => sum + row.outstandingMinor, BigInt(0));

  return {
    currency,
    billedMinor,
    collectedMinor,
    refundedMinor,
    outstandingMinor,
    unallocatedMinor,
    overdueMinor,
  };
}

export function monthBounds(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { periodStart: start, periodEndExclusive: endExclusive };
}

export function statementForMonth(
  charges: ChargeRow[],
  payments: PaymentRow[],
  yearMonth: string,
) {
  const { periodStart, periodEndExclusive } = monthBounds(yearMonth);
  return monthlyStatement({
    charges: charges.map((row) => ({
      amountMinor: row.grossMinor,
      on: row.chargedOn,
      status: row.status,
    })),
    receipts: payments
      .filter((row) => row.kind === "receipt")
      .map((row) => ({
        amountMinor: row.amountMinor,
        on: row.paidOn,
        status: row.status,
      })),
    refunds: payments
      .filter((row) => row.kind === "refund")
      .map((row) => ({
        amountMinor: row.amountMinor,
        on: row.paidOn,
        status: row.status,
      })),
    periodStart,
    periodEndExclusive,
  });
}

export function moneyLabel(amountMinor: bigint, currency: IsoCurrency) {
  return formatMoney({ amountMinor, currency });
}

export function asLedgerMinor(value: string | number | bigint | null | undefined) {
  if (value == null) return BigInt(0);
  return asMinor(value);
}
