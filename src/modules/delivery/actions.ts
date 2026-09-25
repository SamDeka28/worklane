"use server";

import { revalidatePath } from "next/cache";
import {
  allowsContractedProjectCharge,
  chargeFromWorkLog,
  guardContractedCharge,
  guardMilestoneBilling,
  hoursToMillis,
  parseHours,
} from "@/modules/delivery/ledger";
import { statusForColumn } from "@/modules/delivery/board";
import {
  BILLING_MODES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
  TASK_KINDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type BillingMode,
  type MilestoneStatus,
  type TaskKind,
  type TaskPriority,
  type TaskStatus,
} from "@/modules/delivery/types";
import { requireWritableOrg } from "@/modules/identity/org";
import {
  allocatePartnersForCharge,
} from "@/modules/partners/allocate";
import { netFromGross, parseMajorToMinor } from "@/shared/money";
import type { IsoCurrency } from "@/shared/money";

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

function asCurrency(value: string, fallback: IsoCurrency): IsoCurrency {
  return value === "INR" || value === "USD" ? value : fallback;
}

function parseEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function normalizeTaskLabels(raw: FormDataEntryValue | null): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  let parts: string[] = [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) parts = parsed.map((item) => String(item ?? ""));
    } catch {
      parts = text.split(/[,|\n]/);
    }
  } else {
    parts = text.split(/[,|\n]/);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const label = part.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= 12) break;
  }
  return out;
}

async function loadProjectRow(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  projectId: string,
) {
  const { data, error } = await ctx.supabase
    .from("projects")
    .select("id, client_id, name, billing_mode, default_fee_bps, earn_on")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data;
}

async function loadClientCurrency(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  clientId: string,
) {
  const { data } = await ctx.supabase
    .from("clients")
    .select("id, currency")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  return data ? asCurrency(data.currency, ctx.org.defaultCurrency) : null;
}

export async function createProjectAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "");
  const status = parseEnum(String(formData.get("status") ?? "active"), PROJECT_STATUSES, "active");
  const billingMode = parseEnum(
    String(formData.get("billing_mode") ?? "hourly"),
    BILLING_MODES,
    "hourly",
  );
  const feeBps = Number(formData.get("default_fee_bps") ?? 500);
  const earnOn = String(formData.get("earn_on") ?? "charge") === "receipt" ? "receipt" : "charge";
  const scope = String(formData.get("scope") ?? "").trim() || null;
  let scopeDoc: unknown = null;
  const scopeDocRaw = String(formData.get("scope_doc") ?? "").trim();
  if (scopeDocRaw) {
    try {
      scopeDoc = JSON.parse(scopeDocRaw);
    } catch {
      return { error: "Invalid scope document" };
    }
  }
  const startsOn = String(formData.get("starts_on") ?? "").trim() || null;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;

  if (!name) return { error: "Project name is required" };
  if (!clientId) return { error: "Choose a client" };
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    return { error: "Fee must be between 0 and 10000 bps" };
  }

  const currency = await loadClientCurrency(ctx, clientId);
  if (!currency) return { error: "Client not found" };

  let contractedAmountMinor: string | null = null;
  const contractedRaw = String(formData.get("contracted_amount") ?? "").trim();
  if (contractedRaw) {
    try {
      const minor = parseMajorToMinor(contractedRaw, currency);
      if (minor < BigInt(0)) return { error: "Contracted amount cannot be negative" };
      contractedAmountMinor = minor.toString();
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Enter a valid amount" };
    }
  }

  const { data: project, error } = await ctx.supabase
    .from("projects")
    .insert({
      organization_id: ctx.org.id,
      client_id: clientId,
      name,
      status,
      billing_mode: billingMode,
      default_fee_bps: feeBps,
      earn_on: earnOn,
      contracted_amount_minor: contractedAmountMinor,
      scope,
      scope_doc: scopeDoc,
      starts_on: startsOn,
      due_on: dueOn,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: error?.message ?? "Could not create project" };
  }

  await ctx.supabase.from("project_members").upsert(
    {
      organization_id: ctx.org.id,
      project_id: project.id,
      user_id: ctx.userId,
      role: "lead",
    },
    { onConflict: "project_id,user_id" },
  );

  await recordActivity(ctx, "created", "project", project.id, { name, client_id: clientId });

  const documentIds = formData
    .getAll("document_id")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (documentIds.length > 0) {
    const unique = [...new Set(documentIds)];
    const { data: docs } = await ctx.supabase
      .from("documents")
      .select("id, client_id, project_id")
      .eq("organization_id", ctx.org.id)
      .in("id", unique);
    const okIds = (docs ?? [])
      .filter(
        (doc) =>
          !doc.project_id &&
          (!doc.client_id || doc.client_id === clientId),
      )
      .map((doc) => doc.id as string);
    if (okIds.length > 0) {
      await ctx.supabase
        .from("documents")
        .update({ project_id: project.id, client_id: clientId })
        .eq("organization_id", ctx.org.id)
        .in("id", okIds);
    }
  }

  revalidatePath(`/${orgSlug}`);
  return { id: project.id as string };
}

