import { cache } from "react";
import type { FollowCandidate } from "@/modules/ops/queue";
import { listOrgMembers, requireOrg, type OrgContext } from "@/modules/identity/org";
import { canAccessModule, resolveMemberPermissions } from "@/modules/identity/permissions";
import { parseCrmSettings, type CrmSettings } from "@/modules/crm/settings";
import {
  isStale,
  todayIso,
  type CrmMember,
  type LeadOrigin,
  type LeadRecord,
  type LeadStage,
  type LeadStageRecord,
  type LeadStageSystemKey,
} from "@/modules/crm/types";
import { isEmailConfigured } from "@/shared/email";
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
  next_action?: string | null;
  next_action_on?: string | null;
  last_touched_at?: string | null;
  closed_at?: string | null;
  lost_reason?: string | null;
  lost_note?: string | null;
  origin?: string | null;
  created_at: string;
  updated_at: string;
};

type LeadStageRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  position: number;
  system_key: string | null;
  probability_bps?: number | null;
};

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

function asOrigin(value: string | null | undefined): LeadOrigin {
  return value === "intake" || value === "import" ? value : "manual";
}

export function mapLead(row: LeadRow): LeadRecord {
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
    stage: row.stage || "new",
    position: row.position ?? 0,
    clientId: row.client_id,
    dealShareBps: row.deal_share_bps,
    nextAction: row.next_action ?? null,
    nextActionOn: row.next_action_on ?? null,
    lastTouchedAt: row.last_touched_at ?? row.updated_at,
    closedAt: row.closed_at ?? null,
    lostReason: row.lost_reason ?? null,
    lostNote: row.lost_note ?? null,
    origin: asOrigin(row.origin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStage(row: LeadStageRow): LeadStageRecord {
  const systemKey =
    row.system_key === "won" || row.system_key === "lost"
      ? (row.system_key as LeadStageSystemKey)
      : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    position: row.position,
    systemKey,
    probabilityBps: row.probability_bps ?? null,
  };
}

export const LEAD_SELECT =
  "id, organization_id, name, company, contact_name, email, phone, whatsapp, source, estimated_value_minor, currency, close_on, owner_user_id, tags, notes, notes_doc, stage, position, client_id, deal_share_bps, next_action, next_action_on, last_touched_at, closed_at, lost_reason, lost_note, origin, created_at, updated_at";

export const listLeadStages = cache(async (orgSlug: string): Promise<LeadStageRecord[]> => {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return [];

  const { data, error } = await ctx.supabase
    .from("lead_stages")
    .select("id, organization_id, name, slug, position, system_key, probability_bps")
    .eq("organization_id", ctx.org.id)
    .order("position", { ascending: true });

  if (error) {
    if (error.message.includes("lead_stages") || error.code === "42P01") return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapStage(row as LeadStageRow));
});

export const getCrmSettings = cache(async (orgSlug: string): Promise<CrmSettings> => {
  const ctx = await requireOrg(orgSlug);
  const { data } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .maybeSingle();
  return parseCrmSettings(data?.settings);
});

/** Active teammates who can see the CRM, for owner pickers and avatars. */
export const listCrmMembers = cache(async (orgSlug: string): Promise<CrmMember[]> => {
  const ctx = await requireOrg(orgSlug);
  const members = await listOrgMembers(orgSlug);
  return members
    .filter((member) => member.status === "active")
    .filter((member) =>
      canAccessModule(
        resolveMemberPermissions({
          role: member.role,
          stored: member.permissions,
          orgModules: ctx.org.modules,
        }),
        "crm",
      ),
    )
    .map((member) => ({
      userId: member.userId,
      name: member.displayName?.trim() || member.email?.split("@")[0] || "Teammate",
      avatarUrl: member.avatarUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const listLeadsCached = cache(
  async (orgSlug: string, stage: string, q: string): Promise<LeadRecord[]> => {
    const ctx = await requireOrg(orgSlug);
    if (!ctx.org.modules.crm) return [];

    let builder = ctx.supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("organization_id", ctx.org.id)
      .order("updated_at", { ascending: false });

    if (stage) {
      builder = builder.eq("stage", stage);
    }
    if (q.trim()) {
      const pattern = `%${q.trim().replace(/[,()]/g, " ")}%`;
      builder = builder.or(
        `name.ilike.${pattern},company.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`,
      );
    }

    const { data, error } = await builder;
    if (error) {
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
  },
);

export async function listLeads(
  orgSlug: string,
  opts?: { stage?: LeadStage; q?: string },
): Promise<LeadRecord[]> {
  return listLeadsCached(orgSlug, opts?.stage ?? "", opts?.q ?? "");
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

/** Deals attached to a client (upsells and the lead it was converted from). */
export async function listClientLeads(orgSlug: string, clientId: string): Promise<LeadRecord[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm || !canAccessModule(ctx.permissions, "crm")) return [];
  const { data } = await ctx.supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("organization_id", ctx.org.id)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => mapLead(row as LeadRow));
}

function followReason(lead: LeadRecord, today: string, staleDays: number) {
  if (lead.nextActionOn && lead.nextActionOn < today) {
    return { rank: 0, why: lead.nextAction ? `Overdue: ${lead.nextAction}` : "Follow-up overdue" };
  }
  if (lead.nextActionOn === today) {
    return { rank: 1, why: lead.nextAction ? `Today: ${lead.nextAction}` : "Follow up today" };
  }
  if (!lead.nextActionOn && isStale(lead, staleDays)) {
    return { rank: 2, why: "No touch in a while" };
  }
  if (!lead.nextActionOn) return { rank: 3, why: "No next step set" };
  return null;
}

/** Open leads that need a touch today: overdue or due follow-ups, then stale or unplanned ones. */
export async function listFollowUpLeads(orgSlug: string): Promise<FollowCandidate[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return [];

  const [stages, settings, leads] = await Promise.all([
    listLeadStages(orgSlug),
    getCrmSettings(orgSlug),
    listLeads(orgSlug),
  ]);
  const closed = new Set(stages.filter((stage) => stage.systemKey).map((stage) => stage.slug));
  const today = todayIso();
  const mine = leads.filter(
    (lead) =>
      !closed.has(lead.stage) &&
      (lead.ownerUserId == null || lead.ownerUserId === ctx.userId),
  );

  return mine
    .map((lead) => ({ lead, reason: followReason(lead, today, settings.staleDays) }))
    .filter((row): row is { lead: LeadRecord; reason: { rank: number; why: string } } =>
      Boolean(row.reason),
    )
    .sort(
      (a, b) =>
        a.reason.rank - b.reason.rank ||
        (a.lead.nextActionOn ?? "").localeCompare(b.lead.nextActionOn ?? "") ||
        a.lead.lastTouchedAt.localeCompare(b.lead.lastTouchedAt),
    )
    .slice(0, 12)
    .map(({ lead, reason }) => ({
      id: lead.id,
      title: lead.company && lead.company !== lead.name ? `${lead.name} · ${lead.company}` : lead.name,
      stage: stages.find((stage) => stage.slug === lead.stage)?.name ?? lead.stage,
      why: reason.why,
      overdue: reason.rank === 0,
      href: `/${orgSlug}/crm?lead=${lead.id}`,
    }));
}

export type LeadStageMove = { leadId: string; to: string; at: string };

/** Stage entries over the last year, for funnel and velocity reports. */
export async function listLeadStageMoves(orgSlug: string): Promise<LeadStageMove[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return [];
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const { data } = await ctx.supabase
    .from("record_events")
    .select("entity_id, changes, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", "lead")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);
  return (data ?? [])
    .map((row) => {
      const stage = (row.changes as { stage?: { to?: unknown } } | null)?.stage;
      const to = stage?.to == null ? null : String(stage.to);
      return to ? { leadId: String(row.entity_id), to, at: String(row.created_at) } : null;
    })
    .filter((row): row is LeadStageMove => row != null);
}

export type LeadEmailSender = {
  configured: boolean;
  name: string;
  email: string | null;
  orgName: string;
};

export function leadEmailSender(ctx: OrgContext): LeadEmailSender {
  return {
    configured: isEmailConfigured(),
    name: ctx.user.displayName?.trim() || ctx.user.email?.split("@")[0] || "",
    email: ctx.user.email ?? null,
    orgName: ctx.org.name,
  };
}

export type LeadEmailHistory = {
  proposalSent: boolean;
  /** Emails already sent to this lead from Worklane, newest first. */
  previous: { id: string; subject: string; sentAt: string; opened: boolean }[];
};

export async function getLeadEmailHistory(
  orgSlug: string,
  leadId: string,
): Promise<LeadEmailHistory> {
  const ctx = await requireOrg(orgSlug);
  const [emails, proposals] = await Promise.all([
    ctx.supabase
      .from("lead_emails")
      .select("id, subject, sent_at, open_count")
      .eq("organization_id", ctx.org.id)
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: false })
      .limit(10),
    ctx.org.modules.documents
      ? ctx.supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ctx.org.id)
          .eq("lead_id", leadId)
          .eq("kind", "proposal")
          .eq("status", "sent")
      : Promise.resolve({ count: 0 }),
  ]);
  return {
    proposalSent: (proposals.count ?? 0) > 0,
    previous: (emails.data ?? []).map((row) => ({
      id: String(row.id),
      subject: String(row.subject),
      sentAt: String(row.sent_at),
      opened: Number(row.open_count ?? 0) > 0,
    })),
  };
}
