import type { FollowCandidate } from "@/modules/ops/queue";
import { requireOrg } from "@/modules/identity/org";
import {
  isLeadStage,
  type LeadRecord,
  type LeadStage,
} from "@/modules/crm/types";
import type { IsoCurrency } from "@/shared/money";

type LeadRow = {
  id: string;
  organization_id: string;
  name: string;
  company: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  source: string | null;
  estimated_value_minor: string | number | null;
  currency: string;
  close_on: string | null;
  owner_user_id: string | null;
  tags: string[] | null;
  notes: string | null;
  notes_doc: Record<string, unknown> | null;
  stage: string;
  position?: number | null;
  client_id: string | null;
  deal_share_bps: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

function mapLead(row: LeadRow): LeadRecord {
  const stage: LeadStage = isLeadStage(row.stage) ? row.stage : "new";
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    company: row.company,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    source: row.source,
    estimatedValueMinor:
      row.estimated_value_minor == null ? null : BigInt(row.estimated_value_minor),
    currency: asCurrency(row.currency),
    closeOn: row.close_on,
    ownerUserId: row.owner_user_id,
    tags: row.tags ?? [],
    notes: row.notes,
    notesDoc: row.notes_doc,
    stage,
    position: row.position ?? 0,
    clientId: row.client_id,
    dealShareBps: row.deal_share_bps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LEAD_SELECT =
  "id, organization_id, name, company, contact_name, email, phone, whatsapp, source, estimated_value_minor, currency, close_on, owner_user_id, tags, notes, notes_doc, stage, position, client_id, deal_share_bps, created_at, updated_at";

export async function listLeads(
  orgSlug: string,
  opts?: { stage?: LeadStage; q?: string },
): Promise<LeadRecord[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return [];

  let builder = ctx.supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("organization_id", ctx.org.id)
    .order("updated_at", { ascending: false });

  if (opts?.stage) {
    builder = builder.eq("stage", opts.stage);
  }
  if (opts?.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    builder = builder.or(
      `name.ilike.${q},company.ilike.${q},contact_name.ilike.${q},email.ilike.${q}`,
    );
  }

  const { data, error } = await builder;
  if (error) {
    // Pre-migration: position column may be missing — retry without it.
    if (error.message.includes("position") || error.code === "42703") {
      const fallback = await ctx.supabase
        .from("leads")
        .select(
          "id, organization_id, name, company, contact_name, email, phone, whatsapp, source, estimated_value_minor, currency, close_on, owner_user_id, tags, notes, notes_doc, stage, client_id, deal_share_bps, created_at, updated_at",
        )
        .eq("organization_id", ctx.org.id)
        .order("updated_at", { ascending: false });
      if (fallback.error) {
        if (fallback.error.message.includes("leads") || fallback.error.code === "42P01") {
          return [];
        }
        throw new Error(fallback.error.message);
      }
      return (fallback.data ?? []).map((row) => mapLead(row as LeadRow));
    }
    if (error.message.includes("leads") || error.code === "42P01") return [];
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => mapLead(row as LeadRow))
    .sort((a, b) => {
      if (a.stage === b.stage && a.position !== b.position) {
        return a.position - b.position;
      }
      return 0;
    });
}

export async function getLead(
  orgSlug: string,
  leadId: string,
): Promise<LeadRecord | null> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return null;

  const { data, error } = await ctx.supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("organization_id", ctx.org.id)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("leads") || error.code === "42P01") return null;
    throw new Error(error.message);
  }
  return data ? mapLead(data as LeadRow) : null;
}

/** Leads that deserve a Today nudge (qualified / proposal / negotiation). */
export async function listFollowUpLeads(orgSlug: string): Promise<FollowCandidate[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return [];

  const { data, error } = await ctx.supabase
    .from("leads")
    .select("id, name, company, stage, close_on, updated_at")
    .eq("organization_id", ctx.org.id)
    .in("stage", ["qualified", "proposal", "negotiation"])
    .order("close_on", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    if (error.message.includes("leads") || error.code === "42P01") return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.company
      ? `${row.name as string} · ${row.company as string}`
      : (row.name as string),
    stage: String(row.stage).replaceAll("_", " "),
    href: `/${orgSlug}/crm?lead=${row.id}`,
  }));
}
