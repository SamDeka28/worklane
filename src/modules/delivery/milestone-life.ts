import type { MilestoneRecord } from "@/modules/delivery/types";
import type { ChargeView } from "@/modules/finance/ledger";

export type MilestoneBillingLife = "unbilled" | "due" | "overdue" | "paid" | "void";

export const MILESTONE_STATUS_LABEL: Record<MilestoneRecord["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Done",
  cancelled: "Cancelled",
};

export function milestoneBillingLife(
  milestone: Pick<MilestoneRecord, "chargeId">,
  charge: ChargeView | null | undefined,
): MilestoneBillingLife {
  if (!milestone.chargeId || !charge) return "unbilled";
  if (charge.status === "void") return "void";
  if (charge.outstandingMinor <= BigInt(0)) return "paid";
  if (charge.overdue) return "overdue";
  return "due";
}

export function milestoneBillingLabel(life: MilestoneBillingLife) {
  switch (life) {
    case "unbilled":
      return "No charge";
    case "due":
      return "Due";
    case "overdue":
      return "Overdue";
    case "paid":
      return "Collected";
    case "void":
      return "Charge voided";
  }
}

export function chargeByMilestoneId(charges: ChargeView[]) {
  const map = new Map<string, ChargeView>();
  for (const charge of charges) {
    if (charge.milestoneId) map.set(charge.milestoneId, charge);
  }
  return map;
}