export async function deleteProjectAction(
  orgSlug: string,
  projectId: string,
  confirmName: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only owners and admins can delete projects" };
  }
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };
  if (confirmName.trim() !== String(project.name).trim()) {
    return { error: "Project name doesn’t match" };
  }

  const { data: taskRows } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  const taskIds = (taskRows ?? []).map((row) => row.id as string);

  const { error, count } = await ctx.supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id);
  if (error) {
    if (error.code === "23503") {
      return {
        error: "Partner payouts are recorded against this project’s split, so it can’t be deleted.",
      };
    }
    return { error: error.message };
  }
  if (!count) return { error: "You don’t have permission to delete this project" };

  const deletedAt = new Date().toISOString();
  await ctx.supabase
    .from("files")
    .update({ deleted_at: deletedAt })
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", "project")
    .eq("entity_id", projectId);
  if (taskIds.length > 0) {
    await ctx.supabase
      .from("files")
      .update({ deleted_at: deletedAt })
      .eq("organization_id", ctx.org.id)
      .eq("entity_type", "task")
      .in("entity_id", taskIds);
  }

  revalidatePath(`/${orgSlug}/projects`);
  revalidatePath(`/${orgSlug}/board`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function updateProjectAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };

  const name = String(formData.get("name") ?? "").trim();
  const status = parseEnum(String(formData.get("status") ?? "active"), PROJECT_STATUSES, "active");
  const billingMode = parseEnum(
    String(formData.get("billing_mode") ?? project.billing_mode),
    BILLING_MODES,
    "hourly",
  );
  const feeBps = Number(formData.get("default_fee_bps") ?? project.default_fee_bps);
  const earnOn = String(formData.get("earn_on") ?? project.earn_on) === "receipt" ? "receipt" : "charge";
  const scope = String(formData.get("scope") ?? "").trim() || null;
  let scopeDoc: unknown = null;
  const scopeDocRaw = String(formData.get("scope_doc") ?? "").trim();
  if (scopeDocRaw) {
    try {
      scopeDoc = JSON.parse(scopeDocRaw);
    } catch {
      return { error: "Invalid scope document" };
    }
  }
  const startsOn = String(formData.get("starts_on") ?? "").trim() || null;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;

  if (!name) return { error: "Project name is required" };
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    return { error: "Fee must be between 0 and 10000 bps" };
  }

  const currency = await loadClientCurrency(ctx, project.client_id);
  if (!currency) return { error: "Client not found" };

  let contractedAmountMinor: string | null = null;
  const contractedRaw = String(formData.get("contracted_amount") ?? "").trim();
  if (contractedRaw) {
    try {
      contractedAmountMinor = parseMajorToMinor(contractedRaw, currency).toString();
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Enter a valid amount" };
    }
  }

  const { error } = await ctx.supabase
    .from("projects")
    .update({
      name,
      status,
      billing_mode: billingMode,
      default_fee_bps: feeBps,
      earn_on: earnOn,
      contracted_amount_minor: contractedAmountMinor,
      scope,
      scope_doc: scopeDoc,
      starts_on: startsOn,
      due_on: dueOn,
    })
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  await recordActivity(ctx, "updated", "project", projectId, { name });
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/projects`);
  return { ok: true as const };
}

export async function setProjectStatusAction(
  orgSlug: string,
  projectId: string,
  status: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };
  const next = parseEnum(status, PROJECT_STATUSES, "active");
  const { error } = await ctx.supabase
    .from("projects")
    .update({ status: next })
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/projects`);
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true as const };
}

