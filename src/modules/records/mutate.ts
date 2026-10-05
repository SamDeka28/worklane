import type { JSONContent } from "@tiptap/core";
import type { OrgContext } from "@/modules/identity/org";
import { canAccessModule, canDeleteModule, canWriteModule } from "@/modules/identity/permissions";
import type { ModuleKey } from "@/modules/identity/types";
import { proseFromDoc, proseToDoc } from "@/modules/documents/prose";
import { applyStructuredFills, collectPlaceholders, documentPreviewUrl, documentWarnings, type TemplateFieldValue } from "@/modules/documents/structured";
import { getDocumentTemplate, type DocumentTemplate } from "@/modules/documents/templates";
import { invoiceLayoutSpec, INVOICE_LAYOUT_SPECS } from "@/modules/invoices/layouts";
import { INVOICE_LAYOUTS, type InvoiceLayout } from "@/modules/invoices/settings";
import { chargeFromWorkLog, hoursToMillis } from "@/modules/delivery/ledger";
import type { BillingMode } from "@/modules/delivery/types";
import {
  allocatePartnersForCharge,
  allocatePartnersForReceipt,
  voidPartnerAllocationsForCharge,
  voidPartnerAllocationsForPayment,
} from "@/modules/partners/allocate";
import { invoiceBreakdown, invoiceMoneyLabel } from "@/modules/invoices/totals";
import { asIsoCurrency, netFromGross, parseMajorToMinor } from "@/shared/money";
import { isSecretsConfigured, openSecret } from "@/shared/crypto/secrets";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

export type WriteResult =
  | { error: string }
  | ({ error?: undefined } & Record<string, unknown>);

export function isWriteError(result: WriteResult): result is { error: string } {
  return typeof result.error === "string";
}

function denied(module: string) {
  return { error: `You don't have access to change ${module} in this studio.` };
}

export function assertWrite(ctx: OrgContext, module: ModuleKey | null): { error: string } | null {
  if (!ctx.canWrite) return { error: "You do not have permission to change this studio." };
  if (module && (!ctx.org.modules[module] || !canWriteModule(ctx.permissions, module))) return denied(module);
  return null;
}

function assertDelete(ctx: OrgContext, module: "delivery" | "crm" | "partners") {
  const write = assertWrite(ctx, module);
  if (write) return write;
  if (!canDeleteModule({ role: ctx.role, permissions: ctx.permissions }, module)) {
    return { error: `You don't have permission to delete ${module} records.` };
  }
  return null;
}

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function moneyMinor(raw: unknown, currency: string) {
  try {
    return parseMajorToMinor(textOf(raw), asIsoCurrency(currency));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount" };
  }
}

export async function createClientRecord(
  ctx: OrgContext,
  input: {
    name: string;
    kind?: string;
    notes?: string | null;
    currency?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, null);
  if (blocked) return blocked;
  const name = input.name.trim();
  if (!name) return { error: "Client name is required" };
  const currency = (input.currency || ctx.org.defaultCurrency).trim().toUpperCase();
  if (asIsoCurrency(currency) !== currency) return { error: "Pick a supported currency" };
  const kind = input.kind === "person" ? "person" : "company";
  const { data: client, error } = await ctx.supabase
    .from("clients")
    .insert({
      organization_id: ctx.org.id,
      kind,
      name,
      notes: input.notes?.trim() || null,
      currency,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !client) return { error: error?.message ?? "Could not create client" };
  if (input.contactName || input.email || input.phone) {
    const { error: contactError } = await ctx.supabase.from("contacts").insert({
      organization_id: ctx.org.id,
      client_id: client.id,
      name: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      is_primary: true,
    });
    if (contactError) return { error: contactError.message };
  }
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "client",
    entity_id: client.id,
    metadata: { name },
  });
  return { id: client.id as string, name };
}

