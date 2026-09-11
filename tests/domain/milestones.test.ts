import { describe, expect, it } from "vitest";
import {
  milestoneBillingLabel,
  milestoneBillingLife,
} from "@/modules/delivery/milestone-life";
import type { ChargeView } from "@/modules/finance/ledger";

function charge(partial: Partial<ChargeView>): ChargeView {
  return {
    id: "c1",
    clientId: "cl",
    projectId: "p1",
    milestoneId: "m1",
    workLogId: null,
    grossMinor: BigInt(10000),
    feeBps: 500,
    netMinor: BigInt(9500),
    currency: "USD",
    chargedOn: "2026-08-01",
    dueOn: "2026-08-15",
    source: "milestone",
    status: "open",
    memo: "Kickoff",
    createdAt: "2026-08-01T00:00:00Z",
    allocatedMinor: BigInt(0),
    outstandingMinor: BigInt(10000),
    overdue: false,
    ...partial,
  };
}

describe("milestone billing life", () => {
  it("keeps delivery status independent of billing", () => {
    expect(
      milestoneBillingLife({ chargeId: null }, null),
    ).toBe("unbilled");
    expect(
      milestoneBillingLife({ chargeId: "c1" }, charge({ outstandingMinor: BigInt(4000) })),
    ).toBe("due");
    expect(
      milestoneBillingLife(
        { chargeId: "c1" },
        charge({ outstandingMinor: BigInt(4000), overdue: true }),
      ),
    ).toBe("overdue");
    expect(
      milestoneBillingLife({ chargeId: "c1" }, charge({ outstandingMinor: BigInt(0) })),
    ).toBe("paid");
    expect(milestoneBillingLabel("paid")).toBe("Collected");
  });
});