export async function createWorkLogAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };

  const currency = await loadClientCurrency(ctx, project.client_id);
  if (!currency) return { error: "Client not found" };

  const workedOn =
    String(formData.get("worked_on") ?? "") || new Date().toISOString().slice(0, 10);
  const description = String(formData.get("description") ?? "").trim() || null;
  const externalUrl = String(formData.get("external_url") ?? "").trim() || null;
  const milestoneId = String(formData.get("milestone_id") ?? "").trim() || null;
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const rateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const fixedRaw = String(formData.get("fixed_amount") ?? "").trim();

  let hours: number | null = null;
  let hourlyRateMinor: bigint | null = null;
  let fixedMinor: bigint | null = null;
  let hoursMillis: number | null = null;

  try {
    if (fixedRaw) {
      fixedMinor = parseMajorToMinor(fixedRaw, currency);
      if (fixedMinor <= BigInt(0)) return { error: "Fixed amount must be greater than zero" };
    }
    if (hoursRaw) {
      hours = parseHours(hoursRaw);
      hoursMillis = hoursToMillis(hours);
    }
    if (rateRaw) {
      hourlyRateMinor = parseMajorToMinor(rateRaw, currency);
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount" };
  }

  let posted;
  try {
    posted = chargeFromWorkLog({
      billingMode: project.billing_mode as BillingMode,
      hours,
      hourlyRateMinor,
      fixedMinor,
      feeBps: project.default_fee_bps,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not price this log" };
  }

  const { data: log, error } = await ctx.supabase
    .from("work_logs")
    .insert({
      organization_id: ctx.org.id,
      project_id: projectId,
      milestone_id: milestoneId,
      worked_on: workedOn,
      hours_millis: hoursMillis,
      hourly_rate_minor: hourlyRateMinor?.toString() ?? null,
      fixed_minor: fixedMinor?.toString() ?? null,
      description,
      external_url: externalUrl,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !log) {
    return { error: error?.message ?? "Could not save work log" };
  }

  if (posted.postsCharge) {
    const memo =
      description ??
      (hours
        ? `${hours}h on ${project.name}`
        : `Work on ${project.name}`);
    const { data: charge, error: chargeError } = await ctx.supabase
      .from("charges")
      .insert({
        organization_id: ctx.org.id,
        client_id: project.client_id,
        project_id: projectId,
        work_log_id: log.id,
        gross_minor: posted.gross.toString(),
        fee_bps: project.default_fee_bps,
        net_minor: posted.net.toString(),
        currency,
        charged_on: workedOn,
        source: "work_log",
        status: "open",
        memo,
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    if (chargeError || !charge) {
      return { error: chargeError?.message ?? "Logged, but the charge could not be posted" };
    }

    await ctx.supabase
      .from("work_logs")
      .update({ charge_id: charge.id })
      .eq("id", log.id)
      .eq("organization_id", ctx.org.id);

    try {
      await allocatePartnersForCharge(ctx, {
        chargeId: charge.id,
        projectId,
        netMinor: posted.net,
        currency,
        earnedOn: workedOn,
        earnOn: project.earn_on === "receipt" ? "receipt" : "charge",
      });
    } catch (allocError) {
      return {
        error:
          allocError instanceof Error
            ? allocError.message
            : "Logged, but partner earnings failed",
      };
    }

    await recordActivity(ctx, "charged", "client", project.client_id, {
      charge_id: charge.id,
      work_log_id: log.id,
      project_id: projectId,
      gross_minor: posted.gross.toString(),
    });
  }

  await recordActivity(ctx, "logged", "project", projectId, {
    work_log_id: log.id,
    charged: posted.postsCharge,
  });

  revalidatePath(`/${orgSlug}`);
  return { id: log.id as string, charged: posted.postsCharge };
}

async function syncProjectContractedFromMilestones(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  projectId: string,
) {
  const { data: rows, error } = await ctx.supabase
    .from("milestones")
    .select("amount_minor, status")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  if (error) return;

  let total = BigInt(0);
  let hasPriced = false;
  for (const row of rows ?? []) {
    if (row.status === "cancelled") continue;
    if (row.amount_minor == null) continue;
    hasPriced = true;
    total += BigInt(row.amount_minor);
  }

  await ctx.supabase
    .from("projects")
    .update({
      contracted_amount_minor: hasPriced ? total.toString() : null,
    })
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id);
}

export async function createMilestoneAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };

  const name = String(formData.get("name") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const description =
    String(formData.get("description") ?? formData.get("deliverables") ?? "").trim() || null;
  let descriptionDoc: unknown = null;
  const descriptionDocRaw = String(
    formData.get("description_doc") ?? formData.get("deliverables_doc") ?? "",
  ).trim();
  if (descriptionDocRaw) {
    try {
      descriptionDoc = JSON.parse(descriptionDocRaw);
    } catch {
      descriptionDoc = null;
    }
  }
  const status = parseEnum(
    String(formData.get("status") ?? "planned"),
    MILESTONE_STATUSES,
    "planned",
  ) satisfies MilestoneStatus;
  if (!name) return { error: "Milestone name is required" };

  const currency = await loadClientCurrency(ctx, project.client_id);
  if (!currency) return { error: "Client not found" };

  let amountMinor: string | null = null;
  const amountRaw = String(formData.get("amount") ?? "").trim();
  if (amountRaw) {
    try {
      amountMinor = parseMajorToMinor(amountRaw, currency).toString();
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Enter a valid amount" };
    }
  }

  const insertModern = {
    organization_id: ctx.org.id,
    project_id: projectId,
    name,
    status,
    amount_minor: amountMinor,
    due_on: dueOn,
    description,
    description_doc: descriptionDoc,
  };
  const insertLegacy = {
    organization_id: ctx.org.id,
    project_id: projectId,
    name,
    status,
    amount_minor: amountMinor,
    due_on: dueOn,
    deliverables: description,
    deliverables_doc: descriptionDoc,
  };

  let milestone: { id: string } | null = null;
  let errorMessage: string | null = null;
  for (const payload of [insertModern, insertLegacy] as Record<string, unknown>[]) {
    const { data, error } = await ctx.supabase
      .from("milestones")
      .insert(payload)
      .select("id")
      .single();
    if (!error && data) {
      milestone = data as { id: string };
      break;
    }
    errorMessage = error?.message ?? "Could not create milestone";
  }

  if (!milestone) {
    return { error: errorMessage ?? "Could not create milestone" };
  }

  await syncProjectContractedFromMilestones(ctx, projectId);

  await recordActivity(ctx, "created", "project", projectId, {
    milestone_id: milestone.id,
    name,
  });
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { id: milestone.id as string, name };
}

export async function updateMilestoneStatusAction(
  orgSlug: string,
  milestoneId: string,
  status: MilestoneStatus,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!MILESTONE_STATUSES.includes(status)) return { error: "Unknown milestone status" };

  const { data: milestone, error } = await ctx.supabase
    .from("milestones")
    .update({ status })
    .eq("id", milestoneId)
    .eq("organization_id", ctx.org.id)
    .select("project_id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!milestone) return { error: "Milestone not found" };

  revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const };
}

export async function updateMilestoneAction(
  orgSlug: string,
  milestoneId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: existing } = await ctx.supabase
    .from("milestones")
    .select("id, project_id, charge_id")
    .eq("id", milestoneId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!existing) return { error: "Milestone not found" };

  const project = await loadProjectRow(ctx, existing.project_id);
  if (!project) return { error: "Project not found" };

  const name = String(formData.get("name") ?? "").trim();
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const description =
    String(formData.get("description") ?? formData.get("deliverables") ?? "").trim() || null;
  let descriptionDoc: unknown = null;
  const descriptionDocRaw = String(
    formData.get("description_doc") ?? formData.get("deliverables_doc") ?? "",
  ).trim();
  if (descriptionDocRaw) {
    try {
      descriptionDoc = JSON.parse(descriptionDocRaw);
    } catch {
      descriptionDoc = null;
    }
  }
  const status = parseEnum(
    String(formData.get("status") ?? "planned"),
    MILESTONE_STATUSES,
    "planned",
  ) satisfies MilestoneStatus;
  if (!name) return { error: "Milestone name is required" };

  const patchModern: Record<string, unknown> = {
    name,
    status,
    due_on: dueOn,
    description,
    description_doc: descriptionDoc,
  };
  const patchLegacy: Record<string, unknown> = {
    name,
    status,
    due_on: dueOn,
    deliverables: description,
    deliverables_doc: descriptionDoc,
  };

  if (!existing.charge_id) {
    const currency = await loadClientCurrency(ctx, project.client_id);
    if (!currency) return { error: "Client not found" };
    const amountRaw = String(formData.get("amount") ?? "").trim();
    if (!amountRaw) {
      patchModern.amount_minor = null;
      patchLegacy.amount_minor = null;
    } else {
      try {
        const amountMinor = parseMajorToMinor(amountRaw, currency).toString();
        patchModern.amount_minor = amountMinor;
        patchLegacy.amount_minor = amountMinor;
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Enter a valid amount" };
      }
    }
  }

  let errorMessage: string | null = null;
  for (const patch of [patchModern, patchLegacy]) {
    const { error } = await ctx.supabase
      .from("milestones")
      .update(patch)
      .eq("id", milestoneId)
      .eq("organization_id", ctx.org.id);
    if (!error) {
      errorMessage = null;
      break;
    }
    errorMessage = error.message;
  }

  if (errorMessage) return { error: errorMessage };

  await syncProjectContractedFromMilestones(ctx, existing.project_id);

  await recordActivity(ctx, "updated", "project", existing.project_id, {
    milestone_id: milestoneId,
    name,
  });
  revalidatePath(`/${orgSlug}/projects/${existing.project_id}`);
  revalidatePath(`/${orgSlug}/projects/${existing.project_id}`, "page");
  return { ok: true as const };
}

export async function createTaskFromMilestoneAction(orgSlug: string, milestoneId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("id, project_id, name, due_on, description, description_doc, deliverables, deliverables_doc, status")
    .eq("id", milestoneId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!milestone) return { error: "Milestone not found" };
  if (milestone.status === "cancelled") {
    return { error: "Cancelled milestones can’t become tasks" };
  }

  const description =
    (milestone as { description?: string | null }).description ??
    (milestone as { deliverables?: string | null }).deliverables ??
    null;
  const descriptionDoc =
    (milestone as { description_doc?: unknown }).description_doc ??
    (milestone as { deliverables_doc?: unknown }).deliverables_doc ??
    null;

  const { data: existingTask } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("milestone_id", milestoneId)
    .limit(1)
    .maybeSingle();

  if (existingTask) {
    return { error: "This milestone already has a board task", taskId: existingTask.id as string };
  }

  const { data: columns } = await ctx.supabase
    .from("project_columns")
    .select("id, system_key, position")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", milestone.project_id)
    .order("position");

  const column =
    columns?.find((row) => row.system_key === "todo") ?? columns?.[0] ?? null;
  if (!column) return { error: "Add a board column first" };

  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("position")
    .eq("organization_id", ctx.org.id)
    .eq("column_id", column.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      organization_id: ctx.org.id,
      project_id: milestone.project_id,
      milestone_id: milestone.id,
      column_id: column.id,
      title: milestone.name,
      description,
      description_doc: descriptionDoc,
      due_on: milestone.due_on,
      priority: "medium",
      status: statusForColumn(
        column.system_key === "todo" || column.system_key === "doing" || column.system_key === "done"
          ? column.system_key
          : null,
      ),
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error || !task) return { error: error?.message ?? "Could not create task" };

  await recordActivity(ctx, "tasked", "project", milestone.project_id, {
    milestone_id: milestone.id,
    title: milestone.name,
  });
  revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const, taskId: task.id as string };
}

