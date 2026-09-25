import { cache } from "react";
import type {
  ActivityRecord,
  ClientActivityItem,
  ClientRecord,
  ContactRecord,
} from "@/modules/clients/types";
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

export const listClients = cache(async (orgSlug: string, query = "") => {
  const { org, supabase } = await requireOrg(orgSlug);
  let builder = supabase
    .from("clients")
    .select(
      "id, organization_id, kind, name, notes, notes_doc, currency, archived_at, created_at",
    )
    .eq("organization_id", org.id)
    .is("archived_at", null)
    .order("name");

  if (query.trim()) {
    builder = builder.ilike("name", `%${query.trim()}%`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClient);
});

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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  upwork: "Upwork",
  bank: "bank transfer",
  stripe: "Stripe",
  other: "other",
};

const CHARGE_SOURCE_LABEL: Record<string, string> = {
  manual: "Charge",
  work_log: "Hours billed",
  milestone: "Milestone billed",
  invoice: "Invoice charged",
  document: "Document charged",
};

function idsFrom(rows: ActivityRecord[], key: string) {
  return [
    ...new Set(
      rows.map((row) => row.metadata[key]).filter((value): value is string => typeof value === "string"),
    ),
  ];
}

function shortDay(iso: string | null | undefined) {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

/** Resolves charge / payment / project / milestone / actor names for the client timeline. */
export async function describeClientActivity(
  orgSlug: string,
  rows: ActivityRecord[],
  { includeMoney }: { includeMoney: boolean },
): Promise<ClientActivityItem[]> {
  const { org, supabase } = await requireOrg(orgSlug);
  const visible = rows.filter(
    (row) => includeMoney || (row.verb !== "charged" && row.verb !== "paid"),
  );

  const paymentIds = idsFrom(visible, "payment_id");
  const chargeIds = idsFrom(visible, "charge_id");
  const actorIds = [
    ...new Set(visible.map((row) => row.actorId).filter((id): id is string => Boolean(id))),
  ];

  const [chargesRes, paymentsRes, actorsRes] = await Promise.all([
    chargeIds.length
      ? supabase
          .from("charges")
          .select("id, gross_minor, currency, memo, source, project_id, milestone_id, due_on")
          .eq("organization_id", org.id)
          .in("id", chargeIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    paymentIds.length
      ? supabase
          .from("payments")
          .select("id, amount_minor, currency, method, reference, paid_on")
          .eq("organization_id", org.id)
          .in("id", paymentIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    actorIds.length
      ? supabase.from("profiles").select("id, display_name, email").in("id", actorIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const charges = new Map((chargesRes.data ?? []).map((row) => [String(row.id), row]));
  const payments = new Map((paymentsRes.data ?? []).map((row) => [String(row.id), row]));
  const actors = new Map(
    (actorsRes.data ?? []).map((row) => [
      String(row.id),
      (String(row.display_name ?? "").trim() || String(row.email ?? "").split("@")[0]) ?? null,
    ]),
  );

  const projectIds = new Set<string>(idsFrom(visible, "project_id"));
  const milestoneIds = new Set<string>(idsFrom(visible, "milestone_id"));
  for (const charge of charges.values()) {
    if (charge.project_id) projectIds.add(String(charge.project_id));
    if (charge.milestone_id) milestoneIds.add(String(charge.milestone_id));
  }
  const [projectsRes, milestonesRes] = await Promise.all([
    projectIds.size
      ? supabase.from("projects").select("id, name").in("id", [...projectIds])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    milestoneIds.size
      ? supabase.from("milestones").select("id, name").in("id", [...milestoneIds])
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const projectNames = new Map(
    (projectsRes.data ?? []).map((row) => [String(row.id), String(row.name)]),
  );
  const milestoneNames = new Map(
    (milestonesRes.data ?? []).map((row) => [String(row.id), String(row.name)]),
  );

  return visible.map((row): ClientActivityItem => {
    const actorName = row.actorId ? (actors.get(row.actorId) ?? null) : null;
    const charge =
      typeof row.metadata.charge_id === "string" ? charges.get(row.metadata.charge_id) : undefined;
    const projectId =
      (charge?.project_id as string | null | undefined) ??
      (typeof row.metadata.project_id === "string" ? row.metadata.project_id : null);
    const milestoneId =
      (charge?.milestone_id as string | null | undefined) ??
      (typeof row.metadata.milestone_id === "string" ? row.metadata.milestone_id : null);
    const subject =
      (milestoneId ? milestoneNames.get(milestoneId) : null) ??
      ((charge?.memo as string | null | undefined)?.trim() || null);
    const base = {
      id: row.id,
      subject,
      projectId: projectId ?? null,
      projectName: projectId ? (projectNames.get(projectId) ?? null) : null,
      actorName,
      createdAt: row.createdAt,
    };

    if (row.verb === "charged") {
      const due = shortDay(charge?.due_on as string | null | undefined);
      return {
        ...base,
        kind: "charge",
        title: CHARGE_SOURCE_LABEL[String(charge?.source ?? "manual")] ?? "Charge",
        detail: due ? `Due ${due}` : null,
        amountMinor: charge?.gross_minor != null ? BigInt(String(charge.gross_minor)) : null,
        currency: (charge?.currency as string | undefined) ?? null,
      };
    }
    if (row.verb === "paid") {
      const payment =
        typeof row.metadata.payment_id === "string"
          ? payments.get(row.metadata.payment_id)
          : undefined;
      const method = payment?.method ? PAYMENT_METHOD_LABEL[String(payment.method)] : null;
      const reference = (payment?.reference as string | null | undefined)?.trim();
      const amount =
        payment?.amount_minor ?? (row.metadata.amount_minor as string | number | undefined);
      return {
        ...base,
        kind: "payment",
        title: "Payment received",
        detail: [method ? `via ${method}` : null, reference ? `ref ${reference}` : null]
          .filter(Boolean)
          .join(" · ") || null,
        amountMinor: amount != null ? BigInt(String(amount)) : null,
        currency: (payment?.currency as string | undefined) ?? (charge?.currency as string | undefined) ?? null,
      };
    }
    if (row.verb === "created") {
      return {
        ...base,
        kind: "created",
        title: "Client added",
        subject: null,
        detail: null,
        amountMinor: null,
        currency: null,
      };
    }
    return {
      ...base,
      kind: "other",
      title: row.verb.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase()),
      detail: null,
      amountMinor: null,
      currency: null,
    };
  });
}

export async function listClientActivity(orgSlug: string, clientId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("activities")
    .select("id, verb, entity_type, entity_id, metadata, created_at, actor_id")
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
      actorId: (row.actor_id as string | null) ?? null,
    }),
  );
}
