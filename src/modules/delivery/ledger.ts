import { grossFromHours, netFromGross } from "@/shared/money";
import type { BillingMode } from "@/modules/delivery/types";

export function parseHours(raw: string): number {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) {
    throw new Error("Hours are required");
  }
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) {
    throw new Error("Enter hours with up to 3 decimal places");
  }
  const hours = Number(cleaned);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Hours must be greater than zero");
  }
  return hours;
}

export function hoursToMillis(hours: number): number {
  return Math.round(hours * 1000);
}

export function millisToHours(millis: number): number {
  return millis / 1000;
}

export function formatHoursMillis(millis: number): string {
  return Number.parseFloat(millisToHours(millis).toFixed(3)).toString();
}

export function workLogPostsCharge(mode: BillingMode): boolean {
  return mode === "hourly";
}

export function allowsContractedProjectCharge(mode: BillingMode): boolean {
  return mode === "single_charge" || mode === "manual";
}

export function allowsMilestoneBilling(mode: BillingMode): boolean {
  return mode === "milestones" || mode === "manual";
}

export function grossForWorkLog(input: {
  hours: number | null;
  hourlyRateMinor: bigint | null;
  fixedMinor: bigint | null;
}): bigint {
  if (input.fixedMinor != null && input.fixedMinor > BigInt(0)) {
    return input.fixedMinor;
  }
  if (input.hours != null && input.hourlyRateMinor != null && input.hourlyRateMinor > BigInt(0)) {
    const gross = grossFromHours(input.hours, input.hourlyRateMinor);
    if (gross <= BigInt(0)) {
      throw new Error("Work log amount must be greater than zero");
    }
    return gross;
  }
  throw new Error("Enter hours and a rate, or a fixed amount");
}

export function chargeFromWorkLog(input: {
  billingMode: BillingMode;
  hours: number | null;
  hourlyRateMinor: bigint | null;
  fixedMinor: bigint | null;
  feeBps: number;
}): { postsCharge: boolean; gross: bigint; net: bigint } {
  const gross = grossForWorkLog(input);
  const postsCharge = workLogPostsCharge(input.billingMode);
  return {
    postsCharge,
    gross,
    net: postsCharge ? netFromGross(gross, input.feeBps) : BigInt(0),
  };
}

export function guardContractedCharge(mode: BillingMode): void {
  if (mode === "hourly") {
    throw new Error(
      "Hourly projects bill from work logs. Do not also post a contracted project charge.",
    );
  }
  if (!allowsContractedProjectCharge(mode)) {
    throw new Error("This billing mode does not post a single contracted charge");
  }
}

export function guardMilestoneBilling(mode: BillingMode): void {
  if (mode === "hourly") {
    throw new Error(
      "Hourly projects bill from work logs. Bill a milestone only on a milestone-billed project.",
    );
  }
  if (!allowsMilestoneBilling(mode)) {
    throw new Error("This billing mode does not bill milestones as charges");
  }
}
