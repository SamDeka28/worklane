import { cache } from "react";
import { requireOrg } from "@/modules/identity/org";
import { monthlyRegisterBucket } from "@/modules/partners/ledger";
import type {
  DistributionVersion,
  MonthlyRegisterRow,
  PartnerKind,
  PartnerRecord,
  PartnerSettlement,
  ProjectMemberRecord,
} from "@/modules/partners/types";
import { splitByBps, type IsoCurrency } from "@/shared/money";

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

function asKind(value: string): PartnerKind {
  if (value === "originator" || value === "referral") return value;
  return "participant";
}

async function partnerAvatarUrls(ctx: Awaited<ReturnType<typeof requireOrg>>, userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map<string, string | null>();
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, avatar_url")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id as string, (row.avatar_url as string | null) ?? null]));
}

export const listPartners = cache(async (orgSlug: string): Promise<PartnerRecord[]> => {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("partners")
    .select("id, name, kind, email, user_id, notes, active, created_at")
    .eq("organization_id", ctx.org.id)
    .order("name");
  if (error) throw new Error(error.message);
  const avatars = await partnerAvatarUrls(ctx, (data ?? []).map((row) => row.user_id as string | null));
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: asKind(row.kind),
    email: (row.email as string | null) ?? null,
    userId: row.user_id,
    avatarUrl: row.user_id ? avatars.get(row.user_id as string) ?? null : null,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
  }));
});

