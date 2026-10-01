"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import { canDeleteModule } from "@/modules/identity/permissions";
import { billToFromForm } from "@/modules/invoices/types";
import { asIsoCurrency } from "@/shared/money";
import { notifyOwners } from "@/modules/notifications/service";

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
  const currency = String(formData.get("currency") ?? ctx.org.defaultCurrency)
    .trim()
    .toUpperCase();
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const whatsapp = String(formData.get("whatsapp") ?? "").trim() || null;

  if (!name) {
    return { error: "Client name is required" };
  }
  if (asIsoCurrency(currency) !== currency) {
    return { error: "Pick a supported currency" };
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
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "clients",
    title: (actor) => `${actor} added client ${name}`,
    body: [contactName, email].filter(Boolean).join(" · ") || "New client in the studio.",
    href: `/${orgSlug}/clients/${client.id}`,
    entity: { type: "client", id: client.id as string },
    actionLabel: "View client",
  });
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

  const { data: existing, error: existingError } = await ctx.supabase
    .from("clients")
    .select("currency")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (existingError) return { error: existingError.message };
  if (!existing) return { error: "Client not found" };

  const currentCurrency = asIsoCurrency(existing.currency);
  const requested = String(formData.get("currency") ?? "").trim().toUpperCase();
  const currency = requested || currentCurrency;
  if (asIsoCurrency(currency) !== currency) {
    return { error: "Pick a supported currency" };
  }
  if (currency !== currentCurrency) {
    const locked = await clientHasMoney(ctx, clientId);
    if (locked === "error") {
      return { error: "Couldn't check this client's charges. Try again." };
    }
    if (locked) {
      return {
        error: "Currency is locked once this client has a charge, invoice, or payment.",
      };
    }
  }

  const { error } = await ctx.supabase
    .from("clients")
    .update({ name, notes, notes_doc: notesDoc, kind, currency })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id);

  if (error) {
    return { error: error.message };
  }

  await recordActivity(ctx, "updated", "client", clientId, { name });
  revalidatePath(`/${orgSlug}/clients/${clientId}`);
  revalidatePath(`/${orgSlug}/projects`);
  return { ok: true as const };
}

async function clientHasMoney(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  clientId: string,
) {
  const tables = ["charges", "invoices", "payments"] as const;
  const counts = await Promise.all(
    tables.map((table) =>
      ctx.supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.org.id)
        .eq("client_id", clientId),
    ),
  );
  if (counts.some((result) => result.error)) return "error" as const;
  return counts.some((result) => (result.count ?? 0) > 0);
}

export async function updateClientBillingAction(
  orgSlug: string,
  clientId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const billing = billToFromForm(formData);
  const empty =
    !billing.name &&
    !billing.contactName &&
    !billing.email &&
    !billing.phone &&
    !billing.address &&
    !billing.taxId &&
    billing.extras.length === 0;

  const { data: client, error } = await ctx.supabase
    .from("clients")
    .update({ billing: empty ? null : billing })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .select("name")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!client) return { error: "Client not found" };

  let draftsUpdated = 0;
  if (!empty) {
    const { data: drafts } = await ctx.supabase
      .from("invoices")
      .update({ bill_to: billing })
      .eq("organization_id", ctx.org.id)
      .eq("client_id", clientId)
      .eq("status", "draft")
      .is("issued_at", null)
      .select("id");
    draftsUpdated = drafts?.length ?? 0;
  }

  await recordActivity(ctx, "updated", "client", clientId, {
    name: client.name,
    field: "billing",
  });
  revalidatePath(`/${orgSlug}/clients/${clientId}`);
  if (draftsUpdated > 0) {
    revalidatePath(`/${orgSlug}/invoices`);
    revalidatePath("/[orgSlug]/invoices/[invoiceId]", "page");
  }
  return { ok: true as const, draftsUpdated };
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

export async function deleteClientAction(
  orgSlug: string,
  clientId: string,
  confirmName: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!canDeleteModule(ctx, "crm")) {
    return { error: "You don’t have permission to delete clients" };
  }
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  if (confirmName.trim() !== String(client.name).trim()) {
    return { error: "Client name doesn’t match" };
  }

  const linked = await Promise.all(
    (
      [
        ["projects", "project"],
        ["invoices", "invoice"],
        ["charges", "charge"],
        ["payments", "payment"],
      ] as const
    ).map(async ([table, noun]) => {
      const { count } = await ctx.supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.org.id)
        .eq("client_id", clientId);
      return count ? `${count} ${noun}${count === 1 ? "" : "s"}` : null;
    }),
  );
  const blockers = linked.filter(Boolean);
  if (blockers.length > 0) {
    return {
      error: `${client.name} still has ${blockers.join(", ")}. Delete those first, or archive the client instead.`,
    };
  }

  const { error, count } = await ctx.supabase
    .from("clients")
    .delete({ count: "exact" })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id);
  if (error) {
    if (error.code === "23503") {
      return { error: "This client has billing history, so it can’t be deleted. Archive it instead." };
    }
    return { error: error.message };
  }
  if (!count) return { error: "You don’t have permission to delete this client" };

  await ctx.supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", "client")
    .eq("entity_id", clientId);

  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "clients",
    title: (actor) => `${actor} deleted client ${client.name as string}`,
    body: "The client and its contacts were permanently removed.",
    href: `/${orgSlug}/clients`,
    actionLabel: "View clients",
  });

  revalidatePath(`/${orgSlug}/clients`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}
