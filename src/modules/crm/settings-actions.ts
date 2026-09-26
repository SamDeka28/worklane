"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/modules/identity/org";
import {
  parseCrmSettings,
  type CrmSettings,
  type LeadEmailTemplate,
} from "@/modules/crm/settings";
import { parseMajorToMinor, type IsoCurrency } from "@/shared/money";

type Ctx = Awaited<ReturnType<typeof requireModuleWrite>>;

async function readSettings(ctx: Ctx) {
  const { data } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .maybeSingle();
  const root =
    data?.settings && typeof data.settings === "object"
      ? (data.settings as Record<string, unknown>)
      : {};
  return { root, crm: parseCrmSettings(root) };
}

async function writeCrm(ctx: Ctx, root: Record<string, unknown>, crm: CrmSettings) {
  const { error } = await ctx.supabase
    .from("organizations")
    .update({ settings: { ...root, crm } })
    .eq("id", ctx.org.id);
  return error;
}

function list(raw: string, max: number) {
  return [
    ...new Set(
      raw
        .split(/\n|,/)
        .map((item) => item.trim().slice(0, 60))
        .filter(Boolean),
    ),
  ].slice(0, max);
}

export async function updateCrmSettingsAction(orgSlug: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "crm");
  const { root, crm } = await readSettings(ctx);

  const next = { ...crm };
  if (formData.has("stale_days")) {
    const stale = Number(formData.get("stale_days"));
    if (Number.isFinite(stale)) next.staleDays = Math.min(Math.max(Math.round(stale), 0), 365);
  }
  if (formData.has("lost_reasons")) {
    const lostReasons = list(String(formData.get("lost_reasons") ?? ""), 20);
    if (lostReasons.length === 0) return { error: "Keep at least one lost reason" };
    next.lostReasons = lostReasons;
  }
  if (formData.has("sources")) {
    const sources = list(String(formData.get("sources") ?? ""), 30);
    if (sources.length > 0) next.sources = sources;
  }

  const error = await writeCrm(ctx, root, next);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function saveEmailTemplatesAction(orgSlug: string, templates: LeadEmailTemplate[]) {
  const ctx = await requireModuleWrite(orgSlug, "crm");
  const { root, crm } = await readSettings(ctx);
  const cleaned = parseCrmSettings({
    crm: {
      emailTemplates: templates.map((item) => ({
        ...item,
        id: item.id || randomBytes(6).toString("base64url"),
      })),
    },
  }).emailTemplates;
  if (cleaned.some((item) => !item.subject.trim() || !item.body.trim())) {
    return { error: "Every template needs a subject and a message" };
  }
  const error = await writeCrm(ctx, root, { ...crm, emailTemplates: cleaned });
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export async function updateStageProbabilitiesAction(
  orgSlug: string,
  values: { stageId: string; percent: number }[],
) {
  const ctx = await requireModuleWrite(orgSlug, "crm");
  for (const row of values) {
    const percent = Math.min(Math.max(Math.round(Number(row.percent) || 0), 0), 100);
    const { error } = await ctx.supabase
      .from("lead_stages")
      .update({ probability_bps: percent * 100 })
      .eq("id", row.stageId)
      .eq("organization_id", ctx.org.id)
      .is("system_key", null);
    if (error) return { error: error.message };
  }
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const };
}

export async function saveLeadIntakeAction(orgSlug: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "crm");
  const { root, crm } = await readSettings(ctx);

  const enabled = formData.get("enabled") === "on";
  const regenerate = formData.get("regenerate") === "1";
  const ownerRaw = String(formData.get("owner_user_id") ?? "").trim();
  let ownerUserId: string | null = null;
  if (ownerRaw) {
    const { data: member } = await ctx.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ctx.org.id)
      .eq("user_id", ownerRaw)
      .eq("status", "active")
      .maybeSingle();
    ownerUserId = member ? String(member.user_id) : null;
  }

  const code =
    !crm.intake.code || regenerate ? randomBytes(9).toString("base64url") : crm.intake.code;

  const error = await writeCrm(ctx, root, {
    ...crm,
    intake: {
      enabled,
      code,
      headline: String(formData.get("headline") ?? "").trim().slice(0, 120),
      intro: String(formData.get("intro") ?? "").trim().slice(0, 600),
      ownerUserId,
      source: String(formData.get("source") ?? "").trim().slice(0, 60) || "Website form",
      askCompany: formData.get("ask_company") === "on",
      askPhone: formData.get("ask_phone") === "on",
      askBudget: formData.get("ask_budget") === "on",
    },
  });
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true as const, code };
}

