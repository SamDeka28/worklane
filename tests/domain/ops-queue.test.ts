import { describe, expect, it } from "vitest";
import { buildOpsQueue } from "@/modules/ops/queue";
import { toMinor } from "@/shared/money";

describe("opsQueue", () => {
  it("ranks overdue collect before open collect before bill before log", () => {
    const queue = buildOpsQueue({
      orgSlug: "studio",
      asOf: "2026-09-07",
      collects: [
        {
          clientId: "c1",
          clientName: "Open Co",
          chargeId: "ch-open",
          chargeLabel: "Retainer",
          outstandingMinor: toMinor(500, "USD"),
          currency: "USD",
          dueOn: "2026-09-20",
          overdue: false,
          chargedOn: "2026-09-01",
        },
        {
          clientId: "c2",
          clientName: "Late Co",
          chargeId: "ch-late",
          chargeLabel: "Kickoff",
          outstandingMinor: toMinor(200, "USD"),
          currency: "USD",
          dueOn: "2026-08-01",
          overdue: true,
          chargedOn: "2026-07-01",
        },
      ],
      bills: [
        {
          milestoneId: "m1",
          milestoneName: "Design",
          projectId: "p1",
          projectName: "Site",
          clientName: "Open Co",
          amountMinor: toMinor(1000, "USD"),
          currency: "USD",
          status: "completed",
        },
      ],
      logs: [
        {
          projectId: "p2",
          projectName: "Hourly",
          clientName: "RNPL",
          clientId: "c3",
          billingMode: "hourly",
          loggedToday: false,
          logCount: 2,
        },
      ],
      settles: [
        {
          partnerId: "pa1",
          partnerName: "Sam",
          payableMinor: toMinor(100, "USD"),
          currency: "USD",
        },
      ],
    });

    expect(queue.map((row) => row.verb)).toEqual([
      "collect",
      "collect",
      "bill",
      "log",
      "settle",
    ]);
    expect(queue[0].title).toBe("Late Co");
    expect(queue[0].why).toMatch(/past due/i);
    expect(queue[2].why).toMatch(/done/i);
  });

  it("skips hourly projects already logged today", () => {
    const queue = buildOpsQueue({
      orgSlug: "studio",
      collects: [],
      bills: [],
      logs: [
        {
          projectId: "p1",
          projectName: "Done today",
          clientName: "A",
          clientId: "c1",
          billingMode: "hourly",
          loggedToday: true,
          logCount: 3,
        },
      ],
      settles: [],
    });
    expect(queue).toHaveLength(0);
  });
});