export async function addMilestoneItemAction(
  orgSlug: string,
  milestoneId: string,
  title: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const trimmed = title.trim();
  if (!trimmed) return { error: "Deliverable title is required" };

  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("id, project_id")
    .eq("id", milestoneId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!milestone) return { error: "Milestone not found" };

  const { data: last } = await ctx.supabase
    .from("milestone_items")
    .select("position")
    .eq("organization_id", ctx.org.id)
    .eq("milestone_id", milestoneId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from("milestone_items")
    .insert({
      organization_id: ctx.org.id,
      milestone_id: milestoneId,
      title: trimmed,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) {
    if (/milestone_items|does not exist|schema cache/i.test(error.message)) {
      return { error: "Apply the milestone_items migration, then try again" };
    }
    return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const, id: data.id as string };
}

export async function deleteMilestoneItemAction(orgSlug: string, itemId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: item, error } = await ctx.supabase
    .from("milestone_items")
    .delete()
    .eq("id", itemId)
    .eq("organization_id", ctx.org.id)
    .select("milestone_id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!item) return { error: "Deliverable not found" };

  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("project_id")
    .eq("id", item.milestone_id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (milestone) revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const };
}

export async function createTaskFromMilestoneItemAction(orgSlug: string, itemId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: item } = await ctx.supabase
    .from("milestone_items")
    .select("id, milestone_id, title, task_id")
    .eq("id", itemId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!item) return { error: "Deliverable not found" };
  if (item.task_id) return { error: "This deliverable already has a board task", taskId: item.task_id as string };

  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("id, project_id, due_on, status")
    .eq("id", item.milestone_id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!milestone) return { error: "Milestone not found" };
  if (milestone.status === "cancelled") {
    return { error: "Cancelled milestones can’t create tasks" };
  }

  const { data: columns } = await ctx.supabase
    .from("project_columns")
    .select("id, system_key, position")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", milestone.project_id)
    .order("position");

  const column =
    columns?.find((row) => row.system_key === "todo") ?? columns?.[0] ?? null;
  if (!column) return { error: "Add a board column first" };

  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("position")
    .eq("organization_id", ctx.org.id)
    .eq("column_id", column.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: task, error } = await ctx.supabase
    .from("tasks")
    .insert({
      organization_id: ctx.org.id,
      project_id: milestone.project_id,
      milestone_id: milestone.id,
      column_id: column.id,
      title: item.title,
      due_on: milestone.due_on,
      priority: "medium",
      status: statusForColumn(
        column.system_key === "todo" || column.system_key === "doing" || column.system_key === "done"
          ? column.system_key
          : null,
      ),
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error || !task) return { error: error?.message ?? "Could not create task" };

  const { error: linkError } = await ctx.supabase
    .from("milestone_items")
    .update({ task_id: task.id })
    .eq("id", item.id)
    .eq("organization_id", ctx.org.id);

  if (linkError) return { error: linkError.message };

  await recordActivity(ctx, "tasked", "project", milestone.project_id, {
    milestone_id: milestone.id,
    milestone_item_id: item.id,
    title: item.title,
  });
  revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const, taskId: task.id as string };
}

export async function removeMilestoneBoardTaskAction(orgSlug: string, milestoneId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("id, project_id")
    .eq("id", milestoneId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!milestone) return { error: "Milestone not found" };

  const { data: itemRows } = await ctx.supabase
    .from("milestone_items")
    .select("task_id")
    .eq("organization_id", ctx.org.id)
    .eq("milestone_id", milestoneId)
    .not("task_id", "is", null);

  const itemTaskIds = new Set(
    (itemRows ?? []).map((row) => row.task_id as string).filter(Boolean),
  );

  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("milestone_id", milestoneId);

  const boardTask = (tasks ?? []).find((task) => !itemTaskIds.has(task.id as string));
  if (!boardTask) return { error: "No milestone board card to remove" };

  const { error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("id", boardTask.id)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const };
}

export async function unlinkMilestoneItemTaskAction(orgSlug: string, itemId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: item } = await ctx.supabase
    .from("milestone_items")
    .select("id, milestone_id, task_id")
    .eq("id", itemId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!item) return { error: "Deliverable not found" };
  if (!item.task_id) return { error: "This deliverable is not on the board" };

  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("project_id")
    .eq("id", item.milestone_id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("id", item.task_id)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  // Clear link even if FK already nulled.
  await ctx.supabase
    .from("milestone_items")
    .update({ task_id: null })
    .eq("id", item.id)
    .eq("organization_id", ctx.org.id);

  if (milestone) revalidatePath(`/${orgSlug}/projects/${milestone.project_id}`);
  return { ok: true as const };
}

export async function billMilestoneAction(orgSlug: string, milestoneId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: milestone } = await ctx.supabase
    .from("milestones")
    .select("id, project_id, name, amount_minor, charge_id, status")
    .eq("id", milestoneId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!milestone) return { error: "Milestone not found" };
  if (milestone.charge_id) return { error: "This milestone is already billed" };
  if (milestone.amount_minor == null) {
    return { error: "Set an amount before billing this milestone" };
  }

  const project = await loadProjectRow(ctx, milestone.project_id);
  if (!project) return { error: "Project not found" };

  try {
    guardMilestoneBilling(project.billing_mode as BillingMode);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cannot bill this milestone" };
  }

  const currency = await loadClientCurrency(ctx, project.client_id);
  if (!currency) return { error: "Client not found" };

  const grossMinor = BigInt(milestone.amount_minor);
  if (grossMinor <= BigInt(0)) return { error: "Milestone amount must be greater than zero" };
  const netMinor = netFromGross(grossMinor, project.default_fee_bps);

  const { data: charge, error } = await ctx.supabase
    .from("charges")
    .insert({
      organization_id: ctx.org.id,
      client_id: project.client_id,
      project_id: project.id,
      milestone_id: milestone.id,
      gross_minor: grossMinor.toString(),
      fee_bps: project.default_fee_bps,
      net_minor: netMinor.toString(),
      currency,
      charged_on: new Date().toISOString().slice(0, 10),
      source: "milestone",
      status: "open",
      memo: milestone.name,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !charge) {
    return { error: error?.message ?? "Could not post the milestone charge" };
  }

  const { error: updateError } = await ctx.supabase
    .from("milestones")
    .update({
      charge_id: charge.id,
      billed_at: new Date().toISOString(),
    })
    .eq("id", milestone.id)
    .eq("organization_id", ctx.org.id);

  if (updateError) return { error: updateError.message };

  try {
    await allocatePartnersForCharge(ctx, {
      chargeId: charge.id,
      projectId: project.id,
      netMinor: netMinor,
      currency,
      earnedOn: new Date().toISOString().slice(0, 10),
      earnOn: project.earn_on === "receipt" ? "receipt" : "charge",
    });
  } catch (allocError) {
    return {
      error:
        allocError instanceof Error
          ? allocError.message
          : "Billed, but partner earnings failed",
    };
  }

  await recordActivity(ctx, "charged", "client", project.client_id, {
    charge_id: charge.id,
    milestone_id: milestone.id,
    project_id: project.id,
  });
  revalidatePath(`/${orgSlug}`);
  return {
    ok: true as const,
    chargeId: charge.id as string,
    projectId: project.id as string,
  };
}

export async function postContractedChargeAction(orgSlug: string, projectId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, client_id, name, billing_mode, default_fee_bps, earn_on, contracted_amount_minor")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!project) return { error: "Project not found" };

  try {
    guardContractedCharge(project.billing_mode as BillingMode);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cannot post this charge" };
  }

  if (!allowsContractedProjectCharge(project.billing_mode as BillingMode)) {
    return { error: "This billing mode does not post a contracted project charge" };
  }
  if (project.contracted_amount_minor == null) {
    return { error: "Set a contracted amount on the project first" };
  }

  const { data: existing } = await ctx.supabase
    .from("charges")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .eq("source", "manual")
    .eq("status", "open")
    .limit(1);

  if (existing && existing.length > 0) {
    return { error: "A contracted charge already exists for this project" };
  }

  const currency = await loadClientCurrency(ctx, project.client_id);
  if (!currency) return { error: "Client not found" };

  const grossMinor = BigInt(project.contracted_amount_minor);
  if (grossMinor <= BigInt(0)) return { error: "Contracted amount must be greater than zero" };
  const netMinor = netFromGross(grossMinor, project.default_fee_bps);

  const { data: charge, error } = await ctx.supabase
    .from("charges")
    .insert({
      organization_id: ctx.org.id,
      client_id: project.client_id,
      project_id: projectId,
      gross_minor: grossMinor.toString(),
      fee_bps: project.default_fee_bps,
      net_minor: netMinor.toString(),
      currency,
      charged_on: new Date().toISOString().slice(0, 10),
      source: "manual",
      status: "open",
      memo: `Contracted · ${project.name}`,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !charge) {
    return { error: error?.message ?? "Could not post contracted charge" };
  }

  try {
    await allocatePartnersForCharge(ctx, {
      chargeId: charge.id,
      projectId,
      netMinor,
      currency,
      earnedOn: new Date().toISOString().slice(0, 10),
      earnOn: project.earn_on === "receipt" ? "receipt" : "charge",
    });
  } catch (allocError) {
    return {
      error:
        allocError instanceof Error
          ? allocError.message
          : "Charged, but partner earnings failed",
    };
  }

  await recordActivity(ctx, "charged", "client", project.client_id, {
    charge_id: charge.id,
    project_id: projectId,
  });
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

async function resolveProjectAssignees(
  ctx: Awaited<ReturnType<typeof requireWritableOrg>>,
  projectId: string,
  formData: FormData,
) {
  const raw = String(formData.get("assignee_user_ids") ?? formData.get("assignee_user_id") ?? "").trim();
  let ids: string[] = [];
  if (!raw) {
    return { assigneeUserIds: [] as string[], assigneeUserId: null as string | null };
  }
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) ids = parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    } catch {
      ids = raw.split(",").map((item) => item.trim()).filter(Boolean);
    }
  } else {
    ids = raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
  ids = [...new Set(ids)].slice(0, 8);
  if (ids.length === 0) {
    return { assigneeUserIds: [] as string[], assigneeUserId: null as string | null };
  }

  const { data: members, error } = await ctx.supabase
    .from("project_members")
    .select("user_id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .in("user_id", ids);
  if (error) return { error: error.message };
  const allowed = new Set((members ?? []).map((row) => row.user_id as string));
  const assigneeUserIds = ids.filter((id) => allowed.has(id));
  if (assigneeUserIds.length !== ids.length) {
    return { error: "Assignees must be project members" };
  }
  return {
    assigneeUserIds,
    assigneeUserId: assigneeUserIds[0] ?? null,
  };
}

export async function createTaskAction(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  let descriptionDoc: unknown = null;
  const descriptionDocRaw = String(formData.get("description_doc") ?? "").trim();
  if (descriptionDocRaw) {
    try {
      descriptionDoc = JSON.parse(descriptionDocRaw);
    } catch {
      return { error: "Invalid description document" };
    }
  }
  const priority = parseEnum(
    String(formData.get("priority") ?? "medium"),
    TASK_PRIORITIES,
    "medium",
  ) satisfies TaskPriority;
  const kind = parseEnum(
    String(formData.get("kind") ?? "task"),
    TASK_KINDS,
    "task",
  ) satisfies TaskKind;
  const labels = normalizeTaskLabels(formData.get("labels"));
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const milestoneId = String(formData.get("milestone_id") ?? "").trim() || null;
  const columnId = String(formData.get("column_id") ?? "").trim() || null;
  const assignee = await resolveProjectAssignees(ctx, projectId, formData);
  if ("error" in assignee && assignee.error) return { error: assignee.error };

  if (!title) return { error: "Task title is required" };

  const { data: columns } = await ctx.supabase
    .from("project_columns")
    .select("id, system_key, position")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .order("position");

  const statusHint = String(formData.get("status") ?? "").trim();
  const column =
    (columnId ? columns?.find((row) => row.id === columnId) : null) ??
    (statusHint === "todo" || statusHint === "doing" || statusHint === "done"
      ? columns?.find((row) => row.system_key === statusHint)
      : null) ??
    columns?.[0] ??
    null;
  if (!column) return { error: "Add a board column first" };

  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("position")
    .eq("organization_id", ctx.org.id)
    .eq("column_id", column.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      organization_id: ctx.org.id,
      project_id: projectId,
      milestone_id: milestoneId,
      column_id: column.id,
      title,
      description,
      description_doc: descriptionDoc,
      priority,
      kind,
      labels,
      due_on: dueOn,
      assignee_user_id: assignee.assigneeUserId,
      assignee_user_ids: assignee.assigneeUserIds,
      status: statusForColumn(
        column.system_key === "todo" || column.system_key === "doing" || column.system_key === "done"
          ? column.system_key
          : null,
      ),
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create task" };

  await recordActivity(ctx, "tasked", "project", projectId, { title });
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/board`);
  return { id: data.id as string, title, ok: true as const };
}

export async function updateTaskStatusAction(
  orgSlug: string,
  taskId: string,
  status: TaskStatus,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!TASK_STATUSES.includes(status)) return { error: "Unknown task status" };

  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  const { data: column } = await ctx.supabase
    .from("project_columns")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", task.project_id)
    .eq("system_key", status)
    .maybeSingle();

  const { data: last } = column
    ? await ctx.supabase
        .from("tasks")
        .select("position")
        .eq("organization_id", ctx.org.id)
        .eq("column_id", column.id)
        .neq("id", taskId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { error } = await ctx.supabase
    .from("tasks")
    .update({
      status,
      column_id: column?.id ?? null,
      position: (last?.position ?? -1) + 1,
    })
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${task.project_id}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function deleteTaskAction(orgSlug: string, taskId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!task) return { error: "Task not found" };

  const { error } = await ctx.supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/projects/${task.project_id}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function updateTaskAction(orgSlug: string, taskId: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Task title is required" };
  const description = String(formData.get("description") ?? "").trim() || null;
  let descriptionDoc: unknown = null;
  const descriptionDocRaw = String(formData.get("description_doc") ?? "").trim();
  if (descriptionDocRaw) {
    try {
      descriptionDoc = JSON.parse(descriptionDocRaw);
    } catch {
      return { error: "Invalid description document" };
    }
  }
  const priority = parseEnum(
    String(formData.get("priority") ?? "medium"),
    TASK_PRIORITIES,
    "medium",
  ) satisfies TaskPriority;
  const kind = parseEnum(
    String(formData.get("kind") ?? "task"),
    TASK_KINDS,
    "task",
  ) satisfies TaskKind;
  const labels = normalizeTaskLabels(formData.get("labels"));
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const milestoneId = String(formData.get("milestone_id") ?? "").trim() || null;
  const assignee = await resolveProjectAssignees(ctx, task.project_id as string, formData);
  if ("error" in assignee && assignee.error) return { error: assignee.error };

  const { error } = await ctx.supabase
    .from("tasks")
    .update({
      title,
      description,
      description_doc: descriptionDoc,
      priority,
      kind,
      labels,
      due_on: dueOn,
      milestone_id: milestoneId,
      assignee_user_id: assignee.assigneeUserId,
      assignee_user_ids: assignee.assigneeUserIds,
    })
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/projects/${task.project_id}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function moveTaskAction(
  orgSlug: string,
  taskId: string,
  columnId: string,
  orderedIds: string[],
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  const { data: column } = await ctx.supabase
    .from("project_columns")
    .select("id, project_id, system_key")
    .eq("id", columnId)
    .eq("organization_id", ctx.org.id)
    .eq("project_id", task.project_id)
    .maybeSingle();
  if (!column) return { error: "Column not found" };

  const status = statusForColumn(
    column.system_key === "todo" || column.system_key === "doing" || column.system_key === "done"
      ? column.system_key
      : null,
  );
  const ids = orderedIds.includes(taskId) ? orderedIds : [...orderedIds, taskId];

  for (const [index, id] of ids.entries()) {
    const { error } = await ctx.supabase
      .from("tasks")
      .update({ column_id: columnId, status, position: index })
      .eq("id", id)
      .eq("organization_id", ctx.org.id)
      .eq("project_id", task.project_id);
    if (error) return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/projects/${task.project_id}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function addTaskCommentAction(orgSlug: string, taskId: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a comment first" };
  let bodyDoc: unknown = null;
  const bodyDocRaw = String(formData.get("body_doc") ?? "").trim();
  if (bodyDocRaw) {
    try {
      bodyDoc = JSON.parse(bodyDocRaw);
    } catch {
      return { error: "Invalid comment document" };
    }
  }

  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  const { error } = await ctx.supabase.from("task_comments").insert({
    organization_id: ctx.org.id,
    task_id: taskId,
    body,
    body_text: body,
    body_doc: bodyDoc,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${task.project_id}`);
  return { ok: true as const };
}

export async function createColumnAction(orgSlug: string, projectId: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Column name is required" };

  const { data: last } = await ctx.supabase
    .from("project_columns")
    .select("position")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("project_columns").insert({
    organization_id: ctx.org.id,
    project_id: projectId,
    name,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function renameColumnAction(orgSlug: string, columnId: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Column name is required" };

  const { data: column, error } = await ctx.supabase
    .from("project_columns")
    .update({ name })
    .eq("id", columnId)
    .eq("organization_id", ctx.org.id)
    .select("project_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!column) return { error: "Column not found" };

  revalidatePath(`/${orgSlug}/projects/${column.project_id}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function reorderColumnsAction(
  orgSlug: string,
  projectId: string,
  orderedIds: string[],
) {
  const ctx = await requireWritableOrg(orgSlug);
  const project = await loadProjectRow(ctx, projectId);
  if (!project) return { error: "Project not found" };
  if (orderedIds.length === 0) return { error: "Nothing to reorder" };

  const { data: columns, error: listError } = await ctx.supabase
    .from("project_columns")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  if (listError) return { error: listError.message };

  const allowed = new Set((columns ?? []).map((row) => row.id as string));
  if (orderedIds.some((id) => !allowed.has(id)) || orderedIds.length !== allowed.size) {
    return { error: "Column order is out of date: refresh and try again" };
  }

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await ctx.supabase
      .from("project_columns")
      .update({ position: index })
      .eq("id", id)
      .eq("organization_id", ctx.org.id)
      .eq("project_id", projectId);
    if (error) return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}

export async function deleteColumnAction(orgSlug: string, columnId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: column } = await ctx.supabase
    .from("project_columns")
    .select("id, project_id")
    .eq("id", columnId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!column) return { error: "Column not found" };

  const { data: columns } = await ctx.supabase
    .from("project_columns")
    .select("id, position")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", column.project_id)
    .order("position");
  const fallback = (columns ?? []).find((row) => row.id !== columnId);
  if (!fallback) return { error: "Keep at least one column" };

  await ctx.supabase
    .from("tasks")
    .update({ column_id: fallback.id })
    .eq("organization_id", ctx.org.id)
    .eq("column_id", columnId);

  const { error } = await ctx.supabase
    .from("project_columns")
    .delete()
    .eq("id", columnId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/projects/${column.project_id}`);
  revalidatePath(`/${orgSlug}/board`);
  return { ok: true as const };
}
