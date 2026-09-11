import type { ActivityRecord, ClientRecord, ContactRecord } from "@/modules/clients/types";
import { requireOrg } from "@/modules/identity/org";

function mapClient(row: {
  id: string;
  organization_id: string;
  kind: string;
  name: string;
  notes: string | null;
  notes_doc?: Record<string, unknown> | null;
  currency: string;
  archived_at: string | null;
  created_at: string;
}): ClientRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    kind: row.kind === "person" ? "person" : "company",
    name: row.name,
    notes: row.notes,
    notesDoc: row.notes_doc ?? null,
    currency: row.currency === "INR" ? "INR" : "USD",
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

function mapContact(row: {
  id: string;
  client_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
}): ContactRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    isPrimary: row.is_primary,
  };
}

export async function listClients(orgSlug: string, query?: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  let builder = supabase
    .from("clients")
    .select(
      "id, organization_id, kind, name, notes, notes_doc, currency, archived_at, created_at",
    )
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .order("name");

  if (query?.trim()) {
    builder = builder.ilike("name", `%${query.trim()}%`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClient);
}

export async function getClient(orgSlug: string, clientId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, organization_id, kind, name, notes, notes_doc, currency, archived_at, created_at",
    )
    .eq("organization_id", org.id)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapClient(data) : null;
}

export async function listContacts(orgSlug: string, clientId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("contacts")
    .select("id, client_id, name, email, phone, whatsapp, is_primary")
    .eq("organization_id", org.id)
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContact);
}

/** Primary (or first) contact per client for document preview expansion. */
export async function listPrimaryContactsForOrg(orgSlug: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("contacts")
    .select("id, client_id, name, email, phone, whatsapp, is_primary")
    .eq("organization_id", org.id)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);

  const byClient = new Map<string, ContactRecord>();
  for (const row of data ?? []) {
    const contact = mapContact(row);
    const existing = byClient.get(contact.clientId);
    if (!existing || (contact.isPrimary && !existing.isPrimary)) {
      byClient.set(contact.clientId, contact);
    }
  }
  return byClient;
}

export async function listOrgActivity(orgSlug: string, limit = 10) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("activities")
    .select("id, verb, entity_type, entity_id, metadata, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): ActivityRecord => ({
      id: row.id,
      verb: row.verb,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
    }),
  );
}

export async function listClientActivity(orgSlug: string, clientId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("activities")
    .select("id, verb, entity_type, entity_id, metadata, created_at")
    .eq("organization_id", org.id)
    .eq("entity_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): ActivityRecord => ({
      id: row.id,
      verb: row.verb,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
    }),
  );
}
