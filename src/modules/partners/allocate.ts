import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allocateEarned,
  receiptEarnBase,
  resolveDistribution,
} from "@/modules/partners/ledger";
import type { DistributionLine } from "@/modules/partners/types";

type Ctx = {
  org: { id: string };
  supabase: SupabaseClient;
};

async function loadLines(
  ctx: Ctx,
  versionId: string,
): Promise<DistributionLine[]> {
  const { data, error } = await ctx.supabase
    .from("distribution_lines")
    .select("partner_id, share_bps")
    .eq("version_id", versionId)
    .eq("organization_id", ctx.org.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    partnerId: row.partner_id as string,
    shareBps: row.share_bps as number,
  }));
}

async function latestProjectVersion(ctx: Ctx, projectId: string) {
  const { data, error } = await ctx.supabase
    .from("distribution_versions")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .is("charge_id", null)
    .order("effective_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id as string, lines: await loadLines(ctx, data.id) };
}

async function chargeOverrideVersion(ctx: Ctx, chargeId: string) {
  const { data, error } = await ctx.supabase
    .from("distribution_versions")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("charge_id", chargeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id as string, lines: await loadLines(ctx, data.id) };
}

export async function allocatePartnersForCharge(
  ctx: Ctx,
  input: {
    chargeId: string;
    projectId: string | null;
    netMinor: bigint;
    currency: string;
    earnedOn: string;
    earnOn: "charge" | "receipt";
  },
) {
  if (!input.projectId || input.earnOn !== "charge") return;
  if (input.netMinor <= BigInt(0)) return;

  const distribution = resolveDistribution({
    chargeOverride: await chargeOverrideVersion(ctx, input.chargeId),
    projectVersion: await latestProjectVersion(ctx, input.projectId),
  });
  if (!distribution) return;

  const rows = allocateEarned(input.netMinor, distribution.lines);
  if (rows.length === 0) return;

  const { error } = await ctx.supabase.from("partner_allocations").insert(
    rows.map((row) => ({
      organization_id: ctx.org.id,
      partner_id: row.partnerId,
      distribution_version_id: distribution.versionId,
      charge_id: input.chargeId,
      earned_minor: row.earnedMinor.toString(),
      currency: input.currency,
      earned_on: input.earnedOn,
      status: "posted",
    })),
  );
  if (error) throw new Error(error.message);
}

export async function allocatePartnersForReceipt(
  ctx: Ctx,
  input: {
    paymentId: string;
    allocations: { id: string; chargeId: string; amountMinor: bigint }[];
  },
) {
  for (const allocation of input.allocations) {
    const { data: charge, error } = await ctx.supabase
      .from("charges")
      .select("id, project_id, gross_minor, net_minor, currency, charged_on, projects(earn_on)")
      .eq("id", allocation.chargeId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!charge?.project_id) continue;

    const projectJoin = Array.isArray(charge.projects)
      ? charge.projects[0]
      : (charge.projects as { earn_on?: string } | null);
    const earnOn = projectJoin?.earn_on === "receipt" ? "receipt" : "charge";
    if (earnOn !== "receipt") continue;

    const distribution = resolveDistribution({
      chargeOverride: await chargeOverrideVersion(ctx, charge.id),
      projectVersion: await latestProjectVersion(ctx, charge.project_id),
    });
    if (!distribution) continue;

    const base = receiptEarnBase({
      grossMinor: BigInt(charge.gross_minor),
      netMinor: BigInt(charge.net_minor),
      allocatedMinor: allocation.amountMinor,
    });
    if (base <= BigInt(0)) continue;

    const rows = allocateEarned(base, distribution.lines);
    const { error: insertError } = await ctx.supabase.from("partner_allocations").insert(
      rows.map((row) => ({
        organization_id: ctx.org.id,
        partner_id: row.partnerId,
        distribution_version_id: distribution.versionId,
        charge_id: charge.id,
        payment_id: input.paymentId,
        payment_allocation_id: allocation.id,
        earned_minor: row.earnedMinor.toString(),
        currency: charge.currency,
        earned_on: charge.charged_on,
        status: "posted",
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }
}

export async function voidPartnerAllocationsForCharge(ctx: Ctx, chargeId: string) {
  const { count } = await ctx.supabase
    .from("partner_allocations")
    .select("id", { count: "exact", head: true })
    .eq("charge_id", chargeId)
    .eq("status", "posted");

  if ((count ?? 0) === 0) return { ok: true as const };

  // Block void if any settlement exists for partners with earned on this charge
  // Simplified: block if any posted settlement exists in org for those partners with earned > 0
  // TRACKER: void blocked if settlements exist
  const { data: allocs } = await ctx.supabase
    .from("partner_allocations")
    .select("partner_id")
    .eq("charge_id", chargeId)
    .eq("status", "posted");

  const partnerIds = [...new Set((allocs ?? []).map((row) => row.partner_id as string))];
  if (partnerIds.length > 0) {
    const { count: settlementCount } = await ctx.supabase
      .from("partner_settlements")
      .select("id", { count: "exact", head: true })
      .in("partner_id", partnerIds)
      .eq("status", "posted");
    if ((settlementCount ?? 0) > 0) {
      return { error: "Cancel is blocked while partner settlements exist for related partners" };
    }
  }

  const { error } = await ctx.supabase
    .from("partner_allocations")
    .update({ status: "void" })
    .eq("charge_id", chargeId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function voidPartnerAllocationsForPayment(ctx: Ctx, paymentId: string) {
  const { data: allocs } = await ctx.supabase
    .from("partner_allocations")
    .select("partner_id")
    .eq("payment_id", paymentId)
    .eq("status", "posted");

  const partnerIds = [...new Set((allocs ?? []).map((row) => row.partner_id as string))];
  if (partnerIds.length > 0) {
    const { count: settlementCount } = await ctx.supabase
      .from("partner_settlements")
      .select("id", { count: "exact", head: true })
      .in("partner_id", partnerIds)
      .eq("status", "posted");
    if ((settlementCount ?? 0) > 0) {
      return { error: "Void is blocked while partner settlements exist for related partners" };
    }
  }

  const { error } = await ctx.supabase
    .from("partner_allocations")
    .update({ status: "void" })
    .eq("payment_id", paymentId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}
