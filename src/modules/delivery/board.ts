import type { ChargeView } from "@/modules/finance/ledger";
import type { BoardColumn, MilestoneRecord, ProjectRecord, TaskStatus } from "@/modules/delivery/types";

export function statusForColumn(systemKey: BoardColumn["systemKey"]): TaskStatus {
  if (systemKey === "todo" || systemKey === "doing" || systemKey === "done") return systemKey;
  return "doing";
}

export function isOpenBoardColumn(systemKey: BoardColumn["systemKey"]): boolean {
  return systemKey !== "done";
}

export const BILLING_MODE_LABEL: Record<ProjectRecord["billingMode"], string> = {
  none: "Track only",
  single_charge: "Contracted",
  milestones: "Milestones",
  hourly: "Hourly",
  manual: "Manual",
};

export function projectMoneyStats(
  project: Pick<ProjectRecord, "id" | "contractedAmountMinor">,
  charges: ChargeView[],
  milestones: Pick<MilestoneRecord, "amountMinor">[] = [],
) {
  const live = charges.filter((charge) => charge.projectId === project.id && charge.status !== "void");
  const billedMinor = live.reduce((sum, charge) => sum + charge.grossMinor, BigInt(0));
  const outstandingMinor = live.reduce((sum, charge) => sum + charge.outstandingMinor, BigInt(0));
  const collectedMinor = live.reduce((sum, charge) => sum + charge.allocatedMinor, BigInt(0));
  const milestoneTotal = milestones.reduce(
    (sum, item) => sum + (item.amountMinor ?? BigInt(0)),
    BigInt(0),
  );
  // Milestone prices are the source of truth when present; contracted amount is a fallback
  // (e.g. early quote before milestones are broken out).
  const totalPriceMinor =
    milestoneTotal > BigInt(0)
      ? milestoneTotal
      : project.contractedAmountMinor ?? (billedMinor > BigInt(0) ? billedMinor : BigInt(0));
  const remainingMinor =
    totalPriceMinor > collectedMinor ? totalPriceMinor - collectedMinor : BigInt(0);

  return {
    totalPriceMinor,
    milestoneTotalMinor: milestoneTotal,
    billedMinor,
    outstandingMinor,
    collectedMinor,
    remainingMinor,
  };
}