export async function listProjectPartners(
  orgSlug: string,
  projectId: string,
): Promise<PartnerRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_partners")
    .select("partner_id, partners(id, name, kind, email, user_id, notes, active, created_at)")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);

  const partners = (data ?? [])
    .map((row) => {
      const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
      if (!partner) return null;
      return {
        id: partner.id as string,
        name: partner.name as string,
        kind: asKind(partner.kind as string),
        email: (partner.email as string | null) ?? null,
        userId: (partner.user_id as string | null) ?? null,
        notes: (partner.notes as string | null) ?? null,
        active: Boolean(partner.active),
        createdAt: partner.created_at as string,
      } satisfies PartnerRecord;
    })
    .filter((row): row is PartnerRecord => Boolean(row));
  const avatars = await partnerAvatarUrls(ctx, partners.map((partner) => partner.userId));
  return partners
    .map((partner) => ({
      ...partner,
      avatarUrl: partner.userId ? avatars.get(partner.userId) ?? null : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listProjectPartnersByProject(
  orgSlug: string,
): Promise<Record<string, PartnerRecord[]>> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_partners")
    .select("project_id, partners(id, name, kind, email, user_id, notes, active, created_at)")
    .eq("organization_id", ctx.org.id);
  if (error) throw new Error(error.message);

  const byProject: Record<string, PartnerRecord[]> = {};
  for (const row of data ?? []) {
    const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
    if (!partner) continue;
    const projectId = row.project_id as string;
    const list = byProject[projectId] ?? [];
    list.push({
      id: partner.id as string,
      name: partner.name as string,
      kind: asKind(partner.kind as string),
      email: (partner.email as string | null) ?? null,
      userId: (partner.user_id as string | null) ?? null,
      notes: (partner.notes as string | null) ?? null,
      active: Boolean(partner.active),
      createdAt: partner.created_at as string,
    });
    byProject[projectId] = list;
  }
  const avatars = await partnerAvatarUrls(
    ctx,
    Object.values(byProject).flatMap((partners) => partners.map((partner) => partner.userId)),
  );
  for (const projectId of Object.keys(byProject)) {
    byProject[projectId] = byProject[projectId]
      .map((partner) => ({
        ...partner,
        avatarUrl: partner.userId ? avatars.get(partner.userId) ?? null : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return byProject;
}

export async function listProjectMembers(
  orgSlug: string,
  projectId: string,
): Promise<ProjectMemberRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_members")
    .select("id, project_id, user_id, role, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    role: row.role === "lead" ? "lead" : "member",
    createdAt: row.created_at as string,
    isYou: row.user_id === ctx.userId,
  }));
}

export async function listProjectDistributions(
  orgSlug: string,
  projectId: string,
): Promise<DistributionVersion[]> {
  const ctx = await requireOrg(orgSlug);
  const { data: versions, error } = await ctx.supabase
    .from("distribution_versions")
    .select("id, project_id, charge_id, label, effective_on, pool_amount_minor, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .order("effective_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (versions ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data: lines, error: linesError } = await ctx.supabase
    .from("distribution_lines")
    .select("version_id, partner_id, share_bps, role, pool_share_bps")
    .eq("organization_id", ctx.org.id)
    .in("version_id", ids);
  if (linesError) throw new Error(linesError.message);

  return (versions ?? []).map((version) => {
    const poolAmountMinor =
      version.pool_amount_minor == null ? null : BigInt(version.pool_amount_minor);
    return {
      id: version.id,
      projectId: version.project_id,
      chargeId: version.charge_id,
      label: version.label,
      effectiveOn: version.effective_on,
      poolAmountMinor,
      createdAt: version.created_at,
      lines: (lines ?? [])
        .filter((line) => line.version_id === version.id)
        .map((line) => ({
          partnerId: line.partner_id as string,
          shareBps: line.share_bps as number,
          role: (line.role === "remainder" ? "remainder" : "pool") as "pool" | "remainder",
          poolShareBps:
            line.pool_share_bps == null ? null : (line.pool_share_bps as number),
        })),
    };
  });
}

export async function listPartnerSettlements(orgSlug: string): Promise<PartnerSettlement[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("partner_settlements")
    .select("id, partner_id, amount_minor, currency, settled_on, method, memo, status")
    .eq("organization_id", ctx.org.id)
    .order("settled_on", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    partnerId: row.partner_id,
    amountMinor: BigInt(row.amount_minor),
    currency: asCurrency(row.currency),
    settledOn: row.settled_on,
    method: row.method,
    memo: row.memo,
    status: row.status === "void" ? "void" : "posted",
  }));
}

export async function loadMonthlyPartnerRegister(
  orgSlug: string,
  month: string,
): Promise<MonthlyRegisterRow[]> {
  const ctx = await requireOrg(orgSlug);
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [partners, allocRes, settleRes] = await Promise.all([
    listPartners(orgSlug),
    ctx.supabase
      .from("partner_allocations")
      .select("id, partner_id, earned_minor, currency, charge_id, distribution_version_id, payment_allocation_id, payment_id, earned_on")
      .eq("organization_id", ctx.org.id)
      .eq("status", "posted")
      .gte("earned_on", start)
      .lt("earned_on", nextMonth),
    ctx.supabase
      .from("partner_settlements")
      .select("id, partner_id, amount_minor, currency, settled_on, method, memo")
      .eq("organization_id", ctx.org.id)
      .eq("status", "posted")
      .gte("settled_on", start)
      .lt("settled_on", nextMonth),
  ]);

  if (allocRes.error) throw new Error(allocRes.error.message);
  if (settleRes.error) throw new Error(settleRes.error.message);

  const allocations = allocRes.data ?? [];
  const chargeIds = [...new Set(allocations.map((row) => row.charge_id))];
  const distributionVersionIds = [...new Set(
    allocations.flatMap((row) => row.distribution_version_id ? [row.distribution_version_id] : []),
  )];
  const paymentAllocationIds = [...new Set(
    allocations.flatMap((row) => row.payment_allocation_id ? [row.payment_allocation_id] : []),
  )];
  const paymentIds = [...new Set(
    allocations.flatMap((row) => row.payment_id ? [row.payment_id] : []),
  )];
  const [chargeRes, paymentAllocationRes, distributionLinesRes, paymentRes] = await Promise.all([
    chargeIds.length > 0
      ? ctx.supabase
          .from("charges")
          .select("id, project_id, memo, charged_on, gross_minor, net_minor, projects(name)")
          .eq("organization_id", ctx.org.id)
          .in("id", chargeIds)
      : Promise.resolve(null),
    paymentAllocationIds.length > 0
      ? ctx.supabase
          .from("payment_allocations")
          .select("id, amount_minor")
          .eq("organization_id", ctx.org.id)
          .in("id", paymentAllocationIds)
      : Promise.resolve(null),
    distributionVersionIds.length > 0
      ? ctx.supabase
          .from("distribution_lines")
          .select("version_id, partner_id, share_bps")
          .eq("organization_id", ctx.org.id)
          .in("version_id", distributionVersionIds)
      : Promise.resolve(null),
    paymentIds.length > 0
      ? ctx.supabase
          .from("payments")
          .select("id, paid_on")
          .eq("organization_id", ctx.org.id)
          .in("id", paymentIds)
      : Promise.resolve(null),
  ]);
  if (chargeRes?.error) throw new Error(chargeRes.error.message);
  if (paymentAllocationRes?.error) throw new Error(paymentAllocationRes.error.message);
  if (distributionLinesRes?.error) throw new Error(distributionLinesRes.error.message);
  if (paymentRes?.error) throw new Error(paymentRes.error.message);

  const chargeById = new Map((chargeRes?.data ?? []).map((row) => [row.id, row]));
  const paymentAllocationById = new Map((paymentAllocationRes?.data ?? []).map((row) => [row.id, row]));
  const paymentDateById = new Map((paymentRes?.data ?? []).map((row) => [row.id, row.paid_on]));
  const distributionLinesByVersion = new Map<string, { partnerId: string; shareBps: number }[]>();
  for (const line of distributionLinesRes?.data ?? []) {
    const lines = distributionLinesByVersion.get(line.version_id) ?? [];
    lines.push({ partnerId: line.partner_id, shareBps: line.share_bps });
    distributionLinesByVersion.set(line.version_id, lines);
  }

  const nameById = new Map(partners.map((partner) => [partner.id, partner.name]));
  const avatarById = new Map(partners.map((partner) => [partner.id, partner.avatarUrl ?? null]));
  const seed = new Map<string, {
    gross: bigint;
    deductions: bigint;
    earned: bigint;
    settled: bigint;
    currency: string;
    sources: MonthlyRegisterRow["sources"];
    settlements: MonthlyRegisterRow["settlements"];
  }>();

  for (const row of allocations) {
    const key = `${row.partner_id}:${row.currency}`;
    const existing = seed.get(key) ?? {
      gross: BigInt(0),
      deductions: BigInt(0),
      earned: BigInt(0),
      settled: BigInt(0),
      currency: row.currency as string,
      sources: [],
      settlements: [],
    };
    const earnedMinor = BigInt(row.earned_minor);
    const charge = chargeById.get(row.charge_id);
    const paymentAllocation = row.payment_allocation_id
      ? paymentAllocationById.get(row.payment_allocation_id)
      : null;
    const grossBase = paymentAllocation
      ? BigInt(paymentAllocation.amount_minor)
      : BigInt(charge?.gross_minor ?? row.earned_minor);
    const netBase = paymentAllocation && charge && BigInt(charge.gross_minor) > BigInt(0)
      ? (grossBase * BigInt(charge.net_minor)) / BigInt(charge.gross_minor)
      : BigInt(charge?.net_minor ?? grossBase);
    const lines = row.distribution_version_id
      ? distributionLinesByVersion.get(row.distribution_version_id) ?? []
      : [];
    const shareTotal = lines.reduce((total, line) => total + line.shareBps, 0);
    const partnerIndex = lines.findIndex((line) => line.partnerId === row.partner_id);
    const grossShare = shareTotal === 10_000 && partnerIndex >= 0
      ? splitByBps(grossBase, lines.map((line) => line.shareBps))[partnerIndex] ?? earnedMinor
      : netBase > BigInt(0)
        ? (earnedMinor * grossBase) / netBase
        : earnedMinor;
    existing.gross += grossShare;
    existing.deductions += grossShare > earnedMinor ? grossShare - earnedMinor : BigInt(0);
    existing.earned += earnedMinor;
    const projectJoin = charge?.projects as
      | { name?: string }
      | { name?: string }[]
      | null
      | undefined;
    const projectName = Array.isArray(projectJoin)
      ? projectJoin[0]?.name
      : projectJoin?.name;
    existing.sources.push({
      id: row.id,
      projectId: (charge?.project_id as string | null) ?? "",
      projectName: projectName ?? "Project",
      chargeName: charge?.memo ?? "Untitled charge",
      date: paymentDateById.get(row.payment_id ?? "") ?? row.earned_on,
      dateLabel: row.payment_id ? "Collected" : "Earned",
      currency: asCurrency(row.currency),
      chargeGrossMinor: BigInt(charge?.gross_minor ?? grossBase),
      grossMinor: grossShare,
      deductionMinor: grossShare > earnedMinor ? grossShare - earnedMinor : BigInt(0),
      earnedMinor,
    });
    seed.set(key, existing);
  }
  for (const row of settleRes.data ?? []) {
    const key = `${row.partner_id}:${row.currency}`;
    const existing = seed.get(key) ?? {
      gross: BigInt(0),
      deductions: BigInt(0),
      earned: BigInt(0),
      settled: BigInt(0),
      currency: row.currency as string,
      sources: [],
      settlements: [],
    };
    existing.settled += BigInt(row.amount_minor);
    existing.settlements.push({
      id: row.id,
      settledOn: row.settled_on,
      amountMinor: BigInt(row.amount_minor),
      currency: asCurrency(row.currency),
      method: row.method,
      memo: row.memo,
    });
    seed.set(key, existing);
  }

  const rows = [...seed.entries()].map(([key, value]) => {
    const partnerId = key.split(":")[0];
    return {
      partnerId,
      partnerName: nameById.get(partnerId) ?? "Partner",
      partnerAvatarUrl: avatarById.get(partnerId) ?? null,
      currency: value.currency,
      grossMinor: value.gross,
      deductionMinor: value.deductions,
      earnedMinor: value.earned,
      settledMinor: value.settled,
      sources: value.sources,
      settlements: value.settlements,
    };
  });

  return monthlyRegisterBucket(rows).map((row) => ({
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    partnerAvatarUrl: row.partnerAvatarUrl ?? null,
    currency: asCurrency(row.currency),
    grossMinor: row.grossMinor ?? BigInt(0),
    deductionMinor: row.deductionMinor ?? BigInt(0),
    earnedMinor: row.earnedMinor,
    settledMinor: row.settledMinor,
    pendingMinor: row.pendingMinor,
    sources: row.sources ?? [],
    settlements: row.settlements ?? [],
  }));
}

export const loadPartnerBalances = cache(async (orgSlug: string) => {
  const ctx = await requireOrg(orgSlug);
  const partners = await listPartners(orgSlug);
  const [allocRes, settleRes] = await Promise.all([
    ctx.supabase
      .from("partner_allocations")
      .select("partner_id, earned_minor, currency")
      .eq("organization_id", ctx.org.id)
      .eq("status", "posted"),
    ctx.supabase
      .from("partner_settlements")
      .select("partner_id, amount_minor, currency")
      .eq("organization_id", ctx.org.id)
      .eq("status", "posted"),
  ]);
  if (allocRes.error) throw new Error(allocRes.error.message);
  if (settleRes.error) throw new Error(settleRes.error.message);

  return partners.map((partner) => {
    const earned = (allocRes.data ?? [])
      .filter((row) => row.partner_id === partner.id)
      .reduce((sum, row) => sum + BigInt(row.earned_minor), BigInt(0));
    const settled = (settleRes.data ?? [])
      .filter((row) => row.partner_id === partner.id)
      .reduce((sum, row) => sum + BigInt(row.amount_minor), BigInt(0));
    const currency =
      asCurrency(
        (allocRes.data ?? []).find((row) => row.partner_id === partner.id)?.currency ??
          ctx.org.defaultCurrency,
      );
    return {
      partnerId: partner.id,
      name: partner.name,
      kind: partner.kind,
      currency,
      earnedMinor: earned,
      settledMinor: settled,
      payableMinor: earned - settled,
      active: partner.active,
    };
  });
});

export async function loadUserPartnerEarnings(
  orgSlug: string,
  userId: string,
  month: string,
): Promise<{
  total: { currency: IsoCurrency; amountMinor: bigint }[];
  thisMonth: { currency: IsoCurrency; amountMinor: bigint }[];
}> {
  const ctx = await requireOrg(orgSlug);
  const { data: partners, error: partnerError } = await ctx.supabase
    .from("partners")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("user_id", userId);
  if (partnerError) throw new Error(partnerError.message);
  const partnerIds = (partners ?? []).map((row) => row.id as string);
  if (partnerIds.length === 0) return { total: [], thisMonth: [] };

  const { data: allocations, error } = await ctx.supabase
    .from("partner_allocations")
    .select("earned_minor, currency, earned_on")
    .eq("organization_id", ctx.org.id)
    .eq("status", "posted")
    .in("partner_id", partnerIds);
  if (error) throw new Error(error.message);

  const totalByCurrency = new Map<IsoCurrency, bigint>();
  const monthByCurrency = new Map<IsoCurrency, bigint>();
  for (const row of allocations ?? []) {
    const currency = asCurrency(row.currency as string);
    const amount = BigInt(row.earned_minor);
    totalByCurrency.set(currency, (totalByCurrency.get(currency) ?? BigInt(0)) + amount);
    if ((row.earned_on as string).slice(0, 7) === month) {
      monthByCurrency.set(currency, (monthByCurrency.get(currency) ?? BigInt(0)) + amount);
    }
  }
  const toTotals = (totals: Map<IsoCurrency, bigint>) =>
    [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amountMinor]) => ({ currency, amountMinor }));
  return { total: toTotals(totalByCurrency), thisMonth: toTotals(monthByCurrency) };
}

