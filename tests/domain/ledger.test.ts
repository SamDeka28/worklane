import { describe, expect, it } from "vitest";
import {
  clientMoneySnapshot,
  statementForMonth,
  withChargeOutstanding,
  type ChargeRow,
  type PaymentRow,
} from "@/modules/finance/ledger";
import {
  fifoAllocate,
  monthlyStatement,
  parseMajorToMinor,
  toMinor,
  unallocatedMinor,
} from "@/shared/money";

function charge(partial: Partial<ChargeRow> & { id: string; grossMinor: bigint }): ChargeRow {
  return {
    clientId: "latisha",
    projectId: null,
    milestoneId: null,
    workLogId: null,
    feeBps: 0,
    netMinor: partial.grossMinor,
    currency: "USD",
    chargedOn: "2026-06-01",
    dueOn: null,
    source: "manual",
    status: "open",
    memo: null,
    createdAt: "2026-06-01T00:00:00Z",
    ...partial,
  };
}

function payment(
  partial: Partial<PaymentRow> & { id: string; amountMinor: bigint },
): PaymentRow {
  return {
    clientId: "latisha",
    currency: "USD",
    paidOn: "2026-06-10",
    method: "upwork",
    reference: null,
    kind: "receipt",
    status: "posted",
    createdAt: "2026-06-10T00:00:00Z",
    ...partial,
  };
}

describe("fifo and outstanding", () => {
  it("Latisha $4,500 then $300 then $2,300 leaves $1,900 with no carry-over row", () => {
    const charges = [
      { id: "c1", outstandingMinor: toMinor(4500, "USD") },
    ];
    const first = fifoAllocate(toMinor(300, "USD"), charges);
    expect(first).toEqual([{ chargeId: "c1", amountMinor: toMinor(300, "USD") }]);
    charges[0].outstandingMinor -= first[0].amountMinor;
    const second = fifoAllocate(toMinor(2300, "USD"), charges);
    expect(second).toEqual([{ chargeId: "c1", amountMinor: toMinor(2300, "USD") }]);
    charges[0].outstandingMinor -= second[0].amountMinor;
    expect(charges[0].outstandingMinor).toBe(toMinor(1900, "USD"));

    const rows = [
      charge({ id: "c1", grossMinor: toMinor(4500, "USD") }),
    ];
    const payments = [
      payment({ id: "p1", amountMinor: toMinor(300, "USD") }),
      payment({ id: "p2", amountMinor: toMinor(2300, "USD"), paidOn: "2026-06-20" }),
    ];
    const allocations = [
      { paymentId: "p1", chargeId: "c1", amountMinor: toMinor(300, "USD") },
      { paymentId: "p2", chargeId: "c1", amountMinor: toMinor(2300, "USD") },
    ];
    const snapshot = clientMoneySnapshot(rows, payments, allocations);
    expect(snapshot.outstandingMinor).toBe(toMinor(1900, "USD"));
    expect(snapshot.unallocatedMinor).toBe(BigInt(0));
  });

  it("overpayment becomes unallocated credit instead of extra paid on a charge", () => {
    const open = [{ id: "c1", outstandingMinor: toMinor(100, "USD") }];
    const allocations = fifoAllocate(toMinor(150, "USD"), open);
    expect(unallocatedMinor(toMinor(150, "USD"), allocations)).toBe(toMinor(50, "USD"));
  });

  it("FIFO fills older charges first", () => {
    const allocations = fifoAllocate(toMinor(120, "USD"), [
      { id: "old", outstandingMinor: toMinor(100, "USD") },
      { id: "new", outstandingMinor: toMinor(80, "USD") },
    ]);
    expect(allocations).toEqual([
      { chargeId: "old", amountMinor: toMinor(100, "USD") },
      { chargeId: "new", amountMinor: toMinor(20, "USD") },
    ]);
  });

  it("preferred charge is filled before older unpaid items", () => {
    const allocations = fifoAllocate(
      toMinor(150, "USD"),
      [
        { id: "old", outstandingMinor: toMinor(100, "USD") },
        { id: "picked", outstandingMinor: toMinor(80, "USD") },
      ],
      "picked",
    );
    expect(allocations).toEqual([
      { chargeId: "picked", amountMinor: toMinor(80, "USD") },
      { chargeId: "old", amountMinor: toMinor(70, "USD") },
    ]);
  });

  it("void receipts do not reduce outstanding", () => {
    const views = withChargeOutstanding(
      [charge({ id: "c1", grossMinor: toMinor(1000, "USD") })],
      [{ paymentId: "p1", chargeId: "c1", amountMinor: toMinor(1000, "USD") }],
      [payment({ id: "p1", amountMinor: toMinor(1000, "USD"), status: "void" })],
    );
    expect(views[0].outstandingMinor).toBe(toMinor(1000, "USD"));
  });
});

describe("monthly statement", () => {
  it("opening is derived and is not inserted as a charge", () => {
    const charges = [
      charge({ id: "june", grossMinor: toMinor(1000, "USD"), chargedOn: "2026-06-15" }),
      charge({ id: "july", grossMinor: toMinor(400, "USD"), chargedOn: "2026-07-02" }),
    ];
    const payments = [
      payment({ id: "p1", amountMinor: toMinor(250, "USD"), paidOn: "2026-06-20" }),
    ];
    const july = statementForMonth(charges, payments, "2026-07");
    expect(july.opening).toBe(toMinor(750, "USD"));
    expect(july.newCharges).toBe(toMinor(400, "USD"));
    expect(july.payments).toBe(BigInt(0));
    expect(july.closing).toBe(toMinor(1150, "USD"));

    const fromHelper = monthlyStatement({
      charges: charges.map((row) => ({
        amountMinor: row.grossMinor,
        on: row.chargedOn,
        status: row.status,
      })),
      receipts: payments.map((row) => ({
        amountMinor: row.amountMinor,
        on: row.paidOn,
        status: row.status,
      })),
      refunds: [],
      periodStart: "2026-07-01",
      periodEndExclusive: "2026-08-01",
    });
    expect(fromHelper.opening).toBe(july.opening);
  });

  it("refunds increase outstanding in the month they post", () => {
    const result = monthlyStatement({
      charges: [{ amountMinor: toMinor(1000, "USD"), on: "2026-08-01", status: "open" }],
      receipts: [{ amountMinor: toMinor(1000, "USD"), on: "2026-08-02", status: "posted" }],
      refunds: [{ amountMinor: toMinor(200, "USD"), on: "2026-08-10", status: "posted" }],
      periodStart: "2026-08-01",
      periodEndExclusive: "2026-09-01",
    });
    expect(result.payments).toBe(toMinor(800, "USD"));
    expect(result.closing).toBe(toMinor(200, "USD"));
  });
});

describe("parseMajorToMinor", () => {
  it("parses dollars without floats", () => {
    expect(parseMajorToMinor("4500", "USD")).toBe(toMinor(4500, "USD"));
    expect(parseMajorToMinor("332.50", "USD")).toBe(toMinor(332.5, "USD"));
    expect(parseMajorToMinor("1,900.00", "USD")).toBe(toMinor(1900, "USD"));
  });
});