export async function updateClientRecord(
  ctx: OrgContext,
  clientId: string,
  input: { name?: string; notes?: string | null; kind?: string; currency?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, null);
  if (blocked) return blocked;
  const patch: Record<string, unknown> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.kind) patch.kind = input.kind === "person" ? "person" : "company";
  if (input.currency) {
    const currency = input.currency.trim().toUpperCase();
    if (asIsoCurrency(currency) !== currency) return { error: "Pick a supported currency" };
    patch.currency = currency;
  }
  if (Object.keys(patch).length === 0) return { error: "Nothing to update" };
  const { error } = await ctx.supabase
    .from("clients")
    .update(patch)
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: clientId, updated: true };
}

export async function addContactRecord(
  ctx: OrgContext,
  clientId: string,
  input: { name?: string; email?: string; phone?: string; primary?: boolean },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, null);
  if (blocked) return blocked;
  const { data, error } = await ctx.supabase
    .from("contacts")
    .insert({
      organization_id: ctx.org.id,
      client_id: clientId,
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      is_primary: Boolean(input.primary),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add contact" };
  return { id: data.id as string };
}

export async function archiveClientRecord(ctx: OrgContext, clientId: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, null);
  if (blocked) return blocked;
  const { error } = await ctx.supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: clientId, archived: true };
}

export async function deleteClientRecord(ctx: OrgContext, clientId: string, confirmName: string): Promise<WriteResult> {
  const blocked = assertDelete(ctx, "crm");
  if (blocked) return blocked;
  const { data } = await ctx.supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!data) return { error: "Client not found" };
  if (textOf(data.name) !== confirmName.trim()) return { error: "Type the client name to confirm deletion." };
  const { error } = await ctx.supabase.from("clients").delete().eq("id", clientId).eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: clientId, deleted: true };
}

export async function createProjectRecord(
  ctx: OrgContext,
  input: { name: string; clientId: string; billingMode?: string; status?: string; scope?: string; contractedAmount?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "delivery");
  if (blocked) return blocked;
  const name = input.name.trim();
  if (!name || !input.clientId) return { error: "Project name and client are required" };
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, currency")
    .eq("id", input.clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  let contracted: string | null = null;
  if (input.contractedAmount?.trim()) {
    const minor = moneyMinor(input.contractedAmount, String(client.currency));
    if (typeof minor !== "bigint") return minor;
    contracted = minor.toString();
  }
  const id = crypto.randomUUID();
  const { error } = await ctx.supabase.from("projects").insert({
    id,
    organization_id: ctx.org.id,
    client_id: input.clientId,
    name,
    status: input.status || "active",
    billing_mode: input.billingMode || "hourly",
    scope: input.scope?.trim() || null,
    contracted_amount_minor: contracted,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  await ctx.supabase.from("project_members").upsert({
    organization_id: ctx.org.id,
    project_id: id,
    user_id: ctx.userId,
    role: "lead",
  });
  return { id, name };
}

export async function setProjectStatusRecord(ctx: OrgContext, projectId: string, status: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "delivery");
  if (blocked) return blocked;
  const allowed = ["planning", "active", "on_hold", "completed", "cancelled"];
  if (!allowed.includes(status)) return { error: "Unknown project status." };
  const { error } = await ctx.supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: projectId, status };
}

export async function deleteProjectRecord(ctx: OrgContext, projectId: string, confirmName: string): Promise<WriteResult> {
  const blocked = assertDelete(ctx, "delivery");
  if (blocked) return blocked;
  const { data } = await ctx.supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!data) return { error: "Project not found" };
  if (textOf(data.name) !== confirmName.trim()) return { error: "Type the project name to confirm deletion." };
  const { error } = await ctx.supabase.from("projects").delete().eq("id", projectId).eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: projectId, deleted: true };
}

