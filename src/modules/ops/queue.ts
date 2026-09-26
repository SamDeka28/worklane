import type { BillingMode } from "@/modules/delivery/types";
import type { IsoCurrency } from "@/shared/money";

export type OpsVerb = "collect" | "bill" | "log" | "settle" | "follow";

export type OpsQueueItem = {
  id: string;
  verb: OpsVerb;
  title: string;
  subtitle: string;
  why: string;
  href: string;
  cta: string;
  amountMinor?: bigint;
  currency?: IsoCurrency;
  /** Sort key: lower = more urgent */
  rank: number;
  clientId?: string;
  projectId?: string;
  chargeId?: string;
  milestoneId?: string;
  partnerId?: string;
};

export type CollectCandidate = {
  clientId: string;
  clientName: string;
  chargeId: string;
  chargeLabel: string;
  outstandingMinor: bigint;
  currency: IsoCurrency;
  dueOn: string | null;
  overdue: boolean;
  chargedOn: string;
};

export type BillCandidate = {
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  projectName: string;
  clientName: string;
  amountMinor: bigint;
  currency: IsoCurrency;
  status: string;
};

export type LogCandidate = {
  projectId: string;
  projectName: string;
  clientName: string;
  clientId: string;
  billingMode: BillingMode;
  loggedToday: boolean;
  logCount: number;
};

export type SettleCandidate = {
  partnerId: string;
  partnerName: string;
  payableMinor: bigint;
  currency: IsoCurrency;
};

export type FollowCandidate = {
  id: string;
  title: string;
  stage: string;
  href: string;
  why?: string;
  overdue?: boolean;
};

function daysPastDue(dueOn: string | null, asOf: string): number {
  if (!dueOn || dueOn >= asOf) return 0;
  const due = Date.parse(`${dueOn}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.floor((now - due) / 86_400_000));
}

/** Pure org-level attention ranker. Lower rank = higher priority. */
export function buildOpsQueue(input: {
  orgSlug: string;
  asOf?: string;
  collects: CollectCandidate[];
  bills: BillCandidate[];
  logs: LogCandidate[];
  settles: SettleCandidate[];
  follows?: FollowCandidate[];
}): OpsQueueItem[] {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const base = `/${input.orgSlug}`;
  const items: OpsQueueItem[] = [];

  for (const row of input.collects) {
    if (row.outstandingMinor <= BigInt(0)) continue;
    const past = daysPastDue(row.dueOn, asOf);
    const overdue = row.overdue || past > 0;
    const amountWeight = Number(row.outstandingMinor > BigInt(1_000_000_000)
      ? BigInt(1_000_000_000)
      : row.outstandingMinor);
    items.push({
      id: `collect-${row.chargeId}`,
      verb: "collect",
      title: row.clientName,
      subtitle: row.chargeLabel,
      why: overdue
        ? past > 0
          ? `${past} day${past === 1 ? "" : "s"} past due`
          : "Past due date"
        : "Open on the ledger",
      href: `${base}/clients/${row.clientId}?collect=1&charge=${row.chargeId}#collect`,
      cta: "Collect",
      amountMinor: row.outstandingMinor,
      currency: row.currency,
      rank: overdue ? 100 + Math.min(past, 90) : 300 - Math.min(amountWeight / 100, 99),
      clientId: row.clientId,
      chargeId: row.chargeId,
    });
  }

  for (const row of input.bills) {
    items.push({
      id: `bill-${row.milestoneId}`,
      verb: "bill",
      title: row.milestoneName,
      subtitle: `${row.projectName} · ${row.clientName}`,
      why:
        row.status === "completed"
          ? "Milestone done · not billed"
          : "Ready to bill",
      href: `${base}/projects/${row.projectId}?bill=${row.milestoneId}#milestones`,
      cta: "Bill",
      amountMinor: row.amountMinor,
      currency: row.currency,
      rank: row.status === "completed" ? 400 : 450,
      projectId: row.projectId,
      milestoneId: row.milestoneId,
    });
  }

  for (const row of input.logs) {
    if (row.billingMode !== "hourly") continue;
    if (row.loggedToday && row.logCount > 0) continue;
    items.push({
      id: `log-${row.projectId}`,
      verb: "log",
      title: row.projectName,
      subtitle: row.clientName,
      why: row.logCount === 0 ? "No work logged yet" : "No log for today",
      href: `${base}/projects/${row.projectId}#work`,
      cta: "Log work",
      rank: row.logCount === 0 ? 500 : 550,
      projectId: row.projectId,
      clientId: row.clientId,
    });
  }

  for (const row of input.settles) {
    if (row.payableMinor <= BigInt(0)) continue;
    items.push({
      id: `settle-${row.partnerId}`,
      verb: "settle",
      title: row.partnerName,
      subtitle: "Partner payable",
      why: "Earned exceeds settled",
      href: `${base}/partners?view=balances&settle=1&partner=${row.partnerId}`,
      cta: "Settle",
      amountMinor: row.payableMinor,
      currency: row.currency,
      rank: 700,
      partnerId: row.partnerId,
    });
  }

  for (const [index, row] of (input.follows ?? []).entries()) {
    items.push({
      id: `follow-${row.id}`,
      verb: "follow",
      title: row.title,
      subtitle: row.stage,
      why: row.why ?? `Lead · ${row.stage}`,
      href: row.href,
      cta: "Open",
      rank: (row.overdue ? 150 : 650) + index / 100,
    });
  }

  return items.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const aa = a.amountMinor ?? BigInt(0);
    const bb = b.amountMinor ?? BigInt(0);
    if (aa !== bb) return aa > bb ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function verbLabel(verb: OpsVerb) {
  switch (verb) {
    case "collect":
      return "Collect";
    case "bill":
      return "Bill";
    case "log":
      return "Log";
    case "settle":
      return "Settle";
    case "follow":
      return "Follow";
  }
}
