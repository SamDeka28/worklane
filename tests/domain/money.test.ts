import { describe, expect, it } from "vitest";
import {
  grossFromHours,
  netFromGross,
  splitByBps,
  toMinor,
  workbookLine,
} from "@/shared/money";

describe("money", () => {
  it("computes hourly gross without floats", () => {
    expect(grossFromHours(8, toMinor(15, "USD"))).toBe(toMinor(120, "USD"));
    expect(grossFromHours(7.3, toMinor(10, "USD"))).toBe(BigInt(7300));
  });

  it("applies marketplace fees on gross", () => {
    expect(netFromGross(toMinor(120, "USD"), 500)).toBe(toMinor(114, "USD"));
    expect(netFromGross(toMinor(120, "USD"), 0)).toBe(toMinor(120, "USD"));
    expect(netFromGross(toMinor(120, "USD"), 1300)).toBe(toMinor(104.4, "USD"));
    expect(netFromGross(toMinor(104, "USD"), 400)).toBe(toMinor(99.84, "USD"));
  });

  it("reproduces the 2026 workbook formula for a 50/50 Upwork line", () => {
    const line = workbookLine({
      hours: 8,
      hourlyRateMinor: toMinor(15, "USD"),
      feeBps: 500,
      shareBps: 5000,
    });
    expect(line.gross).toBe(toMinor(120, "USD"));
    expect(line.net).toBe(toMinor(114, "USD"));
    expect(line.partnerEarned).toBe(toMinor(57, "USD"));
  });

  it("computes Latisha June correctly at $332.50 not the sheet $350", () => {
    const line = workbookLine({
      fixedMinor: toMinor(700, "USD"),
      feeBps: 500,
      shareBps: 5000,
    });
    expect(line.net).toBe(toMinor(665, "USD"));
    expect(line.partnerEarned).toBe(toMinor(332.5, "USD"));
  });

  it("computes James Parcel 60% of net after 5%", () => {
    const line = workbookLine({
      fixedMinor: toMinor(700, "USD"),
      feeBps: 500,
      shareBps: 6000,
    });
    expect(line.partnerEarned).toBe(toMinor(399, "USD"));
  });

  it("Hamilton remainder always sums to the amount", () => {
    const parts = splitByBps(BigInt(100), [3333, 3333, 3334]);
    expect(parts.reduce((sum, part) => sum + part, BigInt(0))).toBe(BigInt(100));
  });

  it("rejects share_bps that do not sum to 10000", () => {
    expect(() => splitByBps(BigInt(100), [5000, 4000])).toThrow(/10000/);
  });
});