export async function createTaskRecord(
  ctx: OrgContext,
  input: { projectId: string; title: string; description?: string; status?: string; dueOn?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "delivery");
  if (blocked) return blocked;
  const title = input.title.trim();
  if (!title || !input.projectId) return { error: "Task title and project are required" };
  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      organization_id: ctx.org.id,
      project_id: input.projectId,
      title,
      description: input.description?.trim() || null,
      status: input.status || "todo",
      due_on: input.dueOn || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create task" };
  return { id: data.id as string };
}

export async function updateTaskRecord(
  ctx: OrgContext,
  taskId: string,
  input: { title?: string; description?: string; status?: string; dueOn?: string | null },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "delivery");
  if (blocked) return blocked;
  const patch: Record<string, unknown> = {};
  if (input.title?.trim()) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.status) patch.status = input.status;
  if (input.dueOn !== undefined) patch.due_on = input.dueOn;
  const { error } = await ctx.supabase.from("tasks").update(patch).eq("id", taskId).eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: taskId, updated: true };
}

export async function deleteTaskRecord(ctx: OrgContext, taskId: string): Promise<WriteResult> {
  const blocked = assertDelete(ctx, "delivery");
  if (blocked) return blocked;
  const { error } = await ctx.supabase.from("tasks").delete().eq("id", taskId).eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: taskId, deleted: true };
}

