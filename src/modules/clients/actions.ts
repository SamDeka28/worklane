"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";

async function recordActivity(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  verb: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

export async function createClientAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "company") === "person" ? "person" : "company";
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
  const currency = String(formData.get("currency") ?? ctx.org.defaultCurrency);
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;

  if (!name) {
    return { error: "Client name is required" };
  }
  if (currency !== "USD" && currency !== "INR") {
    return { error: "Currency must be USD or INR" };
  }

  const { data: client, error } = await ctx.supabase
    .from("clients")
    .insert({
      organization_id: ctx.org.id,
      kind,
      name,
      notes,
      notes_doc: notesDoc,
      currency,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !client) {
    return { error: error?.message ?? "Could not create client" };
  }

  if (contactName || email || phone || whatsapp) {
    const { error: contactError } = await ctx.supabase.from("contacts").insert({
      organization_id: ctx.org.id,
      client_id: client.id,
      name: contactName,
      email,
      phone,
      whatsapp,
      is_primary: true,
    });
    if (contactError) {
      return { error: contactError.message };
    }
  }

  await recordActivity(ctx, "created", "client", client.id, { name });
  revalidatePath(`/${orgSlug}`);
  return { id: client.id as string };
}

export async function updateClientAction(orgSlug: string, clientId: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const name = String(formData.get("name") ?? "").trim();
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
  const kind = String(formData.get("kind") ?? "company") === "person" ? "person" : "company";

  if (!name) {
    return { error: "Client name is required" };
  }

  const { error } = await ctx.supabase
    .from("clients")
    .update({ name, notes, notes_doc: notesDoc, kind })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id);

  if (error) {
    return { error: error.message };
  }

  await recordActivity(ctx, "updated", "client", clientId, { name });
  revalidatePath(`/${orgSlug}/clients/${clientId}`);
  return { ok: true as const };
}

export async function addContactAction(orgSlug: string, clientId: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const name = String(formData.get("contact_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;
  const isPrimary = String(formData.get("is_primary") ?? "") === "on";

  if (!name && !email && !phone && !whatsapp) {
    return { error: "Add at least one contact field" };
  }

  if (isPrimary) {
    await ctx.supabase
      .from("contacts")
      .update({ is_primary: false })
      .eq("organization_id", ctx.org.id)
      .eq("client_id", clientId);
  }

  const { error } = await ctx.supabase.from("contacts").insert({
    organization_id: ctx.org.id,
    client_id: clientId,
    name,
    email,
    phone,
    whatsapp,
    is_primary: isPrimary,
  });

  if (error) {
    return { error: error.message };
  }

  await recordActivity(ctx, "contact_added", "client", clientId, { name, email });
  revalidatePath(`/${orgSlug}/clients/${clientId}`);
  return { ok: true as const };
}

export async function archiveClientAction(orgSlug: string, clientId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id);

  if (error) {
    return { error: error.message };
  }

  await recordActivity(ctx, "archived", "client", clientId);
  revalidatePath(`/${orgSlug}/clients`);
  return { ok: true as const };
}
