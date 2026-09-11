"use server";

import { revalidatePath } from "next/cache";
import { isLeadStage } from "@/modules/crm/types";
import { requireWritableOrg } from "@/modules/identity/org";
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

  const stageRaw = String(formData.get("stage") ?? "new");
  const stage = isLeadStage(stageRaw) ? stageRaw : "new";
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

  const stageRaw = String(formData.get("stage") ?? "new");
  const stage = isLeadStage(stageRaw) ? stageRaw : "new";
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
  if (!isLeadStage(stage)) return { error: "Unknown stage" };

  const { error } = await ctx.supabase
    .from("leads")
    .update({ stage })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  if (orderedIds && orderedIds.length > 0) {
    for (const [index, id] of orderedIds.entries()) {
      const { error: posError } = await ctx.supabase
        .from("leads")
        .update({ position: index, stage })
        .eq("id", id)
        .eq("organization_id", ctx.org.id);
      if (posError) return { error: posError.message };
    }
  }

  await recordActivity(ctx, "stage_moved", leadId, { stage });
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

  const { error: updateError } = await ctx.supabase
    .from("leads")
    .update({ stage: "won", client_id: client.id })
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
