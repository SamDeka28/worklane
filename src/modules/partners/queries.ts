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
import type { IsoCurrency } from "@/shared/money";

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

function asKind(value: string): PartnerKind {
  if (value === "originator" || value === "referral") return value;
  return "participant";
}

export async function listPartners(orgSlug: string): Promise<PartnerRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("partners")
    .select("id, name, kind, email, user_id, notes, active, created_at")
    .eq("organization_id", ctx.org.id)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: asKind(row.kind),
    email: (row.email as string | null) ?? null,
    userId: row.user_id,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
  }));
}

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

  return (data ?? [])
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
    .filter((row): row is PartnerRecord => Boolean(row))
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
  for (const projectId of Object.keys(byProject)) {
    byProject[projectId].sort((a, b) => a.name.localeCompare(b.name));
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
      .select("partner_id, earned_minor, currency")
      .eq("organization_id", ctx.org.id)
      .eq("status", "posted")
      .gte("earned_on", start)
      .lt("earned_on", nextMonth),
    ctx.supabase
      .from("partner_settlements")
      .select("partner_id, amount_minor, currency")
      .eq("organization_id", ctx.org.id)
      .eq("status", "posted")
      .gte("settled_on", start)
      .lt("settled_on", nextMonth),
  ]);

  if (allocRes.error) throw new Error(allocRes.error.message);
  if (settleRes.error) throw new Error(settleRes.error.message);

  const nameById = new Map(partners.map((partner) => [partner.id, partner.name]));
  const seed = new Map<string, { earned: bigint; settled: bigint; currency: string }>();

  for (const row of allocRes.data ?? []) {
    const key = `${row.partner_id}:${row.currency}`;
    const existing = seed.get(key) ?? {
      earned: BigInt(0),
      settled: BigInt(0),
      currency: row.currency as string,
    };
    existing.earned += BigInt(row.earned_minor);
    seed.set(key, existing);
  }
  for (const row of settleRes.data ?? []) {
    const key = `${row.partner_id}:${row.currency}`;
    const existing = seed.get(key) ?? {
      earned: BigInt(0),
      settled: BigInt(0),
      currency: row.currency as string,
    };
    existing.settled += BigInt(row.amount_minor);
    seed.set(key, existing);
  }

  const rows = [...seed.entries()].map(([key, value]) => {
    const partnerId = key.split(":")[0];
    return {
      partnerId,
      partnerName: nameById.get(partnerId) ?? "Partner",
      currency: value.currency,
      earnedMinor: value.earned,
      settledMinor: value.settled,
    };
  });

  return monthlyRegisterBucket(rows).map((row) => ({
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    currency: asCurrency(row.currency),
    earnedMinor: row.earnedMinor,
    settledMinor: row.settledMinor,
    pendingMinor: row.pendingMinor,
  }));
}

export async function loadPartnerBalances(orgSlug: string) {
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
}

/** Posted partner earnings for a project's charges (charge- or receipt-timed). */
export async function loadProjectPartnerEarnings(
  orgSlug: string,
  projectId: string,
): Promise<{
  rows: { partnerId: string; earnedMinor: bigint }[];
  details: {
    partnerId: string;
    chargeId: string;
    earnedMinor: bigint;
    earnedOn: string;
  }[];
  totalEarnedMinor: bigint;
}> {
  const ctx = await requireOrg(orgSlug);
  const { data: charges, error: chargesError } = await ctx.supabase
    .from("charges")
    .select("id")
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
    .select("partner_id, charge_id, earned_minor, earned_on")
    .eq("organization_id", ctx.org.id)
    .eq("status", "posted")
    .in("charge_id", chargeIds)
    .order("earned_on", { ascending: false });
  if (allocError) throw new Error(allocError.message);

  const byPartner = new Map<string, bigint>();
  const details: {
    partnerId: string;
    chargeId: string;
    earnedMinor: bigint;
    earnedOn: string;
  }[] = [];

  for (const row of allocations ?? []) {
    const partnerId = row.partner_id as string;
    const earnedMinor = BigInt(row.earned_minor);
    byPartner.set(partnerId, (byPartner.get(partnerId) ?? BigInt(0)) + earnedMinor);
    details.push({
      partnerId,
      chargeId: row.charge_id as string,
      earnedMinor,
      earnedOn: row.earned_on as string,
    });
  }

  const rows = [...byPartner.entries()].map(([partnerId, earnedMinor]) => ({
    partnerId,
    earnedMinor,
  }));
  const totalEarnedMinor = rows.reduce((sum, row) => sum + row.earnedMinor, BigInt(0));
  return { rows, details, totalEarnedMinor };
}
