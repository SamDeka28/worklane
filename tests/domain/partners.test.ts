import { describe, expect, it } from "vitest";
import { toMinor } from "@/shared/money";
import {
  allocateEarned,
  assertShareSum,
  compilePoolRemainderDistribution,
  monthlyRegisterBucket,
  partnerPayable,
  receiptEarnBase,
  resolveDistribution,
} from "@/modules/partners/ledger";

describe("partners ledger", () => {
  it("F5 Latisha June: 50% of net after 5% is $332.50 not $350", () => {
    const net = toMinor(665, "USD");
    const rows = allocateEarned(net, [
      { partnerId: "a", shareBps: 5000 },
      { partnerId: "b", shareBps: 5000 },
    ]);
    expect(rows[0].earnedMinor).toBe(toMinor(332.5, "USD"));
    expect(rows[1].earnedMinor).toBe(toMinor(332.5, "USD"));
    expect(rows[0].earnedMinor + rows[1].earnedMinor).toBe(net);
  });

  it("F5 James 60% of net after 5%", () => {
    const net = toMinor(665, "USD");
    const rows = allocateEarned(net, [
      { partnerId: "james", shareBps: 6000 },
      { partnerId: "other", shareBps: 4000 },
    ]);
    expect(rows[0].earnedMinor).toBe(toMinor(399, "USD"));
  });

  it("F12 Hamilton remainder sums to net", () => {
    const net = BigInt(100);
    const rows = allocateEarned(net, [
      { partnerId: "a", shareBps: 3333 },
      { partnerId: "b", shareBps: 3333 },
      { partnerId: "c", shareBps: 3334 },
    ]);
    expect(rows.reduce((sum, row) => sum + row.earnedMinor, BigInt(0))).toBe(net);
  });

  it("F6 payable = earned − settled", () => {
    expect(partnerPayable(toMinor(500, "USD"), toMinor(200, "USD"))).toBe(toMinor(300, "USD"));
  });

  it("F7 client receipt base for earn_on=receipt is pro-rata net", () => {
    const base = receiptEarnBase({
      grossMinor: toMinor(700, "USD"),
      netMinor: toMinor(665, "USD"),
      allocatedMinor: toMinor(350, "USD"),
    });
    expect(base).toBe(toMinor(332.5, "USD"));
  });

  it("F8 charge override wins over project version", () => {
    const resolved = resolveDistribution({
      chargeOverride: {
        id: "charge-v",
        lines: [{ partnerId: "a", shareBps: 7000 }, { partnerId: "b", shareBps: 3000 }],
      },
      projectVersion: {
        id: "project-v",
        lines: [{ partnerId: "a", shareBps: 5000 }, { partnerId: "b", shareBps: 5000 }],
      },
    });
    expect(resolved?.versionId).toBe("charge-v");
    expect(resolved?.lines[0].shareBps).toBe(7000);
  });

  it("compiles pool + remainder into effective project shares", () => {
    const lines = compilePoolRemainderDistribution({
      projectTotalMinor: toMinor(8000, "USD"),
      poolAmountMinor: toMinor(4800, "USD"),
      poolLines: [
        { partnerId: "samudra", poolShareBps: 5000 },
        { partnerId: "rahul", poolShareBps: 5000 },
      ],
      remainderPartnerIds: ["tanuj"],
    });
    assertShareSum(lines);
    const byId = Object.fromEntries(lines.map((line) => [line.partnerId, line]));
    expect(byId.samudra.role).toBe("pool");
    expect(byId.rahul.role).toBe("pool");
    expect(byId.tanuj.role).toBe("remainder");
    expect(byId.samudra.shareBps).toBe(3000);
    expect(byId.rahul.shareBps).toBe(3000);
    expect(byId.tanuj.shareBps).toBe(4000);
  });

  it("rejects shares that do not sum to 10000", () => {
    expect(() =>
      assertShareSum([
        { partnerId: "a", shareBps: 5000 },
        { partnerId: "b", shareBps: 4000 },
      ]),
    ).toThrow(/100%/);
  });

  it("monthly register derives pending", () => {
    const rows = monthlyRegisterBucket([
      {
        partnerId: "a",
        partnerName: "Sam",
        currency: "USD",
        earnedMinor: toMinor(100, "USD"),
        settledMinor: toMinor(40, "USD"),
      },
      {
        partnerId: "a",
        partnerName: "Sam",
        currency: "USD",
        earnedMinor: toMinor(50, "USD"),
        settledMinor: BigInt(0),
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].earnedMinor).toBe(toMinor(150, "USD"));
    expect(rows[0].pendingMinor).toBe(toMinor(110, "USD"));
  });
});