export async function commentOnTaskRecord(ctx: OrgContext, taskId: string, body: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "delivery");
  if (blocked) return blocked;
  const text = body.trim();
  if (!text) return { error: "Comment is empty" };
  const { data, error } = await ctx.supabase
    .from("task_comments")
    .insert({ organization_id: ctx.org.id, task_id: taskId, body: text, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not comment" };
  return { id: data.id as string };
}

export async function createWorkLogRecord(
  ctx: OrgContext,
  input: {
    projectId: string;
    workedOn?: string;
    hours?: string | number | null;
    hoursMillis?: number | null;
    description?: string | null;
    milestoneId?: string | null;
    taskId?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    hourlyRateMinor?: bigint | null;
    fixedMinor?: bigint | null;
    clearTaskClock?: boolean;
  },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "delivery");
  if (blocked) return blocked;
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, name, client_id, billing_mode, hourly_rate_minor, default_fee_bps, earn_on")
    .eq("id", input.projectId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!project) return { error: "Project not found" };
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("currency")
    .eq("id", project.client_id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  const currency = asIsoCurrency(String(client.currency), ctx.org.defaultCurrency);
  const hours = input.hours == null || input.hours === "" ? null : Number(input.hours);
  if (hours != null && (!Number.isFinite(hours) || hours <= 0)) return { error: "Enter hours greater than zero" };
  const hoursMillis = input.hoursMillis ?? (hours == null ? null : hoursToMillis(hours));
  const hourlyRateMinor =
    input.hourlyRateMinor ??
    (hours != null && input.fixedMinor == null && project.hourly_rate_minor != null
      ? BigInt(project.hourly_rate_minor as string)
      : null);
  let posted: { postsCharge: boolean; gross: bigint; net: bigint };
  try {
    posted = chargeFromWorkLog({
      billingMode: project.billing_mode as BillingMode,
      hours,
      hourlyRateMinor,
      fixedMinor: input.fixedMinor ?? null,
      feeBps: Number(project.default_fee_bps ?? 0),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not price this log" };
  }
  const workedOn = input.workedOn || new Date().toISOString().slice(0, 10);
  const description = input.description?.trim() || null;
  const { data: log, error } = await ctx.supabase
    .from("work_logs")
    .insert({
      organization_id: ctx.org.id,
      project_id: input.projectId,
      milestone_id: input.milestoneId || null,
      worked_on: workedOn,
      hours_millis: hoursMillis,
      hourly_rate_minor: hourlyRateMinor?.toString() ?? null,
      fixed_minor: input.fixedMinor?.toString() ?? null,
      description,
      task_id: input.taskId || null,
      started_at: input.startedAt ?? null,
      ended_at: input.endedAt ?? null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !log) return { error: error?.message ?? "Could not save work log" };
  if (input.clearTaskClock && input.taskId) {
    await ctx.supabase
      .from("tasks")
      .update({ time_started_at: null, time_stopped_at: null })
      .eq("id", input.taskId)
      .eq("organization_id", ctx.org.id);
  }
  if (posted.postsCharge) {
    const memo = description ?? (hours ? `${hours}h on ${project.name}` : `Work on ${project.name}`);
    const { data: charge, error: chargeError } = await ctx.supabase
      .from("charges")
      .insert({
        organization_id: ctx.org.id,
        client_id: project.client_id,
        project_id: input.projectId,
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
    if (chargeError || !charge) return { error: chargeError?.message ?? "Logged, but the charge could not be posted" };
    await ctx.supabase.from("work_logs").update({ charge_id: charge.id }).eq("id", log.id).eq("organization_id", ctx.org.id);
    try {
      await allocatePartnersForCharge(ctx, {
        chargeId: charge.id as string,
        projectId: input.projectId,
        netMinor: posted.net,
        currency,
        earnedOn: workedOn,
        earnOn: project.earn_on === "receipt" ? "receipt" : "charge",
      });
    } catch (allocError) {
      return { error: allocError instanceof Error ? allocError.message : "Logged, but partner earnings failed" };
    }
  }
  return { id: log.id as string, charged: posted.postsCharge };
}

export async function createChargeRecord(
  ctx: OrgContext,
  input: { clientId: string; gross: string; memo?: string; chargedOn?: string; dueOn?: string; feeBps?: number; projectId?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "finance");
  if (blocked) return blocked;
  if (!input.clientId) return { error: "Choose a client" };
  const feeBps = input.feeBps ?? 0;
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    return { error: "Fee must be between 0 and 10000 bps" };
  }
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, currency")
    .eq("id", input.clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  const currency = asIsoCurrency(String(client.currency), ctx.org.defaultCurrency);
  const minor = moneyMinor(input.gross, currency);
  if (typeof minor !== "bigint") return minor;
  if (minor <= BigInt(0)) return { error: "Charge amount must be greater than zero" };
  const { data, error } = await ctx.supabase
    .from("charges")
    .insert({
      organization_id: ctx.org.id,
      client_id: input.clientId,
      project_id: input.projectId || null,
      gross_minor: minor.toString(),
      fee_bps: feeBps,
      net_minor: netFromGross(minor, feeBps).toString(),
      currency,
      charged_on: input.chargedOn || new Date().toISOString().slice(0, 10),
      due_on: input.dueOn || null,
      source: "manual",
      status: "open",
      memo: input.memo?.trim() || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create charge" };
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "charged",
    entity_type: "client",
    entity_id: input.clientId,
    metadata: { charge_id: data.id, gross_minor: minor.toString(), fee_bps: feeBps },
  });
  return { id: data.id as string };
}

export async function recordPaymentRecord(
  ctx: OrgContext,
  input: { clientId: string; amount: string; paidOn?: string; method?: string; reference?: string; kind?: string; chargeId?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "finance");
  if (blocked) return blocked;
  if (!input.clientId) return { error: "Choose a client" };
  const method = input.method || "other";
  if (!["upwork", "bank", "stripe", "other"].includes(method)) return { error: "Unknown payment method" };
  const kind = input.kind === "refund" ? "refund" : "receipt";
  const paidOn = input.paidOn || new Date().toISOString().slice(0, 10);
  const reference = input.reference?.trim() || null;
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, name, currency")
    .eq("id", input.clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  const currency = asIsoCurrency(String(client.currency), ctx.org.defaultCurrency);
  const minor = moneyMinor(input.amount, currency);
  if (typeof minor !== "bigint") return minor;
  if (minor <= BigInt(0)) return { error: "Amount must be greater than zero" };

  if (kind === "refund") {
    const { data: payment, error } = await ctx.supabase
      .from("payments")
      .insert({
        organization_id: ctx.org.id,
        client_id: input.clientId,
        amount_minor: minor.toString(),
        currency,
        paid_on: paidOn,
        method,
        reference,
        kind: "refund",
        status: "posted",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !payment) return { error: error?.message ?? "Could not record refund" };
    await ctx.supabase.from("activities").insert({
      organization_id: ctx.org.id,
      actor_id: ctx.userId,
      verb: "refunded",
      entity_type: "client",
      entity_id: input.clientId,
      metadata: { payment_id: payment.id, amount_minor: minor.toString() },
    });
    return { id: payment.id as string, kind: "refund" };
  }

  const { data, error } = await ctx.supabase.rpc("post_client_receipt", {
    p_org_id: ctx.org.id,
    p_client_id: input.clientId,
    p_amount_minor: minor.toString(),
    p_currency: currency,
    p_paid_on: paidOn,
    p_method: method,
    p_reference: reference,
    p_charge_id: input.chargeId || null,
  });
  if (error) return { error: error.message };
  const posted = (Array.isArray(data) ? data[0] : data) as { payment_id?: string; unallocated_minor?: string } | null;
  const paymentId = posted?.payment_id;
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "paid",
    entity_type: "client",
    entity_id: input.clientId,
    metadata: {
      payment_id: paymentId,
      amount_minor: minor.toString(),
      unallocated_minor: posted?.unallocated_minor ?? "0",
      charge_id: input.chargeId || null,
    },
  });
  if (paymentId) {
    const { data: allocations } = await ctx.supabase
      .from("payment_allocations")
      .select("id, charge_id, amount_minor")
      .eq("payment_id", paymentId)
      .eq("organization_id", ctx.org.id);
    try {
      await allocatePartnersForReceipt(ctx, {
        paymentId,
        paidOn,
        allocations: (allocations ?? []).map((row) => ({
          id: row.id as string,
          chargeId: row.charge_id as string,
          amountMinor: BigInt(row.amount_minor as string),
        })),
      });
    } catch (allocError) {
      return { error: allocError instanceof Error ? allocError.message : "Collected, but partner earnings failed" };
    }
  }
  return { id: paymentId, unallocatedMinor: String(posted?.unallocated_minor ?? "0"), kind: "receipt" };
}

export async function voidChargeRecord(ctx: OrgContext, chargeId: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "finance");
  if (blocked) return blocked;
  const { data: charge } = await ctx.supabase
    .from("charges")
    .select("id, client_id, status")
    .eq("id", chargeId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!charge) return { error: "Charge not found" };
  const { count } = await ctx.supabase
    .from("payment_allocations")
    .select("id", { count: "exact", head: true })
    .eq("charge_id", chargeId);
  if ((count ?? 0) > 0) return { error: "Cancel is blocked while a receipt is applied to this charge" };
  const partnerVoid = await voidPartnerAllocationsForCharge(ctx, chargeId);
  if (partnerVoid.error) return { error: partnerVoid.error };
  const { error } = await ctx.supabase.from("charges").update({ status: "void" }).eq("id", chargeId).eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "voided",
    entity_type: "charge",
    entity_id: charge.client_id,
    metadata: { charge_id: chargeId },
  });
  return { id: chargeId, voided: true };
}

export async function voidPaymentRecord(ctx: OrgContext, paymentId: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "finance");
  if (blocked) return blocked;
  const { data: payment } = await ctx.supabase
    .from("payments")
    .select("id, client_id")
    .eq("id", paymentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!payment) return { error: "Payment not found" };
  const partnerVoid = await voidPartnerAllocationsForPayment(ctx, paymentId);
  if (partnerVoid.error) return { error: partnerVoid.error };
  const { error } = await ctx.supabase.from("payments").update({ status: "void" }).eq("id", paymentId).eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "voided",
    entity_type: "payment",
    entity_id: payment.client_id,
    metadata: { payment_id: paymentId },
  });
  return { id: paymentId, voided: true };
}

