"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, requireWritableOrg } from "@/modules/identity/org";
import { canDeleteModule } from "@/modules/identity/permissions";
import { notify, userLabel } from "@/modules/notifications/service";
import {
  assertShareSum,
  compilePoolRemainderDistribution,
} from "@/modules/partners/ledger";
import type { PartnerKind } from "@/modules/partners/types";
import { formatMoney, netFromGross, parseMajorToMinor } from "@/shared/money";
import type { IsoCurrency } from "@/shared/money";

function asKind(value: string): PartnerKind {
  if (value === "originator" || value === "referral") return value;
  return "participant";
}

function asCurrency(value: string, fallback: IsoCurrency): IsoCurrency {
  return value === "INR" || value === "USD" ? value : fallback;
}

async function loadClientCurrencyForPartner(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  clientId: string,
): Promise<IsoCurrency | null> {
  const { data } = await ctx.supabase
    .from("clients")
    .select("currency")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!data) return null;
  return asCurrency(data.currency as string, ctx.org.defaultCurrency);
}

export async function createPartnerAction(orgSlug: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const kind = asKind(String(formData.get("kind") ?? "participant"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  let notesDoc: unknown = null;
  const notesDocRaw = String(formData.get("notes_doc") ?? "").trim();
  if (notesDocRaw) {
    try {
      notesDoc = JSON.parse(notesDocRaw);
    } catch {
      return { error: "Invalid notes document" };
    }
  }
  if (!name) return { error: "Partner name is required" };
  if (!email || !email.includes("@")) return { error: "Enter a valid email" };

  const { data, error } = await ctx.supabase
    .from("partners")
    .insert({
      organization_id: ctx.org.id,
      name,
      email,
      kind,
      notes,
      notes_doc: notesDoc,
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message?.includes("partners_org_email_uidx")) {
      return { error: "A partner with that email already exists" };
    }
    return { error: error?.message ?? "Could not create partner" };
  }

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "partner",
    entity_id: data.id,
    metadata: { name, kind, email },
  });

  const { inviteOrgMemberAction } = await import("@/modules/team/actions");
  const inviteData = new FormData();
  inviteData.set("email", email);
  inviteData.set("role", "partner");
  inviteData.set("partner_id", data.id as string);
  inviteData.set("display_name", name);
  const invite = await inviteOrgMemberAction(orgSlug, inviteData);
  if (invite.error) {
    revalidatePath(`/${orgSlug}/partners`);
    return {
      id: data.id as string,
      warning: `Partner saved, but invite failed: ${invite.error}`,
    };
  }

  revalidatePath(`/${orgSlug}/partners`);
  revalidatePath(`/${orgSlug}/team`);
  return {
    id: data.id as string,
    emailed: invite.emailed,
    acceptUrl: invite.acceptUrl,
    alreadyMember: invite.alreadyMember,
  };
}

