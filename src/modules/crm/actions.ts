"use server";

import { revalidatePath } from "next/cache";
import { slugifyStageName } from "@/modules/crm/types";
import { requireWritableOrg } from "@/modules/identity/org";
import { canDeleteModule } from "@/modules/identity/permissions";
import { notify, userLabel } from "@/modules/notifications/service";
import { parseMajorToMinor, type IsoCurrency } from "@/shared/money";

function asCurrency(value: string, fallback: IsoCurrency): IsoCurrency {
  return value === "INR" || value === "USD" ? value : fallback;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,#]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function parseNotesDoc(formData: FormData): Record<string, unknown> | null {
  const raw = String(formData.get("notes_doc") ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function recordActivity(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  verb: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb,
    entity_type: "lead",
    entity_id: entityId,
    metadata,
  });
}

async function orgStageSlugs(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
): Promise<Set<string>> {
  const { data } = await ctx.supabase
    .from("lead_stages")
    .select("slug")
    .eq("organization_id", ctx.org.id);
  return new Set((data ?? []).map((row) => String(row.slug)));
}

async function defaultStageSlug(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
): Promise<string> {
  const { data } = await ctx.supabase
    .from("lead_stages")
    .select("slug")
    .eq("organization_id", ctx.org.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.slug ? String(data.slug) : "new";
}

async function resolveStageSlug(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  raw: string,
): Promise<string> {
  const slug = raw.trim();
  const known = await orgStageSlugs(ctx);
  if (slug && known.has(slug)) return slug;
  if (known.size === 0 && slug) return slug;
  return defaultStageSlug(ctx);
}

export async function createLeadAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Lead name is required" };

  const currency = asCurrency(
    String(formData.get("currency") ?? ctx.org.defaultCurrency),
    ctx.org.defaultCurrency,
  );
  const estimatedRaw = String(formData.get("estimated_value") ?? "").trim();
  let estimatedValueMinor: string | null = null;
  if (estimatedRaw) {
    try {
      estimatedValueMinor = parseMajorToMinor(estimatedRaw, currency).toString();
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid estimate" };
    }
  }

  const stage = await resolveStageSlug(ctx, String(formData.get("stage") ?? ""));
  const notesDoc = parseNotesDoc(formData);
  const notesPlain = String(formData.get("notes") ?? "").trim() || null;

  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      organization_id: ctx.org.id,
      name,
      company: String(formData.get("company") ?? "").trim() || null,
      contact_name: String(formData.get("contact_name") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      source: String(formData.get("source") ?? "").trim() || null,
      estimated_value_minor: estimatedValueMinor,
      currency,
      close_on: String(formData.get("close_on") ?? "").trim() || null,
      owner_user_id: ctx.userId,
      tags: parseTags(String(formData.get("tags") ?? "")),
      notes: notesPlain,
      notes_doc: notesDoc,
      stage,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create lead" };

  await recordActivity(ctx, "created", data.id, { name, stage });
  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { id: data.id as string };
}

export async function updateLeadAction(
  orgSlug: string,
  leadId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Lead name is required" };

  const currency = asCurrency(
    String(formData.get("currency") ?? ctx.org.defaultCurrency),
    ctx.org.defaultCurrency,
  );
  const estimatedRaw = String(formData.get("estimated_value") ?? "").trim();
  let estimatedValueMinor: string | null = null;
  if (estimatedRaw) {
    try {
      estimatedValueMinor = parseMajorToMinor(estimatedRaw, currency).toString();
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid estimate" };
    }
  }

  const stage = await resolveStageSlug(ctx, String(formData.get("stage") ?? ""));
  const notesDoc = parseNotesDoc(formData);

  const { error } = await ctx.supabase
    .from("leads")
    .update({
      name,
      company: String(formData.get("company") ?? "").trim() || null,
      contact_name: String(formData.get("contact_name") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      source: String(formData.get("source") ?? "").trim() || null,
      estimated_value_minor: estimatedValueMinor,
      currency,
      close_on: String(formData.get("close_on") ?? "").trim() || null,
      tags: parseTags(String(formData.get("tags") ?? "")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      notes_doc: notesDoc,
      stage,
    })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  await recordActivity(ctx, "updated", leadId, { name, stage });
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export async function moveLeadStageAction(
  orgSlug: string,
  leadId: string,
  stage: string,
  orderedIds?: string[],
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  const resolved = await resolveStageSlug(ctx, stage);
  if (resolved !== stage.trim()) return { error: "Unknown stage" };

  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("name, stage, owner_user_id")
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("leads")
    .update({ stage: resolved })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  if (orderedIds && orderedIds.length > 0) {
    for (const [index, id] of orderedIds.entries()) {
      const { error: posError } = await ctx.supabase
        .from("leads")
        .update({ position: index, stage: resolved })
        .eq("id", id)
        .eq("organization_id", ctx.org.id);
      if (posError) return { error: posError.message };
    }
  }

  await recordActivity(ctx, "stage_moved", leadId, { stage: resolved });

  if (lead && lead.stage !== resolved) {
    const [{ data: stageRow }, actor] = await Promise.all([
      ctx.supabase
        .from("lead_stages")
        .select("name")
        .eq("organization_id", ctx.org.id)
        .eq("slug", resolved)
        .maybeSingle(),
      userLabel(ctx.userId),
    ]);
    await notify({
      recipients: [lead.owner_user_id as string | null],
      organizationId: ctx.org.id,
      orgName: ctx.org.name,
      category: "leads",
      title: `${actor} moved ${lead.name as string} to ${(stageRow?.name as string | undefined) ?? resolved}`,
      body: "A lead you own changed stage.",
      href: `/${orgSlug}/crm`,
      actorId: ctx.userId,
      entity: { type: "lead", id: leadId },
      actionLabel: "Open pipeline",
    });
  }

  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function createLeadStageAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Stage name is required" };

  const { data: existing } = await ctx.supabase
    .from("lead_stages")
    .select("slug, position, system_key")
    .eq("organization_id", ctx.org.id)
    .order("position", { ascending: true });

  const used = new Set((existing ?? []).map((row) => String(row.slug)));
  let slug = slugifyStageName(name);
  if (used.has(slug)) {
    let n = 2;
    while (used.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }

  const maxPos = (existing ?? []).reduce(
    (max, row) => Math.max(max, Number(row.position) || 0),
    -1,
  );
  const terminal = (existing ?? []).filter((row) => row.system_key != null);
  const insertAt =
    terminal.length > 0
      ? Math.min(...terminal.map((row) => Number(row.position) || 0))
      : maxPos + 1;

  if (terminal.length > 0) {
    for (const row of existing ?? []) {
      if (Number(row.position) >= insertAt) {
        await ctx.supabase
          .from("lead_stages")
          .update({ position: Number(row.position) + 1 })
          .eq("organization_id", ctx.org.id)
          .eq("slug", row.slug);
      }
    }
  }

  const { error } = await ctx.supabase.from("lead_stages").insert({
    organization_id: ctx.org.id,
    name,
    slug,
    position: insertAt,
    system_key: null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const, slug };
}

export async function renameLeadStageAction(
  orgSlug: string,
  stageId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Stage name is required" };

  const { error } = await ctx.supabase
    .from("lead_stages")
    .update({ name })
    .eq("id", stageId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export async function reorderLeadStagesAction(orgSlug: string, orderedIds: string[]) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  if (orderedIds.length === 0) return { error: "Nothing to reorder" };

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await ctx.supabase
      .from("lead_stages")
      .update({ position: index })
      .eq("id", id)
      .eq("organization_id", ctx.org.id);
    if (error) return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export async function deleteLeadStageAction(orgSlug: string, stageId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };

  const { data: stage } = await ctx.supabase
    .from("lead_stages")
    .select("id, slug, system_key")
    .eq("id", stageId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!stage) return { error: "Stage not found" };
  if (stage.system_key) return { error: "Won and Lost stages can’t be removed" };

  const { data: stages } = await ctx.supabase
    .from("lead_stages")
    .select("id, slug, position")
    .eq("organization_id", ctx.org.id)
    .order("position", { ascending: true });
  const fallback = (stages ?? []).find((row) => row.id !== stageId);
  if (!fallback) return { error: "Keep at least one stage" };

  await ctx.supabase
    .from("leads")
    .update({ stage: fallback.slug })
    .eq("organization_id", ctx.org.id)
    .eq("stage", stage.slug);

  const { error } = await ctx.supabase
    .from("lead_stages")
    .delete()
    .eq("id", stageId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function convertLeadToClientAction(
  orgSlug: string,
  leadId: string,
  formData?: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };

  const { data: lead, error: leadError } = await ctx.supabase
    .from("leads")
    .select(
      "id, name, company, contact_name, email, phone, whatsapp, currency, estimated_value_minor, notes, client_id",
    )
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (leadError || !lead) return { error: leadError?.message ?? "Lead not found" };
  if (lead.client_id) {
    return { error: "Lead already converted", clientId: lead.client_id as string };
  }

  const createProject =
    formData == null
      ? true
      : String(formData.get("create_project") ?? "") === "on" ||
        String(formData.get("create_project") ?? "") === "1";

  const clientName =
    (lead.company as string | null)?.trim() ||
    (lead.name as string).trim() ||
    "New client";
  const currency = asCurrency(String(lead.currency), ctx.org.defaultCurrency);

  const { data: client, error: clientError } = await ctx.supabase
    .from("clients")
    .insert({
      organization_id: ctx.org.id,
      kind: lead.company ? "company" : "person",
      name: clientName,
      notes: lead.notes,
      currency,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    return { error: clientError?.message ?? "Could not create client" };
  }

  if (lead.contact_name || lead.email || lead.phone || lead.whatsapp) {
    await ctx.supabase.from("contacts").insert({
      organization_id: ctx.org.id,
      client_id: client.id,
      name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      is_primary: true,
    });
  }

  let projectId: string | null = null;
  if (createProject) {
    const projectName =
      String(formData?.get("project_name") ?? "").trim() ||
      `${lead.name as string} engagement`;
    const { data: project, error: projectError } = await ctx.supabase
      .from("projects")
      .insert({
        organization_id: ctx.org.id,
        client_id: client.id,
        name: projectName,
        status: "planning",
        billing_mode: "milestones",
        default_fee_bps: 500,
        earn_on: "charge",
        contracted_amount_minor: lead.estimated_value_minor,
        scope: "Created from won lead",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (projectError) return { error: projectError.message };
    projectId = project?.id ?? null;
    if (projectId) {
      await ctx.supabase.from("project_members").upsert(
        {
          organization_id: ctx.org.id,
          project_id: projectId,
          user_id: ctx.userId,
          role: "lead",
        },
        { onConflict: "project_id,user_id" },
      );
    }
  }

  const { data: wonStage } = await ctx.supabase
    .from("lead_stages")
    .select("slug")
    .eq("organization_id", ctx.org.id)
    .eq("system_key", "won")
    .maybeSingle();
  const wonSlug = wonStage?.slug ? String(wonStage.slug) : "won";

  const { error: updateError } = await ctx.supabase
    .from("leads")
    .update({ stage: wonSlug, client_id: client.id })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);

  if (updateError) return { error: updateError.message };

  await recordActivity(ctx, "converted", leadId, {
    client_id: client.id,
    project_id: projectId,
  });
  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}/clients`);
  revalidatePath(`/${orgSlug}/projects`);
  revalidatePath(`/${orgSlug}`);
  return { clientId: client.id as string, projectId };
}

export async function deleteLeadAction(orgSlug: string, leadId: string, confirmName: string) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!canDeleteModule(ctx, "crm")) {
    return { error: "You don’t have permission to delete leads" };
  }
  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("id, name")
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!lead) return { error: "Lead not found" };
  if (confirmName.trim() !== String(lead.name).trim()) {
    return { error: "Lead name doesn’t match" };
  }

  const { error, count } = await ctx.supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  if (!count) return { error: "You don’t have permission to delete this lead" };

  await ctx.supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", "lead")
    .eq("entity_id", leadId);

  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}
