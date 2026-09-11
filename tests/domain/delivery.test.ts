import { describe, expect, it } from "vitest";
import {
  isOpenBoardColumn,
  projectMoneyStats,
  statusForColumn,
} from "@/modules/delivery/board";
import {
  chargeFromWorkLog,
  grossForWorkLog,
  guardContractedCharge,
  guardMilestoneBilling,
  hoursToMillis,
  parseHours,
  workLogPostsCharge,
} from "@/modules/delivery/ledger";
import { netFromGross, toMinor } from "@/shared/money";

describe("delivery work logs", () => {
  it("posts 8h × $15 as $120 gross", () => {
    const gross = grossForWorkLog({
      hours: 8,
      hourlyRateMinor: toMinor(15, "USD"),
      fixedMinor: null,
    });
    expect(gross).toBe(toMinor(120, "USD"));
    expect(hoursToMillis(8)).toBe(8000);
  });

  it("reproduces several RNPL-like 8h × $15 lines", () => {
    const rate = toMinor(15, "USD");
    const lines = [8, 8, 8, 8].map((hours) =>
      chargeFromWorkLog({
        billingMode: "hourly",
        hours,
        hourlyRateMinor: rate,
        fixedMinor: null,
        feeBps: 500,
      }),
    );
    expect(lines.every((line) => line.postsCharge)).toBe(true);
    expect(lines.every((line) => line.gross === toMinor(120, "USD"))).toBe(true);
    expect(lines.every((line) => line.net === toMinor(114, "USD"))).toBe(true);
    expect(lines.reduce((sum, line) => sum + line.gross, BigInt(0))).toBe(
      toMinor(480, "USD"),
    );
  });

  it("lets a fixed override win over hours × rate", () => {
    const gross = grossForWorkLog({
      hours: 8,
      hourlyRateMinor: toMinor(15, "USD"),
      fixedMinor: toMinor(700, "USD"),
    });
    expect(gross).toBe(toMinor(700, "USD"));
    expect(netFromGross(gross, 500)).toBe(toMinor(665, "USD"));
  });

  it("allows mixed hourly and fixed lines on the same project", () => {
    const hourly = chargeFromWorkLog({
      billingMode: "hourly",
      hours: 8,
      hourlyRateMinor: toMinor(15, "USD"),
      fixedMinor: null,
      feeBps: 500,
    });
    const fixed = chargeFromWorkLog({
      billingMode: "hourly",
      hours: null,
      hourlyRateMinor: null,
      fixedMinor: toMinor(700, "USD"),
      feeBps: 500,
    });
    expect(hourly.gross).toBe(toMinor(120, "USD"));
    expect(fixed.gross).toBe(toMinor(700, "USD"));
    expect(hourly.postsCharge && fixed.postsCharge).toBe(true);
  });

  it("applies marketplace fees on posted hourly logs", () => {
    const line = chargeFromWorkLog({
      billingMode: "hourly",
      hours: parseHours("8"),
      hourlyRateMinor: toMinor(15, "USD"),
      fixedMinor: null,
      feeBps: 1300,
    });
    expect(line.net).toBe(netFromGross(toMinor(120, "USD"), 1300));
  });

  it("does not post a charge from a work log unless billing_mode is hourly", () => {
    expect(workLogPostsCharge("hourly")).toBe(true);
    expect(workLogPostsCharge("single_charge")).toBe(false);
    expect(workLogPostsCharge("milestones")).toBe(false);
    expect(workLogPostsCharge("none")).toBe(false);
    const logged = chargeFromWorkLog({
      billingMode: "single_charge",
      hours: 8,
      hourlyRateMinor: toMinor(15, "USD"),
      fixedMinor: null,
      feeBps: 500,
    });
    expect(logged.postsCharge).toBe(false);
    expect(logged.net).toBe(BigInt(0));
  });

  it("blocks a contracted project charge on hourly billing", () => {
    expect(() => guardContractedCharge("hourly")).toThrow(/work logs/);
    expect(() => guardContractedCharge("single_charge")).not.toThrow();
    expect(() => guardMilestoneBilling("hourly")).toThrow(/work logs/);
    expect(() => guardMilestoneBilling("milestones")).not.toThrow();
  });
});

describe("project board", () => {
  it("treats custom lists as open and done as closed", () => {
    expect(isOpenBoardColumn("todo")).toBe(true);
    expect(isOpenBoardColumn("doing")).toBe(true);
    expect(isOpenBoardColumn(null)).toBe(true);
    expect(isOpenBoardColumn("done")).toBe(false);
    expect(statusForColumn(null)).toBe("doing");
    expect(statusForColumn("done")).toBe("done");
  });

  it("uses contracted amount as total and outstanding as dues", () => {
    const stats = projectMoneyStats(
      { id: "p1", contractedAmountMinor: toMinor(1806, "USD") },
      [
        {
          id: "c1",
          clientId: "cl",
          projectId: "p1",
          milestoneId: null,
          workLogId: null,
          grossMinor: toMinor(700, "USD"),
          feeBps: 0,
          netMinor: toMinor(700, "USD"),
          currency: "USD",
          chargedOn: "2024-07-31",
          dueOn: null,
          source: "milestone",
          status: "open",
          memo: "kickoff",
          createdAt: "2024-07-31",
          allocatedMinor: toMinor(700, "USD"),
          outstandingMinor: BigInt(0),
          overdue: false,
        },
      ],
    );
    expect(stats.totalPriceMinor).toBe(toMinor(1806, "USD"));
    expect(stats.outstandingMinor).toBe(BigInt(0));
    expect(stats.collectedMinor).toBe(toMinor(700, "USD"));
    expect(stats.remainingMinor).toBe(toMinor(1106, "USD"));
  });
});