export async function updatePartnerAction(orgSlug: string, partnerId: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const name = String(formData.get("name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw || null;
  const kind = asKind(String(formData.get("kind") ?? "participant"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const active = String(formData.get("active") ?? "true") !== "false";
  if (!name) return { error: "Partner name is required" };
  if (email && !email.includes("@")) return { error: "Enter a valid email" };

  const { error } = await ctx.supabase
    .from("partners")
    .update({ name, email, kind, notes, active })
    .eq("id", partnerId)
    .eq("organization_id", ctx.org.id);
  if (error) {
    if (error.message.includes("partners_org_email_uidx")) {
      return { error: "A partner with that email already exists" };
    }
    return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/partners`);
  return { ok: true as const };
}

/** Send (or re-send) a login invite for an existing partner profile. */
export async function invitePartnerLoginAction(orgSlug: string, partnerId: string) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only owners and admins can invite partners" };
  }

  const { data: partner, error } = await ctx.supabase
    .from("partners")
    .select("id, name, email, user_id")
    .eq("id", partnerId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!partner) return { error: "Partner not found" };
  if (partner.user_id) return { error: "This partner already has a login" };

  const email = String(partner.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Add an email on the partner before inviting" };
  }

  const { inviteOrgMemberAction } = await import("@/modules/team/actions");
  const inviteData = new FormData();
  inviteData.set("email", email);
  inviteData.set("role", "partner");
  inviteData.set("partner_id", partner.id as string);
  inviteData.set("display_name", String(partner.name ?? ""));
  const invite = await inviteOrgMemberAction(orgSlug, inviteData);
  if (invite.error) return { error: invite.error };

  revalidatePath(`/${orgSlug}/partners`);
  revalidatePath(`/${orgSlug}/team`);
  return {
    ok: true as const,
    emailed: invite.emailed,
    acceptUrl: invite.acceptUrl,
    alreadyMember: invite.alreadyMember,
  };
}

export async function setProjectDistributionAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const label = String(formData.get("label") ?? "").trim() || null;
  const effectiveOn =
    String(formData.get("effective_on") ?? "") || new Date().toISOString().slice(0, 10);
  const chargeId = String(formData.get("charge_id") ?? "").trim() || null;

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, contracted_amount_minor, client_id, default_fee_bps")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!project) return { error: "Project not found" };

  const currency = await loadClientCurrencyForPartner(ctx, project.client_id as string);
  if (!currency) return { error: "Client not found" };

  const { data: milestoneRows } = await ctx.supabase
    .from("milestones")
    .select("amount_minor, status")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);

  let milestoneTotal = BigInt(0);
  for (const row of milestoneRows ?? []) {
    if (row.status === "cancelled" || row.amount_minor == null) continue;
    milestoneTotal += BigInt(row.amount_minor);
  }
  const contracted =
    project.contracted_amount_minor == null
      ? BigInt(0)
      : BigInt(project.contracted_amount_minor);
  const grossMinor = milestoneTotal > BigInt(0) ? milestoneTotal : contracted;
  const feeBps = Number(project.default_fee_bps ?? 0);
  const projectTotalMinor = netFromGross(grossMinor, Number.isFinite(feeBps) ? feeBps : 0);

  const poolRaw = String(formData.get("pool_amount") ?? "").trim();
  let poolAmountMinor: bigint;
  try {
    poolAmountMinor = parseMajorToMinor(poolRaw, currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid pool amount" };
  }

  const partnerIds = formData.getAll("partner_id").map(String);
  const roles = formData.getAll("role").map(String);
  const shareRaws = formData.getAll("share_pct").map(String);

  const poolLines: { partnerId: string; poolShareBps: number }[] = [];
  const remainderPartnerIds: string[] = [];

  for (let index = 0; index < partnerIds.length; index += 1) {
    const partnerId = partnerIds[index];
    if (!partnerId) continue;
    const role = roles[index] === "remainder" ? "remainder" : "pool";
    if (role === "remainder") {
      remainderPartnerIds.push(partnerId);
      continue;
    }
    const pct = Number(shareRaws[index] ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    poolLines.push({ partnerId, poolShareBps: Math.round(pct * 100) });
  }

  const { data: assigned, error: assignedError } = await ctx.supabase
    .from("project_partners")
    .select("partner_id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  if (assignedError) return { error: assignedError.message };

  const allowed = new Set((assigned ?? []).map((row) => row.partner_id as string));
  if (allowed.size === 0) {
    return { error: "Add partners to this project before setting a split" };
  }
  const allIds = [...poolLines.map((line) => line.partnerId), ...remainderPartnerIds];
  if (allIds.some((id) => !allowed.has(id))) {
    return { error: "Split can only include partners assigned to this project" };
  }
  if (new Set(allIds).size !== allIds.length) {
    return { error: "Each partner can appear only once in the split" };
  }

  let compiled;
  try {
    compiled = compilePoolRemainderDistribution({
      projectTotalMinor,
      poolAmountMinor,
      poolLines,
      remainderPartnerIds,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid split" };
  }

  try {
    assertShareSum(compiled);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid shares" };
  }

  const { data: version, error } = await ctx.supabase
    .from("distribution_versions")
    .insert({
      organization_id: ctx.org.id,
      project_id: projectId,
      charge_id: chargeId,
      label,
      effective_on: effectiveOn,
      pool_amount_minor: poolAmountMinor.toString(),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !version) return { error: error?.message ?? "Could not save split" };

  const { error: linesError } = await ctx.supabase.from("distribution_lines").insert(
    compiled.map((line) => ({
      organization_id: ctx.org.id,
      version_id: version.id,
      partner_id: line.partnerId,
      share_bps: line.shareBps,
      role: line.role,
      pool_share_bps: line.poolShareBps,
    })),
  );
  if (linesError) return { error: linesError.message };

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "updated",
    entity_type: "project",
    entity_id: projectId,
    metadata: {
      distribution_version_id: version.id,
      charge_id: chargeId,
      pool_amount_minor: poolAmountMinor.toString(),
    },
  });

  revalidatePath(`/${orgSlug}/partners`);
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { id: version.id as string };
}

export async function addProjectPartnersAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const partnerIds = [
    ...new Set(formData.getAll("partner_id").map(String).filter(Boolean)),
  ];
  if (partnerIds.length === 0) return { error: "Choose at least one partner" };

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!project) return { error: "Project not found" };

  const { data: partners, error: partnersError } = await ctx.supabase
    .from("partners")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .in("id", partnerIds);
  if (partnersError) return { error: partnersError.message };
  if ((partners ?? []).length !== partnerIds.length) {
    return { error: "One or more partners were not found" };
  }

  const { error } = await ctx.supabase.from("project_partners").upsert(
    partnerIds.map((partnerId) => ({
      organization_id: ctx.org.id,
      project_id: projectId,
      partner_id: partnerId,
    })),
    { onConflict: "project_id,partner_id", ignoreDuplicates: true },
  );
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/partners`);
  return { ok: true as const };
}

export async function removeProjectPartnerAction(
  orgSlug: string,
  projectId: string,
  partnerId: string,
) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const { error } = await ctx.supabase
    .from("project_partners")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .eq("partner_id", partnerId);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/partners`);
  return { ok: true as const };
}

export async function addProjectMembersAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const userIds = [...new Set(formData.getAll("user_id").map(String).filter(Boolean))];
  const role = String(formData.get("role") ?? "member") === "lead" ? "lead" : "member";
  if (userIds.length === 0) return { error: "Choose at least one teammate" };

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!project) return { error: "Project not found" };

  const { data: existing } = await ctx.supabase
    .from("project_members")
    .select("user_id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .in("user_id", userIds);
  const alreadyMembers = new Set(
    (existing ?? []).map((row) => row.user_id as string),
  );

  const { data: members, error: membersError } = await ctx.supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", ctx.org.id)
    .eq("status", "active")
    .in("user_id", userIds)
    .in("role", ["owner", "admin", "member"]);
  if (membersError) return { error: membersError.message };
  if ((members ?? []).length !== userIds.length) {
    return { error: "Only active studio members can be added to a project" };
  }

  const { error } = await ctx.supabase.from("project_members").upsert(
    userIds.map((userId) => ({
      organization_id: ctx.org.id,
      project_id: projectId,
      user_id: userId,
      role,
    })),
    { onConflict: "project_id,user_id" },
  );
  if (error) return { error: error.message };

  const actor = await userLabel(ctx.userId);
  await notify({
    recipients: userIds.filter((id) => !alreadyMembers.has(id)),
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    category: "projects",
    title: `${actor} added you to ${project.name as string}`,
    body:
      role === "lead"
        ? "You're the project lead."
        : "You can now see this project's board and tasks.",
    href: `/${orgSlug}/projects/${projectId}`,
    actorId: ctx.userId,
    entity: { type: "project", id: projectId },
    actionLabel: "Open project",
  });

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true as const };
}

export async function removeProjectMemberAction(
  orgSlug: string,
  projectId: string,
  userId: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("project_members")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true as const };
}

export async function recordPartnerSettlementAction(orgSlug: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const partnerId = String(formData.get("partner_id") ?? "");
  const method = String(formData.get("method") ?? "other");
  const settledOn =
    String(formData.get("settled_on") ?? "") || new Date().toISOString().slice(0, 10);
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const currency = asCurrency(
    String(formData.get("currency") ?? ctx.org.defaultCurrency),
    ctx.org.defaultCurrency,
  );

  if (!partnerId) return { error: "Choose a partner" };
  if (!["upwork", "bank", "stripe", "other"].includes(method)) {
    return { error: "Unknown method" };
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseMajorToMinor(String(formData.get("amount") ?? ""), currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount" };
  }
  if (amountMinor <= BigInt(0)) return { error: "Amount must be greater than zero" };

  const { data, error } = await ctx.supabase
    .from("partner_settlements")
    .insert({
      organization_id: ctx.org.id,
      partner_id: partnerId,
      amount_minor: amountMinor.toString(),
      currency,
      settled_on: settledOn,
      method,
      memo,
      status: "posted",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not record settlement" };

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "settled",
    entity_type: "partner",
    entity_id: partnerId,
    metadata: { settlement_id: data.id, amount_minor: amountMinor.toString() },
  });

  const { data: partner } = await ctx.supabase
    .from("partners")
    .select("user_id")
    .eq("id", partnerId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  await notify({
    recipients: [partner?.user_id as string | null],
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    category: "partners",
    title: `Payout recorded: ${formatMoney({ amountMinor, currency })}`,
    body: `${ctx.org.name} recorded a settlement on ${settledOn}${memo ? ` · ${memo}` : ""}.`,
    href: `/${orgSlug}/partners`,
    actorId: ctx.userId,
    entity: { type: "partner_settlement", id: data.id as string },
    actionLabel: "View balance",
  });

  revalidatePath(`/${orgSlug}/partners`);
  return { id: data.id as string };
}

export async function voidPartnerSettlementAction(orgSlug: string, settlementId: string) {
  const ctx = await requireModuleWrite(orgSlug, "partners");
  const { error } = await ctx.supabase
    .from("partner_settlements")
    .update({ status: "void" })
    .eq("id", settlementId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/partners`);
  return { ok: true as const };
}

export async function deletePartnerAction(
  orgSlug: string,
  partnerId: string,
  confirmName: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!canDeleteModule(ctx, "partners")) {
    return { error: "You don’t have permission to delete partners" };
  }
  const { data: partner } = await ctx.supabase
    .from("partners")
    .select("id, name")
    .eq("id", partnerId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!partner) return { error: "Partner not found" };
  if (confirmName.trim() !== String(partner.name).trim()) {
    return { error: "Partner name doesn’t match" };
  }

  const linked = await Promise.all(
    (
      [
        ["distribution_lines", "project split"],
        ["partner_allocations", "earning"],
        ["partner_settlements", "settlement"],
      ] as const
    ).map(async ([table, noun]) => {
      const { count } = await ctx.supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId);
      return count ? `${count} ${noun}${count === 1 ? "" : "s"}` : null;
    }),
  );
  const blockers = linked.filter(Boolean);
  if (blockers.length > 0) {
    return {
      error: `${partner.name} has ${blockers.join(", ")} on record. Set them to Inactive instead to keep the history.`,
    };
  }

  const { error, count } = await ctx.supabase
    .from("partners")
    .delete({ count: "exact" })
    .eq("id", partnerId)
    .eq("organization_id", ctx.org.id);
  if (error) {
    if (error.code === "23503") {
      return { error: "This partner has earnings history, so it can’t be deleted. Set them to Inactive instead." };
    }
    return { error: error.message };
  }
  if (!count) return { error: "You don’t have permission to delete this partner" };

  revalidatePath(`/${orgSlug}/partners`);
  revalidatePath(`/${orgSlug}/finance`);
  return { ok: true as const };
}
