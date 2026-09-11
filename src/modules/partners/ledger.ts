import { splitByBps } from "@/shared/money";
import type {
  DistributionLine,
  DistributionLineRole,
} from "@/modules/partners/types";

/** F5/F12: split net (or receipt slice) across partner share_bps. */
export function allocateEarned(
  amountMinor: bigint,
  lines: DistributionLine[],
): { partnerId: string; shareBps: number; earnedMinor: bigint }[] {
  if (lines.length === 0) return [];
  const shares = lines.map((line) => line.shareBps);
  const parts = splitByBps(amountMinor, shares);
  return lines.map((line, index) => ({
    partnerId: line.partnerId,
    shareBps: line.shareBps,
    earnedMinor: parts[index] ?? BigInt(0),
  }));
}

export function assertShareSum(
  lines: ReadonlyArray<{ shareBps: number; partnerId?: string }>,
) {
  const total = lines.reduce((sum, line) => sum + line.shareBps, 0);
  if (total !== 10_000) {
    throw new Error(`Shares must sum to 100%, got ${(total / 100).toFixed(2)}%`);
  }
}

function equalBps(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(10_000 / count);
  const shares = Array.from({ length: count }, () => base);
  let leftover = 10_000 - base * count;
  for (let i = 0; leftover > 0; i += 1, leftover -= 1) {
    shares[i]! += 1;
  }
  return shares;
}

/** Hamilton: convert absolute minor amounts into project share_bps summing to 10000. */
export function amountsToShareBps(amounts: bigint[], projectTotalMinor: bigint): number[] {
  if (projectTotalMinor <= BigInt(0)) {
    throw new Error("Project total must be greater than zero");
  }
  const floors = amounts.map((amount) => {
    const scaled = amount * BigInt(10_000);
    return {
      floor: Number(scaled / projectTotalMinor),
      frac: scaled % projectTotalMinor,
    };
  });
  let leftover = 10_000 - floors.reduce((sum, row) => sum + row.floor, 0);
  const order = floors
    .map((row, index) => ({ index, frac: row.frac }))
    .sort((a, b) => (a.frac === b.frac ? a.index - b.index : a.frac > b.frac ? -1 : 1));
  const bps = floors.map((row) => row.floor);
  for (const row of order) {
    if (leftover <= 0) break;
    bps[row.index]! += 1;
    leftover -= 1;
  }
  return bps;
}

export type PoolCompileInput = {
  projectTotalMinor: bigint;
  poolAmountMinor: bigint;
  poolLines: { partnerId: string; poolShareBps: number }[];
  remainderPartnerIds: string[];
};

export type CompiledDistributionLine = {
  partnerId: string;
  role: DistributionLineRole;
  shareBps: number;
  poolShareBps: number | null;
};

/**
 * Build/target pool partners split poolAmount; remainder partner(s) get the rest.
 * Output share_bps is effective % of the full project (sums to 100%).
 */
export function compilePoolRemainderDistribution(
  input: PoolCompileInput,
): CompiledDistributionLine[] {
  const { projectTotalMinor, poolAmountMinor, poolLines, remainderPartnerIds } = input;

  if (projectTotalMinor <= BigInt(0)) {
    throw new Error(
      "Add milestone prices (or a contracted total) before setting a split — after fee there must be a distributable amount",
    );
  }
  if (poolAmountMinor <= BigInt(0)) {
    throw new Error("Enter a build / target pool amount");
  }
  if (poolAmountMinor > projectTotalMinor) {
    throw new Error("Pool cannot exceed the distributable amount (after platform fee)");
  }
  if (poolLines.length === 0) {
    throw new Error("Pick at least one partner for the build pool");
  }

  const poolIds = new Set(poolLines.map((line) => line.partnerId));
  for (const id of remainderPartnerIds) {
    if (poolIds.has(id)) {
      throw new Error("A partner can’t be both in the pool and the remainder");
    }
  }

  assertShareSum(poolLines.map((line) => ({ shareBps: line.poolShareBps })));

  const remainderAmount = projectTotalMinor - poolAmountMinor;

  if (remainderPartnerIds.length === 0) {
    if (remainderAmount !== BigInt(0)) {
      throw new Error("Pick who takes the remainder, or set the pool equal to the project total");
    }
    return poolLines.map((line) => ({
      partnerId: line.partnerId,
      role: "pool" as const,
      shareBps: line.poolShareBps,
      poolShareBps: line.poolShareBps,
    }));
  }

  if (remainderAmount <= BigInt(0)) {
    throw new Error(
      "Pool uses the full project total — remove the remainder partner or lower the pool",
    );
  }

  const poolParts = splitByBps(
    poolAmountMinor,
    poolLines.map((line) => line.poolShareBps),
  );
  const remParts = splitByBps(remainderAmount, equalBps(remainderPartnerIds.length));

  const rows: {
    partnerId: string;
    role: DistributionLineRole;
    poolShareBps: number | null;
    amount: bigint;
  }[] = [
    ...poolLines.map((line, index) => ({
      partnerId: line.partnerId,
      role: "pool" as const,
      poolShareBps: line.poolShareBps,
      amount: poolParts[index] ?? BigInt(0),
    })),
    ...remainderPartnerIds.map((partnerId, index) => ({
      partnerId,
      role: "remainder" as const,
      poolShareBps: null,
      amount: remParts[index] ?? BigInt(0),
    })),
  ];

  const shareBps = amountsToShareBps(
    rows.map((row) => row.amount),
    projectTotalMinor,
  );

  return rows.map((row, index) => ({
    partnerId: row.partnerId,
    role: row.role,
    shareBps: shareBps[index] ?? 0,
    poolShareBps: row.poolShareBps,
  }));
}

