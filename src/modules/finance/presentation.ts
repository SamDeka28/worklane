import type { ChargeView, PaymentRow, AllocationRow } from "@/modules/finance/ledger";
import { moneyLabel } from "@/modules/finance/ledger";
import { formatMajorInput } from "@/shared/money";
import type { IsoCurrency } from "@/shared/money";

export type ChargeLife = "cancelled" | "paid" | "overdue" | "partial" | "due";

export function chargeLife(charge: ChargeView): ChargeLife {
  if (charge.status === "void") return "cancelled";
  if (charge.outstandingMinor <= BigInt(0)) return "paid";
  if (charge.overdue) return "overdue";
  if (charge.allocatedMinor > BigInt(0)) return "partial";
  return "due";
}

export function chargeLifeLabel(life: ChargeLife): string {
  switch (life) {
    case "cancelled":
      return "Cancelled";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "partial":
      return "Partially paid";
    case "due":
      return "Unpaid";
  }
}

export function paidRatio(charge: ChargeView): number {
  if (charge.grossMinor <= BigInt(0)) return charge.status === "void" ? 0 : 1;
  const paid = charge.status === "void" ? BigInt(0) : charge.allocatedMinor;
  const thousandths = Number((paid * BigInt(1000)) / charge.grossMinor);
  return Math.min(1, Math.max(0, thousandths / 1000));
}

export function canCancelCharge(charge: ChargeView): boolean {
  return charge.status === "open" && charge.allocatedMinor === BigInt(0);
}

export type ClientChargeGroup = {
  clientId: string;
  name: string;
  currency: IsoCurrency;
  outstandingMinor: bigint;
  openCount: number;
  charges: ChargeView[];
};

export function groupChargesByClient(
  charges: ChargeView[],
  names: Map<string, string>,
): ClientChargeGroup[] {
  const groups = new Map<string, ChargeView[]>();
  for (const charge of charges) {
    const rows = groups.get(charge.clientId) ?? [];
    rows.push(charge);
    groups.set(charge.clientId, rows);
  }

  return [...groups.entries()]
    .map(([clientId, rows]) => {
      const live = rows.filter((row) => row.status !== "void");
      const outstandingMinor = live.reduce(
        (sum, row) => sum + row.outstandingMinor,
        BigInt(0),
      );
      return {
        clientId,
        name: names.get(clientId) ?? "Client",
        currency: rows[0]?.currency ?? "USD",
        outstandingMinor,
        openCount: live.filter((row) => row.outstandingMinor > BigInt(0)).length,
        charges: rows,
      };
    })
    .sort((a, b) => {
      const owed = Number(b.outstandingMinor - a.outstandingMinor);
      return owed !== 0 ? owed : a.name.localeCompare(b.name);
    });
}

export function formatDay(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function paymentLabel(payment: PaymentRow): string {
  const method =
    payment.method === "upwork"
      ? "Upwork"
      : payment.method === "bank"
        ? "Bank"
        : payment.method === "stripe"
          ? "Stripe"
          : "Other";
  if (payment.status === "void") {
    return payment.kind === "refund" ? "Cancelled refund" : "Cancelled receipt";
  }
  return payment.kind === "refund" ? `Refund · ${method}` : `Received · ${method}`;
}

export function chargeTitle(charge: Pick<ChargeView, "memo" | "source">) {
  const memo = charge.memo?.trim();
  if (memo) return memo;
  if (charge.source === "milestone") return "Milestone";
  if (charge.source === "work_log") return "Work log";
  return "Charge";
}

export type CollectTarget = {
  id: string;
  label: string;
  amount: string;
};

export function collectTargets(charges: ChargeView[]): CollectTarget[] {
  return charges
    .filter((charge) => charge.status !== "void" && charge.outstandingMinor > BigInt(0))
    .slice()
    .sort((a, b) => {
      const byDate = a.chargedOn.localeCompare(b.chargedOn);
      return byDate !== 0 ? byDate : a.createdAt.localeCompare(b.createdAt);
    })
    .map((charge) => ({
      id: charge.id,
      label: `${chargeTitle(charge)} · ${moneyLabel(charge.outstandingMinor, charge.currency)} due`,
      amount: formatMajorInput(charge.outstandingMinor, charge.currency),
    }));
}

export function receiptAppliedLabels(
  paymentId: string,
  allocations: AllocationRow[],
  charges: Pick<ChargeView, "id" | "memo" | "source" | "currency">[],
) {
  const byId = new Map(charges.map((charge) => [charge.id, charge]));
  return allocations
    .filter((row) => row.paymentId === paymentId)
    .map((row) => {
      const charge = byId.get(row.chargeId);
      const title = charge ? chargeTitle(charge) : "Charge";
      return charge
        ? `${title} · ${moneyLabel(row.amountMinor, charge.currency)}`
        : title;
    });
}

export function dueThisMonthMinor(
  charges: { status: string; dueOn: string | null; outstandingMinor: bigint }[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  const yearMonth = asOf.slice(0, 7);
  return charges
    .filter(
      (charge) =>
        charge.status !== "void" &&
        charge.outstandingMinor > BigInt(0) &&
        charge.dueOn != null &&
        charge.dueOn.startsWith(yearMonth),
    )
    .reduce((sum, charge) => sum + charge.outstandingMinor, BigInt(0));
}

export const CANCEL_CHARGE_COPY =
  "Cancel this charge? It stays in history so the ledger stays honest. Outstanding updates on its own. You cannot cancel after a receipt is applied.";

export const UNDO_RECEIPT_COPY =
  "Undo this receipt? It stays in history as cancelled. Money allocated to charges comes back onto outstanding.";
