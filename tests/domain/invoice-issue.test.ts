import { describe, expect, it } from "vitest";
import {
  formatInvoiceNumber,
  invoiceSubtotalMinor,
  lineTotalMinor,
} from "@/modules/invoices/totals";
import { toMinor } from "@/shared/money";

describe("invoice totals", () => {
  it("computes line total with qty and discount in minor units", () => {
    expect(
      lineTotalMinor({
        quantity: 2,
        unitAmountMinor: toMinor(100, "USD"),
        taxBps: 0,
        discountMinor: toMinor(10, "USD"),
      }),
    ).toBe(toMinor(190, "USD"));
  });

  it("applies tax bps on post-discount amount", () => {
    // 100 − 0 = 100; tax 1000 bps = 10% → 110
    expect(
      lineTotalMinor({
        quantity: 1,
        unitAmountMinor: toMinor(100, "USD"),
        taxBps: 1000,
        discountMinor: BigInt(0),
      }),
    ).toBe(toMinor(110, "USD"));
  });

  it("sums invoice lines", () => {
    const total = invoiceSubtotalMinor([
      {
        quantity: 1,
        unitAmountMinor: toMinor(50, "USD"),
        taxBps: 0,
        discountMinor: BigInt(0),
      },
      {
        quantity: 3,
        unitAmountMinor: toMinor(10, "USD"),
        taxBps: 0,
        discountMinor: toMinor(5, "USD"),
      },
    ]);
    expect(total).toBe(toMinor(75, "USD"));
  });

  it("formats invoice numbers with zero padding", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-0001");
    expect(formatInvoiceNumber(42)).toBe("INV-0042");
    expect(formatInvoiceNumber(1234, "WL")).toBe("WL-1234");
  });

  it("rejects non-positive sequences", () => {
    expect(() => formatInvoiceNumber(0)).toThrow();
    expect(() => formatInvoiceNumber(1.5)).toThrow();
  });
});