export async function createLeadRecord(
  ctx: OrgContext,
  input: { name: string; company?: string; email?: string; stage?: string; notes?: string; estimatedValue?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "crm");
  if (blocked) return blocked;
  const name = input.name.trim();
  if (!name) return { error: "Lead name is required" };
  const currency = ctx.org.defaultCurrency;
  let estimated: string | null = null;
  if (input.estimatedValue?.trim()) {
    const minor = moneyMinor(input.estimatedValue, currency);
    if (typeof minor !== "bigint") return minor;
    estimated = minor.toString();
  }
  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      organization_id: ctx.org.id,
      name,
      company: input.company?.trim() || null,
      email: input.email?.trim() || null,
      stage: input.stage?.trim() || "new",
      notes: input.notes?.trim() || null,
      estimated_value_minor: estimated,
      currency,
      owner_user_id: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create lead" };
  return { id: data.id as string };
}

export async function moveLeadRecord(ctx: OrgContext, leadId: string, stage: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "crm");
  if (blocked) return blocked;
  const { error } = await ctx.supabase
    .from("leads")
    .update({ stage })
    .eq("id", leadId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  return { id: leadId, stage };
}

export async function updateClientBillingRecord(
  ctx: OrgContext,
  clientId: string,
  billing: Record<string, unknown> | null,
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, null);
  if (blocked) return blocked;
  const { data: client, error } = await ctx.supabase
    .from("clients")
    .update({ billing })
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .select("name")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!client) return { error: "Client not found" };
  let draftsUpdated = 0;
  if (billing) {
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
  return { id: clientId, name: client.name, draftsUpdated };
}

