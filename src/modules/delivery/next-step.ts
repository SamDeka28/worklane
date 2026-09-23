import type { BillingMode } from "@/modules/delivery/types";

export type ProjectNextStep = {
  title: string;
  detail: string;
  tab: "work" | "milestones" | "money";
  cta: string;
};

export function projectNextStep(input: {
  billingMode: BillingMode;
  logCount: number;
  openTasks: number;
  unbilledMilestones: number;
  outstandingMinor: bigint;
  milestoneCount?: number;
}): ProjectNextStep {
  const milestoneCount = input.milestoneCount ?? 0;

  if (
    (input.billingMode === "milestones" || input.billingMode === "single_charge") &&
    milestoneCount === 0
  ) {
    return {
      title: "Add the first milestone",
      detail: "Name a slice of work: amount optional until you’re ready to post a charge.",
      tab: "milestones",
      cta: "Add milestone",
    };
  }

  if (input.billingMode === "hourly" && input.logCount === 0) {
    return {
      title: "Log the first day of work",
      detail: "Hourly projects post a charge when you log hours or a fixed amount.",
      tab: "work",
      cta: "Log work",
    };
  }
  if (input.unbilledMilestones > 0) {
    return {
      title: "Post a milestone charge",
      detail: `${input.unbilledMilestones} milestone${input.unbilledMilestones === 1 ? "" : "s"} ready to charge the client.`,
      tab: "milestones",
      cta: "Review milestones",
    };
  }
  if (input.outstandingMinor > BigInt(0)) {
    return {
      title: "Collect what’s owed",
      detail: "Record a receipt against open charges.",
      tab: "money",
      cta: "Collect",
    };
  }
  if (input.billingMode === "hourly") {
    return {
      title: "Log today’s work",
      detail: "Keep the daily sheet in Worklane.",
      tab: "work",
      cta: "Log work",
    };
  }
  if (input.openTasks > 0) {
    return {
      title: "Move open tasks",
      detail: `${input.openTasks} still in to do or doing.`,
      tab: "work",
      cta: "Open board",
    };
  }
  return {
    title: "Delivery is set",
    detail: "Add tasks on the board, or archive when this engagement is done.",
    tab: "work",
    cta: "Open board",
  };
}
