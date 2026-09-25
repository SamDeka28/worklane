import { formatMoney, type IsoCurrency } from "@/shared/money";

/** Line total = qty × unit − discount + tax on (qty × unit − discount). Integer minor units. */
export function lineTotalMinor(input: {
  quantity: number;
  unitAmountMinor: bigint;
  taxBps: number;
  discountMinor: bigint;
}): bigint {
  const qtyMillis = BigInt(Math.round(input.quantity * 1000));
  const gross = (qtyMillis * input.unitAmountMinor) / BigInt(1000);
  const afterDiscount =
    gross > input.discountMinor ? gross - input.discountMinor : BigInt(0);
  const tax = (afterDiscount * BigInt(input.taxBps)) / BigInt(10_000);
  return afterDiscount + tax;
}

export function invoiceSubtotalMinor(
  lines: {
    quantity: number;
    unitAmountMinor: bigint;
    taxBps: number;
    discountMinor: bigint;
  }[],
): bigint {
  return lines.reduce((sum, line) => sum + lineTotalMinor(line), BigInt(0));
}

export type InvoiceBreakdown = {
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
};

export function invoiceBreakdown(
  lines: {
    quantity: number;
    unitAmountMinor: bigint;
    taxBps: number;
    discountMinor: bigint;
  }[],
): InvoiceBreakdown {
  let subtotalMinor = BigInt(0);
  let discountMinor = BigInt(0);
  let totalMinor = BigInt(0);
  for (const line of lines) {
    const qtyMillis = BigInt(Math.round(line.quantity * 1000));
    const gross = (qtyMillis * line.unitAmountMinor) / BigInt(1000);
    subtotalMinor += gross;
    discountMinor += line.discountMinor < gross ? line.discountMinor : gross;
    totalMinor += lineTotalMinor(line);
  }
  return {
    subtotalMinor,
    discountMinor,
    taxMinor: totalMinor - (subtotalMinor - discountMinor),
    totalMinor,
  };
}

/** Tax grouped by rate, e.g. [{ bps: 1800, taxMinor: 1800n }], highest rate first. */
export function invoiceTaxByRate(
  lines: {
    quantity: number;
    unitAmountMinor: bigint;
    taxBps: number;
    discountMinor: bigint;
  }[],
): { bps: number; taxableMinor: bigint; taxMinor: bigint }[] {
  const groups = new Map<number, { taxableMinor: bigint; taxMinor: bigint }>();
  for (const line of lines) {
    if (line.taxBps <= 0) continue;
    const qtyMillis = BigInt(Math.round(line.quantity * 1000));
    const gross = (qtyMillis * line.unitAmountMinor) / BigInt(1000);
    const taxable = gross > line.discountMinor ? gross - line.discountMinor : BigInt(0);
    const tax = lineTotalMinor(line) - taxable;
    const group = groups.get(line.taxBps) ?? { taxableMinor: BigInt(0), taxMinor: BigInt(0) };
    group.taxableMinor += taxable;
    group.taxMinor += tax;
    groups.set(line.taxBps, group);
  }
  return [...groups.entries()]
    .map(([bps, group]) => ({ bps, ...group }))
    .sort((a, b) => b.bps - a.bps);
}

/** Format org sequence as INV-0001 style. */
export function formatInvoiceNumber(seq: number, prefix = "INV"): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error("Invoice sequence must be a positive integer");
  }
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export function invoiceMoneyLabel(amountMinor: bigint, currency: IsoCurrency) {
  return formatMoney({ amountMinor, currency });
}