export type ImportLeadRow = {
  name?: string;
  company?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  value?: string;
  tags?: string;
  notes?: string;
  stage?: string;
};

export async function importLeadsAction(
  orgSlug: string,
  rows: ImportLeadRow[],
  options: { skipDuplicates: boolean; ownerUserId?: string | null },
) {
  const ctx = await requireModuleWrite(orgSlug, "crm");
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  if (rows.length === 0) return { error: "Nothing to import" };
  if (rows.length > 1000) return { error: "Import up to 1,000 rows at a time" };

  const { data: stageRows } = await ctx.supabase
    .from("lead_stages")
    .select("slug, name, position, system_key")
    .eq("organization_id", ctx.org.id)
    .order("position", { ascending: true });
  const stages = stageRows ?? [];
  const firstOpen = stages.find((row) => row.system_key == null)?.slug ?? "new";
  const stageFor = (raw?: string) => {
    const value = (raw ?? "").trim().toLowerCase();
    if (!value) return String(firstOpen);
    const match = stages.find(
      (row) => String(row.slug) === value || String(row.name).toLowerCase() === value,
    );
    return match && match.system_key !== "lost" ? String(match.slug) : String(firstOpen);
  };

  let owner: string | null = ctx.userId;
  if (options.ownerUserId === null) owner = null;
  else if (options.ownerUserId) {
    const { data: member } = await ctx.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ctx.org.id)
      .eq("user_id", options.ownerUserId)
      .eq("status", "active")
      .maybeSingle();
    owner = member ? String(member.user_id) : ctx.userId;
  }

  const known = new Set<string>();
  if (options.skipDuplicates) {
    const { data: existing } = await ctx.supabase
      .from("leads")
      .select("email")
      .eq("organization_id", ctx.org.id)
      .not("email", "is", null);
    for (const row of existing ?? []) known.add(String(row.email).trim().toLowerCase());
  }

  const currency: IsoCurrency = ctx.org.defaultCurrency;
  let skipped = 0;
  const inserts: Record<string, unknown>[] = [];
  for (const row of rows) {
    const company = row.company?.trim().slice(0, 160) || null;
    const contact = row.contactName?.trim().slice(0, 160) || null;
    const name = row.name?.trim().slice(0, 160) || company || contact;
    if (!name) {
      skipped++;
      continue;
    }
    const email = row.email?.trim().toLowerCase().slice(0, 254) || null;
    if (email && known.has(email)) {
      skipped++;
      continue;
    }
    if (email) known.add(email);

    let value: string | null = null;
    const rawValue = row.value?.replace(/[^\d.]/g, "") ?? "";
    if (rawValue) {
      try {
        value = parseMajorToMinor(rawValue, currency).toString();
      } catch {
        value = null;
      }
    }

    inserts.push({
      organization_id: ctx.org.id,
      name,
      company,
      contact_name: contact,
      email,
      phone: row.phone?.trim().slice(0, 40) || null,
      source: row.source?.trim().slice(0, 60) || "Import",
      estimated_value_minor: value,
      currency,
      owner_user_id: owner,
      tags: (row.tags ?? "")
        .split(/[,;#]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 24),
      notes: row.notes?.trim().slice(0, 4000) || null,
      stage: stageFor(row.stage),
      origin: "import",
    });
  }

  for (let index = 0; index < inserts.length; index += 200) {
    const { error } = await ctx.supabase.from("leads").insert(inserts.slice(index, index + 200));
    if (error) {
      return {
        error: `Stopped after ${index} leads: ${error.message}`,
        imported: index,
        skipped,
      };
    }
  }

  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const, imported: inserts.length, skipped };
}