/** F6: payable = earned − settled (never negative display clamp optional). */
export function partnerPayable(earnedMinor: bigint, settledMinor: bigint): bigint {
  return earnedMinor - settledMinor;
}

/**
 * When earn_on = receipt, partner earns on the collected slice of net.
 * Pro-rata: receiptAllocatedToCharge / gross * net.
 */
export function receiptEarnBase(input: {
  grossMinor: bigint;
  netMinor: bigint;
  allocatedMinor: bigint;
}): bigint {
  if (input.grossMinor <= BigInt(0)) return BigInt(0);
  return (input.allocatedMinor * input.netMinor) / input.grossMinor;
}

export function resolveDistribution(input: {
  chargeOverride: { id: string; lines: DistributionLine[] } | null;
  projectVersion: { id: string; lines: DistributionLine[] } | null;
}): { versionId: string; lines: DistributionLine[] } | null {
  if (input.chargeOverride && input.chargeOverride.lines.length > 0) {
    return { versionId: input.chargeOverride.id, lines: input.chargeOverride.lines };
  }
  if (input.projectVersion && input.projectVersion.lines.length > 0) {
    return { versionId: input.projectVersion.id, lines: input.projectVersion.lines };
  }
  return null;
}

export function monthlyRegisterBucket(
  rows: {
    partnerId: string;
    partnerName: string;
    currency: string;
    earnedMinor: bigint;
    settledMinor: bigint;
  }[],
): {
  partnerId: string;
  partnerName: string;
  currency: string;
  earnedMinor: bigint;
  settledMinor: bigint;
  pendingMinor: bigint;
}[] {
  const map = new Map<
    string,
    {
      partnerId: string;
      partnerName: string;
      currency: string;
      earnedMinor: bigint;
      settledMinor: bigint;
    }
  >();

  for (const row of rows) {
    const key = `${row.partnerId}:${row.currency}`;
    const existing = map.get(key);
    if (existing) {
      existing.earnedMinor += row.earnedMinor;
      existing.settledMinor += row.settledMinor;
    } else {
      map.set(key, { ...row });
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      pendingMinor: partnerPayable(row.earnedMinor, row.settledMinor),
    }))
    .sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}

export function formatPoolSplitSummary(input: {
  poolAmountMinor: bigint | null;
  projectTotalMinor: bigint;
  lines: DistributionLine[];
  partnerName: (id: string) => string;
  money: (minor: bigint) => string;
}): string | null {
  const { poolAmountMinor, projectTotalMinor, lines, partnerName, money } = input;
  if (lines.length === 0) return null;

  if (poolAmountMinor == null || projectTotalMinor <= BigInt(0)) {
    return lines
      .map((line) => `${partnerName(line.partnerId)} ${(line.shareBps / 100).toFixed(0)}%`)
      .join(" · ");
  }

  const remainderAmount = projectTotalMinor - poolAmountMinor;
  const poolLines = lines.filter((line) => (line.role ?? "pool") === "pool");
  const remLines = lines.filter((line) => line.role === "remainder");

  const poolBits = poolLines.map((line) => {
    const poolShare =
      line.poolShareBps != null
        ? line.poolShareBps
        : Number((BigInt(line.shareBps) * projectTotalMinor) / poolAmountMinor);
    return `${partnerName(line.partnerId)} ${(poolShare / 100).toFixed(0)}%`;
  });

  const remBits = remLines.map(
    (line) => `${partnerName(line.partnerId)} remainder (${money(remainderAmount)})`,
  );

  return `Pool ${money(poolAmountMinor)} · ${poolBits.join(" / ")}${
    remBits.length ? ` · ${remBits.join(" · ")}` : ""
  }`;
}
