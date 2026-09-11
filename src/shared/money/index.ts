/** Integer minor units. Never use floating point for stored money. */

export type IsoCurrency = "USD" | "INR";

export const CURRENCY_EXPONENT: Record<IsoCurrency, number> = {
  USD: 2,
  INR: 2,
};

export type Money = {
  amountMinor: bigint;
  currency: IsoCurrency;
};

export function toMinor(major: number, currency: IsoCurrency): bigint {
  const exp = CURRENCY_EXPONENT[currency];
  return BigInt(Math.round(major * 10 ** exp));
}

export function parseMajorToMinor(raw: string, currency: IsoCurrency): bigint {
  const exp = CURRENCY_EXPONENT[currency];
  const cleaned = raw.trim().replace(/,/g, "");
  if (!cleaned) {
    throw new Error("Amount is required");
  }
  const negative = cleaned.startsWith("-");
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const parts = unsigned.split(".");
  if (parts.length > 2) {
    throw new Error("Enter a valid amount");
  }
  const [whole, frac = ""] = parts;
  if (!whole || !/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) {
    throw new Error("Enter a valid amount");
  }
  if (frac.length > exp) {
    throw new Error("Too many decimal places");
  }
  const padded = (frac + "0".repeat(exp)).slice(0, exp);
  const minor = BigInt(whole) * BigInt(10 ** exp) + BigInt(padded || "0");
  return negative ? -minor : minor;
}

export function fromMinor(amountMinor: bigint, currency: IsoCurrency): number {
  const exp = CURRENCY_EXPONENT[currency];
  return Number(amountMinor) / 10 ** exp;
}

export function formatMajorInput(amountMinor: bigint, currency: IsoCurrency) {
  const exp = CURRENCY_EXPONENT[currency];
  const negative = amountMinor < BigInt(0);
  const abs = negative ? -amountMinor : amountMinor;
  const scale = BigInt(10 ** exp);
  const whole = abs / scale;
  const frac = abs % scale;
  return `${negative ? "-" : ""}${whole}.${frac.toString().padStart(exp, "0")}`;
}

export function grossFromHours(
  hours: number,
  hourlyRateMinor: bigint,
): bigint {
  const hoursMillis = BigInt(Math.round(hours * 1000));
  return (hoursMillis * hourlyRateMinor) / BigInt(1000);
}

export function netFromGross(grossMinor: bigint, feeBps: number): bigint {
  if (feeBps < 0 || feeBps > 10_000) {
    throw new Error("feeBps must be between 0 and 10000");
  }
  return (grossMinor * (BigInt(10000) - BigInt(feeBps))) / BigInt(10000);
}

/** Largest-remainder (Hamilton) so shares always sum to `amountMinor`. */
export function splitByBps(amountMinor: bigint, sharesBps: number[]): bigint[] {
  const totalBps = sharesBps.reduce((sum, bps) => sum + bps, 0);
  if (totalBps !== 10_000) {
    throw new Error(`share_bps must sum to 10000, got ${totalBps}`);
  }

  const tenThousand = BigInt(10000);
  const floors = sharesBps.map((bps) => ({
    bps,
    floor: (amountMinor * BigInt(bps)) / tenThousand,
    remainder: (amountMinor * BigInt(bps)) % tenThousand,
  }));

  let leftover = amountMinor - floors.reduce((sum, row) => sum + row.floor, BigInt(0));
  const ranked = floors
    .map((row, index) => ({ ...row, index }))
    .sort((a, b) => {
      const remaining = Number(b.remainder - a.remainder);
      return remaining !== 0 ? remaining : a.index - b.index;
    });

  const result = floors.map((row) => row.floor);
  let i = 0;
  while (leftover > BigInt(0)) {
    result[ranked[i % ranked.length].index] += BigInt(1);
    leftover -= BigInt(1);
    i += 1;
  }
  return result;
}

export function workbookLine(input: {
  hours?: number;
  hourlyRateMinor?: bigint;
  fixedMinor?: bigint;
  feeBps: number;
  shareBps: number;
}): { gross: bigint; net: bigint; partnerEarned: bigint } {
  const gross =
    input.fixedMinor ??
    (input.hours != null && input.hourlyRateMinor != null
      ? grossFromHours(input.hours, input.hourlyRateMinor)
      : BigInt(0));
  const net = netFromGross(gross, input.feeBps);
  const [partnerEarned] = splitByBps(net, [input.shareBps, 10_000 - input.shareBps]);
  return { gross, net, partnerEarned };
}

export function fifoAllocate(
  paymentMinor: bigint,
  charges: { id: string; outstandingMinor: bigint }[],
  preferredChargeId?: string | null,
): { chargeId: string; amountMinor: bigint }[] {
  const preferred = preferredChargeId
    ? charges.find((charge) => charge.id === preferredChargeId)
    : undefined;
  const rest = preferredChargeId
    ? charges.filter((charge) => charge.id !== preferredChargeId)
    : charges;
  const ordered = preferred ? [preferred, ...rest] : rest;

  let remaining = paymentMinor;
  const allocations: { chargeId: string; amountMinor: bigint }[] = [];
  for (const charge of ordered) {
    if (remaining <= BigInt(0) || charge.outstandingMinor <= BigInt(0)) continue;
    const take =
      remaining < charge.outstandingMinor ? remaining : charge.outstandingMinor;
    allocations.push({ chargeId: charge.id, amountMinor: take });
    remaining -= take;
  }
  return allocations;
}

export function unallocatedMinor(
  paymentMinor: bigint,
  allocations: { amountMinor: bigint }[],
): bigint {
  return (
    paymentMinor -
    allocations.reduce((sum, row) => sum + row.amountMinor, BigInt(0))
  );
}

export type LedgerEntry = {
  amountMinor: bigint;
  on: string;
  status: string;
};

export function monthlyStatement(input: {
  charges: LedgerEntry[];
  receipts: LedgerEntry[];
  refunds: LedgerEntry[];
  periodStart: string;
  periodEndExclusive: string;
}): {
  opening: bigint;
  newCharges: bigint;
  payments: bigint;
  closing: bigint;
} {
  const inPeriod = (on: string, start: string, end: string) =>
    on >= start && on < end;
  const before = (on: string, start: string) => on < start;

  const sum = (rows: LedgerEntry[], predicate: (on: string) => boolean) =>
    rows
      .filter((row) => row.status !== "void" && predicate(row.on))
      .reduce((total, row) => total + row.amountMinor, BigInt(0));

  const openingCharges = sum(input.charges, (on) => before(on, input.periodStart));
  const openingReceipts = sum(input.receipts, (on) => before(on, input.periodStart));
  const openingRefunds = sum(input.refunds, (on) => before(on, input.periodStart));
  const opening = openingCharges - openingReceipts + openingRefunds;

  const newCharges = sum(input.charges, (on) =>
    inPeriod(on, input.periodStart, input.periodEndExclusive),
  );
  const receipts = sum(input.receipts, (on) =>
    inPeriod(on, input.periodStart, input.periodEndExclusive),
  );
  const refunds = sum(input.refunds, (on) =>
    inPeriod(on, input.periodStart, input.periodEndExclusive),
  );
  const payments = receipts - refunds;
  const closing = opening + newCharges - payments;

  return { opening, newCharges, payments, closing };
}

export function asMinor(value: string | number | bigint): bigint {
  return BigInt(value);
}

export function formatMoney(money: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  }).format(fromMinor(money.amountMinor, money.currency));
}
