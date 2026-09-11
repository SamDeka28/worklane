import { describe, expect, it } from "vitest";
import { projectNextStep } from "@/modules/delivery/next-step";
import {
  canCancelCharge,
  chargeLife,
  chargeLifeLabel,
  collectTargets,
  dueThisMonthMinor,
  formatDay,
  groupChargesByClient,
  initials,
  paidRatio,
  receiptAppliedLabels,
} from "@/modules/finance/presentation";
import type { ChargeView } from "@/modules/finance/ledger";
import { moneyLabel } from "@/modules/finance/ledger";
import { toMinor } from "@/shared/money";

function view(partial: Partial<ChargeView> & Pick<ChargeView, "id" | "grossMinor">): ChargeView {
  return {
    clientId: "c1",
    projectId: null,
    milestoneId: null,
    workLogId: null,
    feeBps: 500,
    netMinor: partial.grossMinor,
    currency: "USD",
    chargedOn: "2024-08-31",
    dueOn: null,
    source: "manual",
    status: "open",
    memo: "Vince kickoff",
    createdAt: "2024-08-31T00:00:00Z",
    allocatedMinor: BigInt(0),
    outstandingMinor: partial.grossMinor,
    overdue: false,
    ...partial,
  };
}

describe("charge life", () => {
  it("labels unpaid, partial, paid, overdue, and cancelled", () => {
    expect(chargeLife(view({ id: "a", grossMinor: toMinor(875, "USD") }))).toBe("due");
    expect(
      chargeLife(
        view({
          id: "b",
          grossMinor: toMinor(875, "USD"),
          allocatedMinor: toMinor(200, "USD"),
          outstandingMinor: toMinor(675, "USD"),
        }),
      ),
    ).toBe("partial");
    expect(
      chargeLife(
        view({
          id: "c",
          grossMinor: toMinor(875, "USD"),
          allocatedMinor: toMinor(875, "USD"),
          outstandingMinor: BigInt(0),
        }),
      ),
    ).toBe("paid");
    expect(
      chargeLife(
        view({
          id: "d",
          grossMinor: toMinor(875, "USD"),
          dueOn: "2024-08-01",
          overdue: true,
        }),
      ),
    ).toBe("overdue");
    expect(
      chargeLife(
        view({
          id: "e",
          grossMinor: toMinor(875, "USD"),
          status: "void",
          outstandingMinor: BigInt(0),
        }),
      ),
    ).toBe("cancelled");
    expect(chargeLifeLabel("due")).toBe("Unpaid");
  });

  it("blocks cancel after a receipt is applied", () => {
    const open = view({ id: "a", grossMinor: toMinor(875, "USD") });
    const partial = view({
      id: "b",
      grossMinor: toMinor(875, "USD"),
      allocatedMinor: toMinor(200, "USD"),
      outstandingMinor: toMinor(675, "USD"),
    });
    expect(canCancelCharge(open)).toBe(true);
    expect(canCancelCharge(partial)).toBe(false);
  });

  it("computes paid ratio without floats in the ledger", () => {
    const charge = view({
      id: "a",
      grossMinor: toMinor(100, "USD"),
      allocatedMinor: toMinor(25, "USD"),
      outstandingMinor: toMinor(75, "USD"),
    });
    expect(paidRatio(charge)).toBe(0.25);
  });

  it("sorts clients by who still owes", () => {
    const groups = groupChargesByClient(
      [
        view({ id: "1", clientId: "james", grossMinor: toMinor(100, "USD"), outstandingMinor: toMinor(100, "USD") }),
        view({ id: "2", clientId: "vince", grossMinor: toMinor(875, "USD"), outstandingMinor: toMinor(875, "USD") }),
      ],
      new Map([
        ["james", "James"],
        ["vince", "Vince"],
      ]),
    );
    expect(groups[0].name).toBe("Vince");
    expect(groups[0].outstandingMinor).toBe(toMinor(875, "USD"));
  });

  it("formats dates and initials for people", () => {
    expect(formatDay("2024-08-31")).toBe("Aug 31, 2024");
    expect(initials("Vince")).toBe("VI");
    expect(initials("James Parcel")).toBe("JP");
  });

  it("sums outstanding due in the current month", () => {
    expect(
      dueThisMonthMinor(
        [
          view({
            id: "a",
            grossMinor: toMinor(100, "USD"),
            outstandingMinor: toMinor(100, "USD"),
            dueOn: "2026-08-15",
          }),
          view({
            id: "b",
            grossMinor: toMinor(50, "USD"),
            outstandingMinor: toMinor(50, "USD"),
            dueOn: "2026-09-01",
          }),
        ],
        "2026-08-25",
      ),
    ).toBe(toMinor(100, "USD"));
  });

  it("names billed items for collect and receipts", () => {
    const pickup = view({
      id: "pickup",
      grossMinor: toMinor(579, "USD"),
      outstandingMinor: toMinor(579, "USD"),
      source: "milestone",
      memo: "Package Returns - Pickup Request & Order Management",
      chargedOn: "2024-08-31",
      createdAt: "2024-08-31T00:00:00Z",
    });
    const stripe = view({
      id: "stripe",
      grossMinor: toMinor(527, "USD"),
      outstandingMinor: toMinor(527, "USD"),
      source: "milestone",
      memo: "Stripe Payment Integration",
      chargedOn: "2024-09-01",
      createdAt: "2024-09-01T00:00:00Z",
    });
    const targets = collectTargets([stripe, pickup]);
    expect(targets[0]?.id).toBe("pickup");
    expect(targets[0]?.amount).toBe("579.00");
    expect(targets.map((target) => target.id)).toEqual(["pickup", "stripe"]);

    expect(
      receiptAppliedLabels(
        "p1",
        [{ paymentId: "p1", chargeId: "stripe", amountMinor: toMinor(527, "USD") }],
        [pickup, stripe],
      ),
    ).toEqual([`Stripe Payment Integration · ${moneyLabel(toMinor(527, "USD"), "USD")}`]);
  });
});

describe("project next step", () => {
  it("asks hourly projects to log work first", () => {
    const step = projectNextStep({
      billingMode: "hourly",
      logCount: 0,
      openTasks: 3,
      unbilledMilestones: 0,
      outstandingMinor: BigInt(0),
    });
    expect(step.tab).toBe("work");
    expect(step.cta).toBe("Log work");
  });

  it("asks milestone projects to add a milestone first", () => {
    const step = projectNextStep({
      billingMode: "milestones",
      logCount: 0,
      openTasks: 0,
      unbilledMilestones: 0,
      outstandingMinor: BigInt(0),
      milestoneCount: 0,
    });
    expect(step.tab).toBe("milestones");
    expect(step.cta).toBe("Add milestone");
  });
});