export async function createPartnerRecord(
  ctx: OrgContext,
  input: { name: string; email: string; kind?: string; notes?: string | null; notesDoc?: unknown },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "partners");
  if (blocked) return blocked;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Partner name is required" };
  if (!email || !email.includes("@")) return { error: "Enter a valid email" };
  const kind = input.kind === "originator" || input.kind === "referral" ? input.kind : "participant";
  const { data, error } = await ctx.supabase
    .from("partners")
    .insert({
      organization_id: ctx.org.id,
      name,
      email,
      kind,
      notes: input.notes?.trim() || null,
      notes_doc: input.notesDoc ?? null,
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message?.includes("partners_org_email_uidx")) return { error: "A partner with that email already exists" };
    return { error: error?.message ?? "Could not create partner" };
  }
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "partner",
    entity_id: data.id,
    metadata: { name, kind, email },
  });
  return { id: data.id as string, name, email, kind };
}

export async function logLeadNoteRecord(ctx: OrgContext, leadId: string, body: string, kind = "note"): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "crm");
  if (blocked) return blocked;
  const text = body.trim();
  if (!text) return { error: "Write the note first" };
  const { data, error } = await ctx.supabase
    .from("lead_activities")
    .insert({
      organization_id: ctx.org.id,
      lead_id: leadId,
      kind,
      body: text,
      actor_id: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not log the note" };
  return { id: data.id as string };
}

async function clientMention(ctx: OrgContext, id: string | null) {
  if (!id) return null;
  const { data } = await ctx.supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!data?.name) return null;
  return { id: data.id as string, label: data.name as string, type: "client" as const };
}

async function projectMention(ctx: OrgContext, id: string | null) {
  if (!id) return null;
  const { data } = await ctx.supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!data?.name) return null;
  return {
    id: data.id as string,
    label: data.name as string,
    type: "project" as const,
    clientId: (data.client_id as string | null) ?? null,
  };
}

function templateForKind(kind: string): DocumentTemplate | null {
  const normalized = kind === "msa" ? "contract" : kind;
  return (
    getDocumentTemplate(
      normalized === "contract" ? "msa" : normalized === "report" ? "status_report" : normalized,
    ) ?? null
  );
}