/** Posted partner earnings for a project's charges (charge- or receipt-timed). */
export async function loadProjectPartnerEarnings(
  orgSlug: string,
  projectId: string,
): Promise<{
  rows: { partnerId: string; earnedMinor: bigint; grossMinor: bigint }[];
  details: {
    partnerId: string;
    chargeId: string;
    earnedMinor: bigint;
    grossMinor: bigint;
    earnedOn: string;
  }[];
  totalEarnedMinor: bigint;
}> {
  const ctx = await requireOrg(orgSlug);
  const { data: charges, error: chargesError } = await ctx.supabase
    .from("charges")
    .select("id, gross_minor")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .neq("status", "void");
  if (chargesError) throw new Error(chargesError.message);

  const chargeIds = (charges ?? []).map((row) => row.id as string);
  if (chargeIds.length === 0) {
    return { rows: [], details: [], totalEarnedMinor: BigInt(0) };
  }

  const { data: allocations, error: allocError } = await ctx.supabase
    .from("partner_allocations")
    .select("partner_id, charge_id, earned_minor, earned_on, distribution_version_id, payment_allocation_id")
    .eq("organization_id", ctx.org.id)
    .eq("status", "posted")
    .in("charge_id", chargeIds)
    .order("earned_on", { ascending: false });
  if (allocError) throw new Error(allocError.message);

  const paymentAllocationIds = [...new Set(
    (allocations ?? [])
      .map((row) => row.payment_allocation_id as string | null)
      .filter((id): id is string => Boolean(id)),
  )];
  const distributionVersionIds = [...new Set(
    (allocations ?? []).map((row) => row.distribution_version_id as string),
  )];
  const [paymentAllocationResult, distributionLineResult] = await Promise.all([
    paymentAllocationIds.length > 0
      ? ctx.supabase
          .from("payment_allocations")
          .select("id, amount_minor")
          .eq("organization_id", ctx.org.id)
          .in("id", paymentAllocationIds)
      : Promise.resolve({ data: [], error: null }),
    distributionVersionIds.length > 0
      ? ctx.supabase
          .from("distribution_lines")
          .select("version_id, partner_id, share_bps")
          .eq("organization_id", ctx.org.id)
          .in("version_id", distributionVersionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentAllocationResult.error) throw new Error(paymentAllocationResult.error.message);
  if (distributionLineResult.error) throw new Error(distributionLineResult.error.message);

  const grossByCharge = new Map(
    (charges ?? []).map((row) => [row.id as string, BigInt(row.gross_minor)]),
  );
  const allocatedGrossByPaymentAllocation = new Map(
    (paymentAllocationResult.data ?? []).map((row) => [row.id as string, BigInt(row.amount_minor)]),
  );
  const linesByVersion = new Map<string, { partnerId: string; shareBps: number }[]>();
  for (const row of distributionLineResult.data ?? []) {
    const versionId = row.version_id as string;
    const versionLines = linesByVersion.get(versionId) ?? [];
    versionLines.push({ partnerId: row.partner_id as string, shareBps: row.share_bps as number });
    linesByVersion.set(versionId, versionLines);
  }

  const byPartner = new Map<string, bigint>();
  const grossByPartner = new Map<string, bigint>();
  const details: {
    partnerId: string;
    chargeId: string;
    earnedMinor: bigint;
    grossMinor: bigint;
    earnedOn: string;
  }[] = [];

  for (const row of allocations ?? []) {
    const partnerId = row.partner_id as string;
    const earnedMinor = BigInt(row.earned_minor);
    const chargeId = row.charge_id as string;
    const versionId = row.distribution_version_id as string;
    const lines = linesByVersion.get(versionId) ?? [];
    const partnerLineIndex = lines.findIndex((line) => line.partnerId === partnerId);
    const grossBase = row.payment_allocation_id
      ? allocatedGrossByPaymentAllocation.get(row.payment_allocation_id as string) ?? BigInt(0)
      : grossByCharge.get(chargeId) ?? BigInt(0);
    const grossParts = lines.length > 0 ? splitByBps(grossBase, lines.map((line) => line.shareBps)) : [];
    const grossMinor = partnerLineIndex >= 0 ? grossParts[partnerLineIndex] ?? BigInt(0) : BigInt(0);
    byPartner.set(partnerId, (byPartner.get(partnerId) ?? BigInt(0)) + earnedMinor);
    grossByPartner.set(partnerId, (grossByPartner.get(partnerId) ?? BigInt(0)) + grossMinor);
    details.push({
      partnerId,
      chargeId,
      earnedMinor,
      grossMinor,
      earnedOn: row.earned_on as string,
    });
  }

  const rows = [...byPartner.entries()].map(([partnerId, earnedMinor]) => ({
    partnerId,
    earnedMinor,
    grossMinor: grossByPartner.get(partnerId) ?? BigInt(0),
  }));
  const totalEarnedMinor = rows.reduce((sum, row) => sum + row.earnedMinor, BigInt(0));
  return { rows, details, totalEarnedMinor };
}

export type FinancePartnerShare = {
  partnerId: string;
  partnerName: string;
  earnedMinor: bigint;
  shareBps: number;
  currency: IsoCurrency;
  projectId: string | null;
};

export type FinancePartnerMonthStrip = {
  earnedMinor: bigint;
  settledMinor: bigint;
  payableMinor: bigint;
  currency: IsoCurrency;
};

export type FinancePartnerPayable = {
  partnerId: string;
  partnerName: string;
  currency: IsoCurrency;
  payableMinor: bigint;
  earnedMinor: bigint;
  settledMinor: bigint;
};

export type FinancePartnerFlow = {
  byChargeId: Record<string, FinancePartnerShare[]>;
  byPaymentId: Record<string, FinancePartnerShare[]>;
  month: FinancePartnerMonthStrip | null;
  payables: FinancePartnerPayable[];
};

function sharesFromAllocations(
  rows: {
    partnerId: string;
    partnerName: string;
    earnedMinor: bigint;
    currency: IsoCurrency;
    projectId: string | null;
  }[],
): FinancePartnerShare[] {
  const total = rows.reduce((sum, row) => sum + row.earnedMinor, BigInt(0));
  return rows
    .filter((row) => row.earnedMinor > BigInt(0))
    .map((row) => ({
      ...row,
      shareBps:
        total > BigInt(0)
          ? Number((row.earnedMinor * BigInt(10_000)) / total)
          : 0,
    }))
    .sort((a, b) => {
      if (a.earnedMinor === b.earnedMinor) return a.partnerName.localeCompare(b.partnerName);
      return a.earnedMinor > b.earnedMinor ? -1 : 1;
    });
}

/** Read-only partner share lines for Finance Collect / Money in / Month wrap. */
export async function loadFinancePartnerFlow(
  orgSlug: string,
  opts: {
    chargeIds?: string[];
    paymentIds?: string[];
    month?: string;
    /** Load org-wide partner payables for settle actions (Collect / Month wrap). */
    includePayables?: boolean;
  } = {},
): Promise<FinancePartnerFlow> {
  const chargeIds = [...new Set(opts.chargeIds ?? [])].filter(Boolean);
  const paymentIds = [...new Set(opts.paymentIds ?? [])].filter(Boolean);
  const needAllocs = chargeIds.length > 0 || paymentIds.length > 0;

  const empty: FinancePartnerFlow = {
    byChargeId: {},
    byPaymentId: {},
    month: null,
    payables: [],
  };
  if (!needAllocs && !opts.month && !opts.includePayables) return empty;

  const ctx = await requireOrg(orgSlug);
  const partners = await listPartners(orgSlug);
  const nameById = new Map(partners.map((partner) => [partner.id, partner.name]));

  const byChargeId: Record<string, FinancePartnerShare[]> = {};
  const byPaymentId: Record<string, FinancePartnerShare[]> = {};

  if (needAllocs) {
    const allocRows: {
      partner_id: string;
      charge_id: string;
      payment_id: string | null;
      earned_minor: string | number;
      currency: string;
    }[] = [];

    if (chargeIds.length > 0) {
      const { data, error } = await ctx.supabase
        .from("partner_allocations")
        .select("partner_id, charge_id, payment_id, earned_minor, currency")
        .eq("organization_id", ctx.org.id)
        .eq("status", "posted")
        .in("charge_id", chargeIds);
      if (error) throw new Error(error.message);
      allocRows.push(...((data ?? []) as typeof allocRows));
    }
    if (paymentIds.length > 0) {
      const { data, error } = await ctx.supabase
        .from("partner_allocations")
        .select("partner_id, charge_id, payment_id, earned_minor, currency")
        .eq("organization_id", ctx.org.id)
        .eq("status", "posted")
        .in("payment_id", paymentIds);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as typeof allocRows) {
        if (!allocRows.some((existing) =>
          existing.partner_id === row.partner_id &&
          existing.charge_id === row.charge_id &&
          existing.payment_id === row.payment_id &&
          String(existing.earned_minor) === String(row.earned_minor)
        )) {
          allocRows.push(row);
        }
      }
    }

    const relatedChargeIds = [...new Set(allocRows.map((row) => row.charge_id))];
    const projectByCharge = new Map<string, string | null>();
    if (relatedChargeIds.length > 0) {
      const { data: charges, error: chargeError } = await ctx.supabase
        .from("charges")
        .select("id, project_id")
        .eq("organization_id", ctx.org.id)
        .in("id", relatedChargeIds);
      if (chargeError) throw new Error(chargeError.message);
      for (const row of charges ?? []) {
        projectByCharge.set(row.id as string, (row.project_id as string | null) ?? null);
      }
    }

    const chargeBuckets = new Map<
      string,
      {
        partnerId: string;
        partnerName: string;
        earnedMinor: bigint;
        currency: IsoCurrency;
        projectId: string | null;
      }[]
    >();
    const paymentBuckets = new Map<
      string,
      {
        partnerId: string;
        partnerName: string;
        earnedMinor: bigint;
        currency: IsoCurrency;
        projectId: string | null;
      }[]
    >();

    for (const row of allocRows) {
      const partnerId = row.partner_id;
      const chargeId = row.charge_id;
      const paymentId = row.payment_id;
      const earnedMinor = BigInt(row.earned_minor);
      const currency = asCurrency(row.currency);
      const projectId = projectByCharge.get(chargeId) ?? null;
      const entry = {
        partnerId,
        partnerName: nameById.get(partnerId) ?? "Partner",
        earnedMinor,
        currency,
        projectId,
      };

      // Charge-timed earns (no payment) attach to the charge.
      if (!paymentId) {
        const list = chargeBuckets.get(chargeId) ?? [];
        list.push(entry);
        chargeBuckets.set(chargeId, list);
      } else {
        const list = paymentBuckets.get(paymentId) ?? [];
        list.push(entry);
        paymentBuckets.set(paymentId, list);
      }
    }

    for (const [chargeId, list] of chargeBuckets) {
      byChargeId[chargeId] = sharesFromAllocations(list);
    }
    for (const [paymentId, list] of paymentBuckets) {
      byPaymentId[paymentId] = sharesFromAllocations(list);
    }
  }

  let month: FinancePartnerMonthStrip | null = null;
  let payables: FinancePartnerPayable[] = [];

  if (opts.month || opts.includePayables) {
    const balances = await loadPartnerBalances(orgSlug);
    payables = balances
      .filter((row) => row.payableMinor > BigInt(0))
      .map((row) => ({
        partnerId: row.partnerId,
        partnerName: row.name,
        currency: row.currency,
        payableMinor: row.payableMinor,
        earnedMinor: row.earnedMinor,
        settledMinor: row.settledMinor,
      }))
      .sort((a, b) => {
        if (a.payableMinor === b.payableMinor) {
          return a.partnerName.localeCompare(b.partnerName);
        }
        return a.payableMinor > b.payableMinor ? -1 : 1;
      });

    if (opts.month) {
      const register = await loadMonthlyPartnerRegister(orgSlug, opts.month);
      const earnedMinor = register.reduce((sum, row) => sum + row.earnedMinor, BigInt(0));
      const settledMinor = register.reduce((sum, row) => sum + row.settledMinor, BigInt(0));
      const payableMinor = balances.reduce((sum, row) => sum + row.payableMinor, BigInt(0));
      const currency =
        register[0]?.currency ??
        balances.find((row) => row.payableMinor > BigInt(0) || row.earnedMinor > BigInt(0))
          ?.currency ??
        asCurrency(ctx.org.defaultCurrency);

      if (
        earnedMinor > BigInt(0) ||
        settledMinor > BigInt(0) ||
        payableMinor > BigInt(0)
      ) {
        month = { earnedMinor, settledMinor, payableMinor, currency };
      }
    }
  }

  return { byChargeId, byPaymentId, month, payables };
}
