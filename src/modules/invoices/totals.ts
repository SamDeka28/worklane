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