export async function createDocumentRecord(
  ctx: OrgContext,
  input: {
    title: string;
    templateId?: string;
    kind?: string;
    clientId?: string;
    projectId?: string;
    /** Plain text kept for older callers. Ignored when a template, kind, or field data is set. */
    body?: string;
    data?: Record<string, TemplateFieldValue>;
  },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "documents");
  if (blocked) return blocked;
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };
  if (input.templateId && !getDocumentTemplate(input.templateId)) {
    return { error: "That document template does not exist." };
  }
  if (input.kind && !input.templateId && !templateForKind(input.kind)) {
    return { error: "That document kind does not have a template." };
  }
  const supplied = input.body?.trim() ?? "";
  const hasFields = Boolean(input.data && Object.keys(input.data).length > 0);
  const structured = Boolean(input.templateId || input.kind || hasFields);
  const template =
    (input.templateId ? getDocumentTemplate(input.templateId) : null) ??
    (input.kind ? templateForKind(input.kind) : null) ??
    (structured || !supplied ? getDocumentTemplate("proposal") : null);
  let content: JSONContent;
  let templateId = "custom";
  let clientId = input.clientId || null;
  const projectId = input.projectId || null;
  if (!structured && supplied) {
    content = proseToDoc(supplied);
  } else if (template) {
    const project = await projectMention(ctx, projectId);
    if (!clientId && project?.clientId) clientId = project.clientId;
    const client = await clientMention(ctx, clientId);
    content = template.build({
      title,
      orgName: ctx.org.name,
      client,
      project: project ? { id: project.id, label: project.label, type: "project" } : null,
    });
    if (hasFields && input.data) content = applyStructuredFills(content, input.data);
    templateId = template.id;
  } else {
    return { error: "That document template does not exist." };
  }
  const { data: document, error } = await ctx.supabase
    .from("documents")
    .insert({
      organization_id: ctx.org.id,
      kind: template?.kind ?? "proposal",
      title,
      status: "draft",
      client_id: clientId,
      project_id: projectId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !document) return { error: error?.message ?? "Could not create document" };
  const { error: versionError } = await ctx.supabase.from("document_versions").insert({
    organization_id: ctx.org.id,
    document_id: document.id,
    version_number: 1,
    content_doc: content,
    status: "draft",
    created_by: ctx.userId,
  });
  if (versionError) return { error: versionError.message };
  const previewUrl = documentPreviewUrl(ctx.org.slug, document.id as string, 1);
  return {
    id: document.id as string,
    title,
    template: templateId,
    version: 1,
    status: "draft",
    previewUrl,
    pdfUrl: previewUrl,
    validation: documentWarnings(content, {
      title,
      clientId,
      projectId,
    }),
    text: proseFromDoc(content),
  };
}

export function previewDocumentText(input: { title: string; templateId?: string; orgName: string }) {
  const template = getDocumentTemplate(input.templateId || "proposal");
  if (!template) return { error: "Unknown document template." };
  const content = template.build({ title: input.title || template.name, orgName: input.orgName });
  return {
    template: template.id,
    name: template.name,
    kind: template.kind,
    description: template.description,
    outline: template.outline,
    fields: collectPlaceholders(content),
    text: textFromContent(content),
  };
}

