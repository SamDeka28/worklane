"use server";

import { revalidatePath } from "next/cache";
import { requireOrg, requireWritableOrg } from "@/modules/identity/org";
import { canDeleteModule } from "@/modules/identity/permissions";
import { notify, userLabel } from "@/modules/notifications/service";
import {
  LEAD_ACTIVITY_KINDS,
  type LeadActivityKind,
  type LeadActivityRecord,
  type LeadEmailInfo,
  type LeadTimelineItem,
} from "@/modules/crm/types";

function isDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function leadInOrg(
  ctx: Awaited<ReturnType<typeof requireOrg>>,
  leadId: string,
  columns = "id, name",
) {
  const { data } = await ctx.supabase
    .from("leads")
    .select(columns)
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

/** Logged touchpoints plus stage moves, newest first. */
export async function listLeadTimelineAction(
  orgSlug: string,
  leadId: string,
): Promise<{ items: LeadTimelineItem[]; error?: string }> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) return { items: [] };

  const [activities, events, emails] = await Promise.all([
    ctx.supabase
      .from("lead_activities")
      .select("id, lead_id, kind, body, happened_at, actor_id")
      .eq("organization_id", ctx.org.id)
      .eq("lead_id", leadId)
      .order("happened_at", { ascending: false })
      .limit(200),
    ctx.supabase
      .from("record_events")
      .select("id, actor_id, actor_label, changes, created_at")
      .eq("organization_id", ctx.org.id)
      .eq("entity_type", "lead")
      .eq("entity_id", leadId)
      .order("created_at", { ascending: false })
      .limit(200),
    ctx.supabase
      .from("lead_emails")
      .select("id, activity_id, to_email, subject, track_opens, open_count, first_opened_at, last_opened_at")
      .eq("organization_id", ctx.org.id)
      .eq("lead_id", leadId)
      .not("activity_id", "is", null)
      .limit(200),
  ]);
  if (activities.error) return { items: [], error: activities.error.message };

  const emailByActivity = new Map<string, LeadEmailInfo>();
  for (const row of emails.data ?? []) {
    emailByActivity.set(String(row.activity_id), {
      id: String(row.id),
      toEmail: String(row.to_email),
      subject: String(row.subject),
      trackOpens: Boolean(row.track_opens),
      openCount: Number(row.open_count ?? 0),
      firstOpenedAt: (row.first_opened_at as string | null) ?? null,
      lastOpenedAt: (row.last_opened_at as string | null) ?? null,
    });
  }

  const actorIds = [
    ...new Set(
      [
        ...(activities.data ?? []).map((row) => row.actor_id as string | null),
        ...(events.data ?? []).map((row) => row.actor_id as string | null),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const people = new Map<string, { label: string; avatarUrl: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", actorIds);
    for (const profile of profiles ?? []) {
      people.set(String(profile.id), {
        label:
          (profile.display_name as string | null)?.trim() ||
          String(profile.email ?? "").split("@")[0] ||
          "Teammate",
        avatarUrl: (profile.avatar_url as string | null) ?? null,
      });
    }
  }

  const items: LeadTimelineItem[] = [];
  for (const row of activities.data ?? []) {
    const actorId = (row.actor_id as string | null) ?? null;
    const person = actorId ? people.get(actorId) : undefined;
    const activity: LeadActivityRecord = {
      id: String(row.id),
      leadId: String(row.lead_id),
      kind: row.kind as LeadActivityKind,
      body: (row.body as string | null) ?? null,
      happenedAt: String(row.happened_at),
      actorId,
      actorLabel: person?.label ?? null,
      actorAvatarUrl: person?.avatarUrl ?? null,
      email: emailByActivity.get(String(row.id)) ?? null,
    };
    items.push({ type: "activity", at: activity.happenedAt, activity });
  }
  for (const row of events.data ?? []) {
    const stage = (row.changes as { stage?: { from?: unknown; to?: unknown } } | null)?.stage;
    if (!stage?.to) continue;
    const actorId = (row.actor_id as string | null) ?? null;
    items.push({
      type: "stage",
      id: String(row.id),
      at: String(row.created_at),
      from: stage.from == null ? null : String(stage.from),
      to: String(stage.to),
      actorLabel:
        (row.actor_label as string | null) ?? (actorId ? (people.get(actorId)?.label ?? null) : null),
      actorAvatarUrl: actorId ? (people.get(actorId)?.avatarUrl ?? null) : null,
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  return { items };
}

export async function logLeadActivityAction(
  orgSlug: string,
  leadId: string,
  input: { kind: string; body: string; happenedOn?: string },
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  const kind = (LEAD_ACTIVITY_KINDS as readonly string[]).includes(input.kind)
    ? input.kind
    : "note";
  const body = input.body.trim().slice(0, 4000);
  if (!body) return { error: "Add a short summary" };
  if (!(await leadInOrg(ctx, leadId))) return { error: "Lead not found" };

  let happenedAt = new Date().toISOString();
  if (input.happenedOn && isDay(input.happenedOn)) {
    const today = new Date().toISOString().slice(0, 10);
    if (input.happenedOn > today) return { error: "That date is in the future" };
    if (input.happenedOn !== today) happenedAt = new Date(`${input.happenedOn}T12:00:00`).toISOString();
  }

  const { error } = await ctx.supabase.from("lead_activities").insert({
    organization_id: ctx.org.id,
    lead_id: leadId,
    kind,
    body,
    happened_at: happenedAt,
    actor_id: ctx.userId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export async function deleteLeadActivityAction(orgSlug: string, activityId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  let query = ctx.supabase
    .from("lead_activities")
    .delete({ count: "exact" })
    .eq("id", activityId)
    .eq("organization_id", ctx.org.id);
  if (!canDeleteModule(ctx, "crm")) query = query.eq("actor_id", ctx.userId);
  const { error, count } = await query;
  if (error) return { error: error.message };
  if (!count) return { error: "You can only remove entries you logged" };
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

/** Set, move, or clear the next step. `done` logs the finished step before replacing it. */
export async function setLeadNextActionAction(
  orgSlug: string,
  leadId: string,
  input: { text: string; on: string | null; done?: boolean },
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  const lead = await leadInOrg(ctx, leadId, "id, name, next_action");
  if (!lead) return { error: "Lead not found" };

  const text = input.text.trim().slice(0, 200) || null;
  const on = input.on && isDay(input.on) ? input.on : null;
  if (on && !text) return { error: "Say what the next step is" };

  if (input.done && lead.next_action) {
    await ctx.supabase.from("lead_activities").insert({
      organization_id: ctx.org.id,
      lead_id: leadId,
      kind: "note",
      body: `Done: ${String(lead.next_action)}`,
      actor_id: ctx.userId,
    });
  }

  const { error } = await ctx.supabase
    .from("leads")
    .update({ next_action: text, next_action_on: text ? on : null })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function assignLeadOwnerAction(
  orgSlug: string,
  leadId: string,
  userId: string | null,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  const lead = await leadInOrg(ctx, leadId, "id, name, owner_user_id");
  if (!lead) return { error: "Lead not found" };

  if (userId) {
    const { data: member } = await ctx.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ctx.org.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!member) return { error: "That teammate isn’t active in this studio" };
  }
  if ((lead.owner_user_id ?? null) === userId) return { ok: true as const };

  const { error } = await ctx.supabase
    .from("leads")
    .update({ owner_user_id: userId })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  if (userId && userId !== ctx.userId) {
    const actor = await userLabel(ctx.userId);
    await notify({
      recipients: [userId],
      organizationId: ctx.org.id,
      orgName: ctx.org.name,
      category: "leads",
      title: `${actor} gave you the lead ${String(lead.name)}`,
      body: "You own this lead now. Set the next step so it doesn’t go cold.",
      href: `/${orgSlug}/crm?lead=${leadId}`,
      actorId: ctx.userId,
      entity: { type: "lead", id: leadId },
      actionLabel: "Open lead",
      ownerCopy: false,
    });
  }
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export type DuplicateMatches = {
  leads: { id: string; name: string; company: string | null; stage: string; why: string }[];
  clients: { id: string; name: string; why: string }[];
};

function norm(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

/** Existing leads and clients that look like the same person or company. */
export async function findLeadDuplicatesAction(
  orgSlug: string,
  input: { name?: string; company?: string; email?: string; phone?: string; excludeLeadId?: string },
): Promise<DuplicateMatches> {
  const ctx = await requireOrg(orgSlug);
  const empty: DuplicateMatches = { leads: [], clients: [] };
  if (!ctx.org.modules.crm) return empty;

  const email = norm(input.email);
  const company = norm(input.company);
  const name = norm(input.name);
  const phone = digits(input.phone);
  if (!email && company.length < 3 && name.length < 3 && phone.length < 7) return empty;

  const escape = (value: string) => value.replace(/[%_,()]/g, " ").trim();
  const leadFilters = [
    email && `email.ilike.${escape(email)}`,
    company.length >= 3 && `company.ilike.${escape(company)}`,
    company.length >= 3 && `name.ilike.${escape(company)}`,
    name.length >= 3 && `name.ilike.${escape(name)}`,
    phone.length >= 7 && `phone.ilike.%${phone.slice(-7)}%`,
  ].filter(Boolean) as string[];

  const clientNames = [company, name].filter((value) => value.length >= 3);

  const [leadRows, clientRows, contactRows] = await Promise.all([
    leadFilters.length
      ? ctx.supabase
          .from("leads")
          .select("id, name, company, email, phone, stage")
          .eq("organization_id", ctx.org.id)
          .or(leadFilters.join(","))
          .limit(8)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    clientNames.length
      ? ctx.supabase
          .from("clients")
          .select("id, name")
          .eq("organization_id", ctx.org.id)
          .or(clientNames.map((value) => `name.ilike.${escape(value)}`).join(","))
          .limit(5)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    email
      ? ctx.supabase
          .from("contacts")
          .select("client_id, clients ( id, name )")
          .eq("organization_id", ctx.org.id)
          .ilike("email", escape(email))
          .limit(5)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const leads = (leadRows.data ?? [])
    .filter((row) => row.id !== input.excludeLeadId)
    .map((row) => {
      const why =
        email && norm(row.email as string) === email
          ? "Same email"
          : phone.length >= 7 && digits(row.phone as string).endsWith(phone.slice(-7))
            ? "Same phone"
            : "Same name";
      return {
        id: String(row.id),
        name: String(row.name),
        company: (row.company as string | null) ?? null,
        stage: String(row.stage),
        why,
      };
    });

  const clients = new Map<string, { id: string; name: string; why: string }>();
  for (const row of contactRows.data ?? []) {
    const joined = row.clients as { id: string; name: string } | { id: string; name: string }[] | null;
    const client = Array.isArray(joined) ? joined[0] : joined;
    if (client) clients.set(client.id, { id: client.id, name: client.name, why: "Same email" });
  }
  for (const row of clientRows.data ?? []) {
    const id = String(row.id);
    if (!clients.has(id)) clients.set(id, { id, name: String(row.name), why: "Same name" });
  }

  return { leads, clients: [...clients.values()] };
}

export async function listClientOptionsAction(
  orgSlug: string,
): Promise<{ id: string; name: string }[]> {
  const ctx = await requireOrg(orgSlug);
  const { data } = await ctx.supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", ctx.org.id)
    .order("name", { ascending: true })
    .limit(500);
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }));
}

export type LeadDocumentRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  updatedAt: string;
};

export async function listLeadDocumentsAction(
  orgSlug: string,
  leadId: string,
): Promise<LeadDocumentRow[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.documents) return [];
  const { data } = await ctx.supabase
    .from("documents")
    .select("id, title, kind, status, updated_at")
    .eq("organization_id", ctx.org.id)
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    kind: String(row.kind),
    status: String(row.status),
    updatedAt: String(row.updated_at),
  }));
}