export async function previewInvoiceRecord(
  ctx: OrgContext,
  input: { id?: string; layout?: string; lines?: { description: string; amount: string }[]; currency?: string },
) {
  const base = previewInvoiceText(input);
  if (!input.id) return base;
  if (!canAccessModule(ctx.permissions, "finance")) return { error: "You don't have access to invoices in this studio." };
  const [{ data: invoice }, { data: lines }, { data: org }] = await Promise.all([
    ctx.supabase
      .from("invoices")
      .select("id, number, currency, bill_to, memo, status")
      .eq("id", input.id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
    ctx.supabase
      .from("invoice_lines")
      .select("description, quantity, unit_amount_minor, tax_bps, discount_minor")
      .eq("invoice_id", input.id)
      .eq("organization_id", ctx.org.id)
      .order("position"),
    ctx.supabase.from("organizations").select("name, settings").eq("id", ctx.org.id).maybeSingle(),
  ]);
  if (!invoice) return { error: "Invoice not found" };
  const currency = asIsoCurrency(String(invoice.currency), ctx.org.defaultCurrency);
  const priced = (lines ?? []).map((line) => ({
    description: String(line.description ?? ""),
    quantity: Number(line.quantity ?? 1),
    unitAmountMinor: BigInt(line.unit_amount_minor ?? 0),
    taxBps: Number(line.tax_bps ?? 0),
    discountMinor: BigInt(line.discount_minor ?? 0),
  }));
  const totals = invoiceBreakdown(priced);
  const settings = (org?.settings ?? {}) as { invoice?: { business?: { legalName?: string; email?: string } } };
  return {
    ...base,
    currency,
    from: settings.invoice?.business?.legalName || (org?.name as string | undefined) || ctx.org.name,
    billTo: invoice.bill_to ?? null,
    memo: invoice.memo ?? null,
    number: invoice.number ?? null,
    status: invoice.status,
    lines: priced.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      amount: invoiceMoneyLabel(line.unitAmountMinor, currency),
    })),
    tax: invoiceMoneyLabel(totals.taxMinor, currency),
    total: invoiceMoneyLabel(totals.totalMinor, currency),
  };
}

export function previewInvoiceText(input: { layout?: string; lines?: { description: string; amount: string }[]; currency?: string }) {
  const layout = (INVOICE_LAYOUTS as readonly string[]).includes(input.layout ?? "")
    ? (input.layout as InvoiceLayout)
    : "classic";
  const spec = invoiceLayoutSpec(layout);
  return {
    layout,
    label: spec.label,
    description: spec.description,
    layouts: INVOICE_LAYOUTS.map((name) => ({
      name,
      label: INVOICE_LAYOUT_SPECS[name].label,
      description: INVOICE_LAYOUT_SPECS[name].description,
    })),
    lines: input.lines ?? [],
    currency: input.currency ?? null,
    note: "The numbers are the same in every layout. This is the content, not a picture of the page.",
  };
}

export async function revealCredentialRecord(ctx: OrgContext, credentialId: string): Promise<WriteResult> {
  if (!canAccessModule(ctx.permissions, "delivery")) return { error: "You don't have access to the credential vault." };
  if (!isSecretsConfigured()) return { error: "Credential vault isn't configured." };
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "Credential vault isn't configured." };
  const { data: row } = await ctx.supabase
    .from("project_credentials")
    .select("id, name, project_id")
    .eq("id", credentialId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!row) return { error: "Credential not found" };
  const { data, error } = await admin
    .from("project_credential_secrets")
    .select("key_version, iv, auth_tag, ciphertext")
    .eq("credential_id", row.id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (error || !data) return { error: "Credential details are missing" };
  try {
    const plaintext = openSecret(
      {
        keyVersion: data.key_version as number,
        iv: data.iv as string,
        authTag: data.auth_tag as string,
        ciphertext: data.ciphertext as string,
      },
      `project_credential:${ctx.org.id}:${row.id}`,
    );
    return { id: row.id, name: row.name, secret: JSON.parse(plaintext) };
  } catch {
    return { error: "Couldn't decrypt this credential" };
  }
}

export async function renameStudioRecord(ctx: OrgContext, name: string): Promise<WriteResult> {
  if (ctx.role !== "owner" && ctx.role !== "admin") return { error: "Only an owner or admin can rename the studio." };
  const next = name.trim();
  if (!next) return { error: "Studio name is required" };
  const { error } = await ctx.supabase.from("organizations").update({ name: next }).eq("id", ctx.org.id);
  if (error) return { error: error.message };
  return { name: next };
}

function textFromContent(value: unknown) {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as { text?: unknown; content?: unknown };
    if (typeof record.text === "string" && record.text.trim()) parts.push(record.text.trim());
    if (Array.isArray(record.content)) record.content.forEach(walk);
  };
  walk(value);
  return parts.join("\n");
}
