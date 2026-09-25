"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, requireWritableOrg } from "@/modules/identity/org";
import { notifyOwners } from "@/modules/notifications/service";
import { allocatePartnersForReceipt } from "@/modules/partners/allocate";
import {
  brandToSnapshot,
  loadOrgInvoiceConfig,
  resolveInvoiceBrand,
} from "@/modules/invoices/config";
import { getInvoice, listInvoicePayments } from "@/modules/invoices/queries";
import { invoicePaidMinor, renderInvoicePdf } from "@/modules/invoices/render";
import {
  dueOnFromDays,
  parseInvoiceBusiness,
  parseOrgInvoiceSettings,
  plainToDoc,
  type OrgInvoiceSettings,
} from "@/modules/invoices/settings";
import { getInvoiceTemplate } from "@/modules/invoices/templates";
import {
  EMPTY_BILL_TO,
  INVOICE_PAYMENT_METHODS,
  extraFieldsFromForm,
  parseBillTo,
  type InvoiceBillTo,
} from "@/modules/invoices/types";
import {
  formatInvoiceNumber,
  invoiceMoneyLabel,
  invoiceSubtotalMinor,
  lineTotalMinor,
} from "@/modules/invoices/totals";
import { netFromGross, parseMajorToMinor, type IsoCurrency } from "@/shared/money";

function asCurrency(value: string, fallback: IsoCurrency): IsoCurrency {
  return value === "INR" || value === "USD" ? value : fallback;
}

function field(formData: FormData, key: string, max = 500): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function billToFromForm(formData: FormData): InvoiceBillTo {
  return {
    name: field(formData, "bill_to_name", 200),
    contactName: field(formData, "bill_to_contact", 200),
    email: field(formData, "bill_to_email", 200),
    phone: field(formData, "bill_to_phone", 60),
    address: field(formData, "bill_to_address", 500),
    taxId: field(formData, "bill_to_tax_id", 80),
    extras: extraFieldsFromForm(formData, "bill_to_extra"),
  };
}

async function defaultBillTo(
  supabase: Awaited<ReturnType<typeof requireWritableOrg>>["supabase"],
  orgId: string,
  client: { id: string; name: string; billing?: unknown },
): Promise<InvoiceBillTo> {
  const saved = parseBillTo(client.billing);
  if (saved?.name) return { ...EMPTY_BILL_TO, ...saved };

  const [{ data: contact }, { data: previous }] = await Promise.all([
    supabase
      .from("contacts")
      .select("name, email, phone")
      .eq("organization_id", orgId)
      .eq("client_id", client.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("bill_to")
      .eq("organization_id", orgId)
      .eq("client_id", client.id)
      .not("bill_to", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const last = parseBillTo(previous?.bill_to);
  return {
    ...EMPTY_BILL_TO,
    ...(last ?? {}),
    name: last?.name || client.name,
    contactName: last?.contactName || (contact?.name as string | undefined) || "",
    email: last?.email || (contact?.email as string | undefined) || "",
    phone: last?.phone || (contact?.phone as string | undefined) || "",
  };
}

function parseDoc(formData: FormData, key: string): Record<string, unknown> | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function createDraftInvoiceAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.finance) return { error: "Finance is disabled" };

  const clientId = String(formData.get("client_id") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  if (!clientId) return { error: "Choose a client" };

  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, name, currency, billing")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };

  const config = await loadOrgInvoiceConfig(orgSlug);
  const templateId = String(formData.get("template_id") ?? "").trim() || null;
  const template = templateId ? await getInvoiceTemplate(orgSlug, templateId) : null;

  const currency = asCurrency(client.currency, ctx.org.defaultCurrency);
  const draftNumber = `DRAFT-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;

  const dueDays = template?.defaultDueDays ?? config.defaultDueDays;
  const dueOn =
    String(formData.get("due_on") ?? "").trim() ||
    (dueDays > 0 ? dueOnFromDays(dueDays) : null);

  const termsFromForm = String(formData.get("terms") ?? "").trim();
  const memoFromForm = String(formData.get("memo") ?? "").trim();
  const terms = termsFromForm || template?.terms || config.defaultTerms || null;
  const memo = memoFromForm || template?.memo || config.defaultMemo || null;
  const termsDoc =
    parseDoc(formData, "terms_doc") || template?.termsDoc || plainToDoc(terms ?? "") || null;
  const memoDoc =
    parseDoc(formData, "memo_doc") || template?.memoDoc || plainToDoc(memo ?? "") || null;

  const billTo = await defaultBillTo(ctx.supabase, ctx.org.id, {
    id: client.id as string,
    name: client.name as string,
    billing: client.billing,
  });

  const { data: invoice, error } = await ctx.supabase
    .from("invoices")
    .insert({
      organization_id: ctx.org.id,
      client_id: clientId,
      project_id: projectId,
      number: draftNumber,
      status: "draft",
      currency,
      due_on: dueOn,
      terms,
      terms_doc: termsDoc,
      memo,
      memo_doc: memoDoc,
      template_id: template?.id ?? null,
      bill_to: billTo,
      reference: field(formData, "reference", 120) || null,
      payment_instructions: config.defaultPaymentInstructions.trim() || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !invoice) return { error: error?.message ?? "Could not create invoice" };

  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("unit_amount") ?? "").trim();

  if (description && amountRaw) {
    let unitAmountMinor: bigint;
    try {
      unitAmountMinor = parseMajorToMinor(amountRaw, currency);
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Invalid amount",
        id: invoice.id as string,
      };
    }
    const taxBps =
      Number(formData.get("tax_bps") ?? template?.defaultTaxBps ?? config.defaultTaxBps) || 0;
    await ctx.supabase.from("invoice_lines").insert({
      organization_id: ctx.org.id,
      invoice_id: invoice.id,
      description,
      quantity: Number(formData.get("quantity") ?? 1) || 1,
      unit_amount_minor: unitAmountMinor.toString(),
      tax_bps: taxBps,
      discount_minor: "0",
      position: 0,
    });
  } else if (template?.starterLines.length) {
    await ctx.supabase.from("invoice_lines").insert(
      template.starterLines.map((line, index) => ({
        organization_id: ctx.org.id,
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity || 1,
        unit_amount_minor: line.unitAmountMinor || "0",
        tax_bps: line.taxBps || template.defaultTaxBps || config.defaultTaxBps || 0,
        discount_minor: "0",
        position: index,
      })),
    );
  }

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: { number: draftNumber },
  });
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "finance",
    title: (actor) => `${actor} started an invoice for ${client.name as string}`,
    body: dueOn ? `Draft · due ${dueOn}` : "Draft invoice",
    href: `/${orgSlug}/invoices/${invoice.id}`,
    entity: { type: "invoice", id: invoice.id as string },
    actionLabel: "Open invoice",
  });

  revalidatePath(`/${orgSlug}/invoices`);
  revalidatePath(`/${orgSlug}/finance`);
  return { id: invoice.id as string };
}

export async function addInvoiceLineAction(
  orgSlug: string,
  invoiceId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: invoice } = await ctx.supabase
    .from("invoices")
    .select("id, status, currency, issued_at")
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issued_at) {
    return { error: "Only draft invoices can be edited" };
  }

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Description is required" };

  const currency = asCurrency(String(invoice.currency), ctx.org.defaultCurrency);
  let unitAmountMinor: bigint;
  try {
    unitAmountMinor = parseMajorToMinor(String(formData.get("unit_amount") ?? ""), currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid amount" };
  }

  const config = await loadOrgInvoiceConfig(orgSlug);
  const taxBps = Number(formData.get("tax_bps") ?? config.defaultTaxBps);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10_000) {
    return { error: "Tax must be 0–10000 bps" };
  }

  let discountMinor = BigInt(0);
  const discountRaw = String(formData.get("discount") ?? "").trim();
  if (discountRaw) {
    try {
      discountMinor = parseMajorToMinor(discountRaw, currency);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid discount" };
    }
  }

  const { data: last } = await ctx.supabase
    .from("invoice_lines")
    .select("position")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("invoice_lines").insert({
    organization_id: ctx.org.id,
    invoice_id: invoiceId,
    description,
    quantity: Number(formData.get("quantity") ?? 1) || 1,
    unit_amount_minor: unitAmountMinor.toString(),
    tax_bps: taxBps,
    discount_minor: discountMinor.toString(),
    milestone_id: String(formData.get("milestone_id") ?? "").trim() || null,
    work_log_id: String(formData.get("work_log_id") ?? "").trim() || null,
    position: (last?.position ?? -1) + 1,
  });

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const };
}

export async function updateInvoiceLineAction(
  orgSlug: string,
  invoiceId: string,
  lineId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: invoice } = await ctx.supabase
    .from("invoices")
    .select("id, status, currency, issued_at")
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issued_at) {
    return { error: "Only draft invoices can be edited" };
  }

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Description is required" };

  const currency = asCurrency(String(invoice.currency), ctx.org.defaultCurrency);
  let unitAmountMinor: bigint;
  try {
    unitAmountMinor = parseMajorToMinor(String(formData.get("unit_amount") ?? ""), currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid amount" };
  }

  const taxBps = Number(formData.get("tax_bps") ?? 0);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10_000) {
    return { error: "Tax must be 0–10000 bps" };
  }

  let discountMinor = BigInt(0);
  const discountRaw = String(formData.get("discount") ?? "").trim();
  if (discountRaw) {
    try {
      discountMinor = parseMajorToMinor(discountRaw, currency);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid discount" };
    }
  }

  const { error } = await ctx.supabase
    .from("invoice_lines")
    .update({
      description,
      quantity: Number(formData.get("quantity") ?? 1) || 1,
      unit_amount_minor: unitAmountMinor.toString(),
      tax_bps: taxBps,
      discount_minor: discountMinor.toString(),
    })
    .eq("id", lineId)
    .eq("invoice_id", invoiceId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const };
}

export async function deleteInvoiceLineAction(
  orgSlug: string,
  invoiceId: string,
  lineId: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: invoice } = await ctx.supabase
    .from("invoices")
    .select("id, status, issued_at")
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issued_at) {
    return { error: "Only draft invoices can be edited" };
  }

  const { error } = await ctx.supabase
    .from("invoice_lines")
    .delete()
    .eq("id", lineId)
    .eq("invoice_id", invoiceId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const };
}

export async function updateInvoiceAction(
  orgSlug: string,
  invoiceId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: invoice } = await ctx.supabase
    .from("invoices")
    .select("id, status, issued_at")
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issued_at) {
    return { error: "Only draft invoices can be edited" };
  }

  const columns: Record<string, [string, number]> = {
    due_on: ["due_on", 10],
    terms: ["terms", 4000],
    memo: ["memo", 4000],
    project_id: ["project_id", 64],
    template_id: ["template_id", 64],
    reference: ["reference", 120],
    payment_instructions: ["payment_instructions", 2000],
  };
  const patch: Record<string, unknown> = {};
  for (const [key, [column, max]] of Object.entries(columns)) {
    if (formData.has(key)) patch[column] = field(formData, key, max) || null;
  }
  if (formData.has("terms")) patch.terms_doc = parseDoc(formData, "terms_doc");
  if (formData.has("memo")) patch.memo_doc = parseDoc(formData, "memo_doc");
  if (Object.keys(patch).length === 0) return { ok: true as const };

  const { error } = await ctx.supabase
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const };
}

export async function updateInvoiceBillToAction(
  orgSlug: string,
  invoiceId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: invoice } = await ctx.supabase
    .from("invoices")
    .select("id, status, issued_at, client_id")
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issued_at) {
    return { error: "Only draft invoices can be edited" };
  }

  const billTo = billToFromForm(formData);
  if (!billTo.name) return { error: "Billed-to name is required" };
  if (billTo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billTo.email)) {
    return { error: "Enter a valid email" };
  }

  const { error } = await ctx.supabase
    .from("invoices")
    .update({ bill_to: billTo })
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  let savedToClient = false;
  if (formData.get("save_to_client") === "on") {
    const { error: clientError } = await ctx.supabase
      .from("clients")
      .update({ billing: billTo })
      .eq("id", invoice.client_id as string)
      .eq("organization_id", ctx.org.id);
    savedToClient = !clientError;
  }

  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const, savedToClient };
}

export async function recordInvoicePaymentAction(
  orgSlug: string,
  invoiceId: string,
  formData: FormData,
) {
  const ctx = await requireModuleWrite(orgSlug, "finance");
  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) return { error: "Invoice not found" };
  if (!invoice.issuedAt) return { error: "Issue the invoice before recording a payment" };
  if (invoice.status === "void") return { error: "Void invoices cannot take payments" };

  let amountMinor: bigint;
  try {
    amountMinor = parseMajorToMinor(field(formData, "amount"), invoice.currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid amount" };
  }
  if (amountMinor <= BigInt(0)) return { error: "Amount must be more than zero" };

  const payments = await listInvoicePayments(orgSlug, invoice);
  const balance = invoiceSubtotalMinor(invoice.lines) - invoicePaidMinor(payments);
  if (balance <= BigInt(0)) return { error: "This invoice is already paid in full" };
  if (amountMinor > balance) {
    return {
      error: `That's more than the balance due (${invoiceMoneyLabel(balance, invoice.currency)})`,
    };
  }

  const methodRaw = field(formData, "method");
  const method = (INVOICE_PAYMENT_METHODS as readonly string[]).includes(methodRaw)
    ? methodRaw
    : "other";
  const paidOn = field(formData, "paid_on") || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Choose a valid payment date" };

  const { data, error } = await ctx.supabase.rpc("post_invoice_receipt", {
    p_invoice_id: invoiceId,
    p_amount_minor: amountMinor.toString(),
    p_paid_on: paidOn,
    p_method: method,
    p_reference: field(formData, "reference", 200) || null,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const paymentId = (row as { payment_id?: string } | null)?.payment_id;
  if (paymentId) {
    const { data: allocations } = await ctx.supabase
      .from("payment_allocations")
      .select("id, charge_id, amount_minor")
      .eq("payment_id", paymentId)
      .eq("organization_id", ctx.org.id);
    try {
      await allocatePartnersForReceipt(ctx, {
        paymentId,
        allocations: (allocations ?? []).map((allocation) => ({
          id: allocation.id as string,
          chargeId: allocation.charge_id as string,
          amountMinor: BigInt(allocation.amount_minor),
        })),
      });
    } catch (allocError) {
      return {
        error:
          allocError instanceof Error
            ? allocError.message
            : "Payment recorded, but partner earnings failed",
      };
    }
  }

  const label = invoiceMoneyLabel(amountMinor, invoice.currency);
  const fullyPaid = amountMinor === balance;
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "payment_recorded",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: { number: invoice.number, amount_minor: amountMinor.toString() },
  });
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "finance",
    title: (actor) =>
      fullyPaid
        ? `${actor} marked invoice ${invoice.number} as paid`
        : `${actor} recorded ${label} on invoice ${invoice.number}`,
    body: fullyPaid ? `${label} received · paid in full` : `${label} received`,
    href: `/${orgSlug}/invoices/${invoiceId}`,
    entity: { type: "invoice", id: invoiceId },
    actionLabel: "Open invoice",
  });

  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  revalidatePath(`/${orgSlug}/invoices`);
  revalidatePath(`/${orgSlug}/finance`);
  return { ok: true as const, fullyPaid };
}

export async function applyInvoiceTemplateAction(
  orgSlug: string,
  invoiceId: string,
  templateId: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issuedAt) {
    return { error: "Only draft invoices can be edited" };
  }

  const template = await getInvoiceTemplate(orgSlug, templateId);
  if (!template) return { error: "Template not found" };

  const config = await loadOrgInvoiceConfig(orgSlug);
  const dueDays = template.defaultDueDays ?? config.defaultDueDays;

  const { error } = await ctx.supabase
    .from("invoices")
    .update({
      template_id: template.id,
      terms: template.terms,
      terms_doc: template.termsDoc,
      memo: template.memo,
      memo_doc: template.memoDoc,
      due_on: invoice.dueOn ?? (dueDays > 0 ? dueOnFromDays(dueDays) : null),
    })
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  if (invoice.lines.length === 0 && template.starterLines.length > 0) {
    await ctx.supabase.from("invoice_lines").insert(
      template.starterLines.map((line, index) => ({
        organization_id: ctx.org.id,
        invoice_id: invoiceId,
        description: line.description,
        quantity: line.quantity || 1,
        unit_amount_minor: line.unitAmountMinor || "0",
        tax_bps: line.taxBps || template.defaultTaxBps || config.defaultTaxBps || 0,
        discount_minor: "0",
        position: index,
      })),
    );
  }

  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const };
}

export async function issueInvoiceAction(
  orgSlug: string,
  invoiceId: string,
  formData?: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const confirmDouble =
    String(formData?.get("confirm_double") ?? "") === "1" ||
    String(formData?.get("confirm_double") ?? "") === "on";

  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status !== "draft" || invoice.issuedAt) {
    return { error: "Invoice already issued" };
  }
  if (invoice.lines.length === 0) return { error: "Add at least one line before issuing" };

  const config = await loadOrgInvoiceConfig(orgSlug);
  const { data: orgRow, error: orgError } = await ctx.supabase
    .from("organizations")
    .select("invoice_next_number")
    .eq("id", ctx.org.id)
    .single();
  if (orgError) return { error: orgError.message };
  const nextNumber = Number(orgRow?.invoice_next_number ?? 1);
  const number = formatInvoiceNumber(nextNumber, config.numberPrefix);

  const milestoneIds = invoice.lines
    .map((line) => line.milestoneId)
    .filter((id): id is string => Boolean(id));
  const workLogIds = invoice.lines
    .map((line) => line.workLogId)
    .filter((id): id is string => Boolean(id));

  if (!confirmDouble && (milestoneIds.length > 0 || workLogIds.length > 0)) {
    const conflicts: string[] = [];
    if (milestoneIds.length > 0) {
      const { data: existing } = await ctx.supabase
        .from("charges")
        .select("id, milestone_id")
        .eq("organization_id", ctx.org.id)
        .in("milestone_id", milestoneIds)
        .eq("status", "open");
      for (const row of existing ?? []) {
        conflicts.push(`milestone ${row.milestone_id}`);
      }
    }
    if (workLogIds.length > 0) {
      const { data: existing } = await ctx.supabase
        .from("charges")
        .select("id, work_log_id")
        .eq("organization_id", ctx.org.id)
        .in("work_log_id", workLogIds)
        .eq("status", "open");
      for (const row of existing ?? []) {
        conflicts.push(`work log ${row.work_log_id}`);
      }
    }
    if (conflicts.length > 0) {
      return {
        error: `Already charged: ${conflicts.join(", ")}. Confirm double billing to continue.`,
        needsConfirmDouble: true as const,
      };
    }
  }

  const issuedOn = new Date().toISOString().slice(0, 10);
  const feeBps = 0;

  for (const line of invoice.lines) {
    const grossMinor = lineTotalMinor({
      quantity: line.quantity,
      unitAmountMinor: line.unitAmountMinor,
      taxBps: line.taxBps,
      discountMinor: line.discountMinor,
    });
    if (grossMinor <= BigInt(0)) continue;

    const netMinor = netFromGross(grossMinor, feeBps);
    const linkMilestone = !confirmDouble ? line.milestoneId : null;
    const linkWorkLog = !confirmDouble ? line.workLogId : null;

    const { data: charge, error: chargeError } = await ctx.supabase
      .from("charges")
      .insert({
        organization_id: ctx.org.id,
        client_id: invoice.clientId,
        project_id: invoice.projectId,
        milestone_id: linkMilestone,
        work_log_id: linkWorkLog,
        gross_minor: grossMinor.toString(),
        fee_bps: feeBps,
        net_minor: netMinor.toString(),
        currency: invoice.currency,
        charged_on: issuedOn,
        due_on: invoice.dueOn,
        source: "invoice",
        status: "open",
        memo: `${number}: ${line.description}`,
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    if (chargeError || !charge) {
      return { error: chargeError?.message ?? "Could not create charge for line" };
    }

    await ctx.supabase
      .from("invoice_lines")
      .update({ charge_id: charge.id })
      .eq("id", line.id)
      .eq("organization_id", ctx.org.id);
  }

  let brand = await resolveInvoiceBrand(orgSlug);
  if (invoice.templateId) {
    const template = await getInvoiceTemplate(orgSlug, invoice.templateId);
    if (template) {
      brand = {
        ...brand,
        layout: template.layout,
        accentHex: template.accentHex || brand.accentHex,
      };
    }
  }
  const brandSnapshot = brandToSnapshot(brand);

  let billTo = invoice.billTo;
  if (!billTo?.name) {
    const { data: client } = await ctx.supabase
      .from("clients")
      .select("id, name, billing")
      .eq("id", invoice.clientId)
      .maybeSingle();
    billTo = await defaultBillTo(ctx.supabase, ctx.org.id, {
      id: invoice.clientId,
      name: (client?.name as string | undefined) ?? "Client",
      billing: client?.billing,
    });
  }

  const { error } = await ctx.supabase
    .from("invoices")
    .update({
      number,
      issued_on: issuedOn,
      issued_at: new Date().toISOString(),
      brand_snapshot: brandSnapshot,
      bill_to: billTo,
    })
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  await ctx.supabase
    .from("organizations")
    .update({ invoice_next_number: nextNumber + 1 })
    .eq("id", ctx.org.id);

  try {
    const fresh = await getInvoice(orgSlug, invoiceId);
    if (fresh) {
      const { buffer } = await renderInvoicePdf(orgSlug, fresh);
      const storagePath = `${ctx.org.id}/invoice/${invoiceId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await ctx.supabase.storage
        .from("org-files")
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (!uploadError) {
        const { data: fileRow } = await ctx.supabase
          .from("files")
          .insert({
            organization_id: ctx.org.id,
            entity_type: "invoice",
            entity_id: invoiceId,
            storage_path: storagePath,
            name: `${number}.pdf`,
            mime: "application/pdf",
            size_bytes: buffer.byteLength,
            visibility: "shared",
            created_by: ctx.userId,
          })
          .select("id")
          .single();
        if (fileRow) {
          await ctx.supabase
            .from("invoices")
            .update({ pdf_file_id: fileRow.id })
            .eq("id", invoiceId);
        }
      }
    }
  } catch {
    // PDF optional — download route can regenerate.
  }

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "issued",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: { number },
  });
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "finance",
    title: (actor) => `${actor} issued invoice ${number}`,
    body: "The invoice is finalized and ready to send.",
    href: `/${orgSlug}/invoices/${invoiceId}`,
    entity: { type: "invoice", id: invoiceId },
    actionLabel: "Open invoice",
  });

  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  revalidatePath(`/${orgSlug}/finance`);
  return { ok: true as const, number };
}

export async function markInvoiceSentAction(orgSlug: string, invoiceId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: invoice } = await ctx.supabase
    .from("invoices")
    .select("id, status, issued_at")
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };
  if (!invoice.issued_at) return { error: "Issue the invoice before marking sent" };
  if (invoice.status === "void") return { error: "Void invoice cannot be sent" };

  const keepsStatus = invoice.status === "paid" || invoice.status === "partially_paid";
  const { error } = await ctx.supabase
    .from("invoices")
    .update({
      sent_at: new Date().toISOString(),
      ...(keepsStatus ? {} : { status: "sent" }),
    })
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const };
}

export async function voidInvoiceAction(orgSlug: string, invoiceId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.status === "void") return { error: "Already void" };
  const payments = await listInvoicePayments(orgSlug, invoice);
  if (invoicePaidMinor(payments) > BigInt(0)) {
    return { error: "This invoice has payments. Void them in Finance first." };
  }

  for (const line of invoice.lines) {
    if (!line.chargeId) continue;
    await ctx.supabase
      .from("charges")
      .update({ status: "void" })
      .eq("id", line.chargeId)
      .eq("organization_id", ctx.org.id);
  }

  const { error } = await ctx.supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", invoiceId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "finance",
    title: (actor) => `${actor} voided invoice ${invoice.number}`,
    body: "Linked charges were voided too.",
    href: `/${orgSlug}/invoices/${invoiceId}`,
    entity: { type: "invoice", id: invoiceId },
    actionLabel: "Open invoice",
  });
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  revalidatePath(`/${orgSlug}/finance`);
  return { ok: true as const };
}

export async function saveOrgInvoiceSettingsAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);

  const prefix = String(formData.get("number_prefix") ?? "INV")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  const nextNumber = Number(formData.get("next_number") ?? 1);
  const defaultDueDays = Number(formData.get("default_due_days") ?? 14);
  const defaultTaxBps = Number(formData.get("default_tax_bps") ?? 0);
  const accentHex = String(formData.get("accent_hex") ?? "#1d4ed8").trim();
  const layoutRaw = String(formData.get("layout") ?? "classic");
  const layout =
    layoutRaw === "minimal" || layoutRaw === "bold" ? layoutRaw : "classic";
  const logoFileId = String(formData.get("logo_file_id") ?? "").trim() || null;
  const clearLogo = String(formData.get("clear_logo") ?? "") === "1";

  if (!prefix) return { error: "Number prefix is required" };
  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    return { error: "Next number must be a positive integer" };
  }
  if (!Number.isInteger(defaultDueDays) || defaultDueDays < 0) {
    return { error: "Due days must be 0 or more" };
  }
  if (!Number.isInteger(defaultTaxBps) || defaultTaxBps < 0 || defaultTaxBps > 10_000) {
    return { error: "Tax must be 0–10000 bps" };
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(accentHex)) {
    return { error: "Accent must be a #RRGGBB color" };
  }

  const { data: orgRow, error: loadError } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .single();
  if (loadError) return { error: loadError.message };

  const existing =
    orgRow?.settings && typeof orgRow.settings === "object"
      ? (orgRow.settings as Record<string, unknown>)
      : {};
  const previous = parseOrgInvoiceSettings(existing);

  const invoice: OrgInvoiceSettings = {
    numberPrefix: prefix,
    defaultDueDays,
    defaultTaxBps,
    defaultTerms: String(formData.get("default_terms") ?? ""),
    defaultMemo: String(formData.get("default_memo") ?? ""),
    defaultPaymentInstructions: String(
      formData.get("default_payment_instructions") ?? previous.defaultPaymentInstructions,
    ),
    business: formData.has("business_legal_name")
      ? parseInvoiceBusiness({
          legalName: formData.get("business_legal_name"),
          address: formData.get("business_address"),
          email: formData.get("business_email"),
          phone: formData.get("business_phone"),
          taxId: formData.get("business_tax_id"),
          website: formData.get("business_website"),
          extras: extraFieldsFromForm(formData, "business_extra"),
        })
      : previous.business,
    brand: {
      accentHex,
      logoFileId: clearLogo ? null : logoFileId ?? previous.brand.logoFileId,
      showBusinessDetails: String(formData.get("show_business_details") ?? "") === "on",
      layout,
    },
  };

  const { error } = await ctx.supabase
    .from("organizations")
    .update({
      invoice_next_number: nextNumber,
      settings: { ...existing, invoice },
    })
    .eq("id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/invoices`);
  return { ok: true as const };
}

export async function upsertInvoiceTemplateAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const id = String(formData.get("template_id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };

  const layoutRaw = String(formData.get("layout") ?? "classic");
  const layout =
    layoutRaw === "minimal" || layoutRaw === "bold" ? layoutRaw : "classic";
  const accent = String(formData.get("accent_hex") ?? "").trim();
  const accentHex = accent && /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : null;
  const dueRaw = String(formData.get("default_due_days") ?? "").trim();
  const taxRaw = String(formData.get("default_tax_bps") ?? "").trim();
  const isDefault = String(formData.get("is_default") ?? "") === "on";

  const payload = {
    organization_id: ctx.org.id,
    name,
    layout,
    accent_hex: accentHex,
    default_due_days: dueRaw ? Number(dueRaw) : null,
    default_tax_bps: taxRaw ? Number(taxRaw) : null,
    terms: String(formData.get("terms") ?? "").trim() || null,
    terms_doc: parseDoc(formData, "terms_doc"),
    memo: String(formData.get("memo") ?? "").trim() || null,
    memo_doc: parseDoc(formData, "memo_doc"),
    is_default: isDefault,
  };

  if (isDefault) {
    await ctx.supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("organization_id", ctx.org.id);
  }

  if (id) {
    const { error } = await ctx.supabase
      .from("invoice_templates")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", ctx.org.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("invoice_templates").insert({
      ...payload,
      starter_lines: [],
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/invoices`);
  return { ok: true as const };
}

export async function deleteInvoiceTemplateAction(orgSlug: string, templateId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("invoice_templates")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/settings`);
  return { ok: true as const };
}

export async function sendInvoiceEmailAction(orgSlug: string, invoiceId: string, formData?: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) return { error: "Invoice not found" };
  if (!invoice.issuedAt) return { error: "Issue the invoice before sending" };
  if (invoice.status === "void") return { error: "Void invoice cannot be sent" };

  if (invoice.status === "paid") return { error: "This invoice is already paid" };

  const reminder = String(formData?.get("kind") ?? "") === "reminder";
  const to =
    String(formData?.get("to") ?? "").trim() ||
    invoice.billTo?.email?.trim() ||
    (await (async () => {
      const { data } = await ctx.supabase
        .from("contacts")
        .select("email")
        .eq("organization_id", ctx.org.id)
        .eq("client_id", invoice.clientId)
        .not("email", "is", null)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.email as string | null) ?? "";
    })());

  if (!to) return { error: "Add an email under Billed to, or enter a recipient" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Enter a valid recipient email" };

  const { buffer, clientName, brand, paidMinor } = await renderInvoicePdf(orgSlug, invoice);
  const balance = invoiceSubtotalMinor(invoice.lines) - paidMinor;

  const { invoiceEmailHtml, invoiceEmailText, sendEmail } = await import("@/shared/email");
  const emailInput = {
    orgName: brand.business.legalName || ctx.org.name,
    clientName: invoice.billTo?.contactName || invoice.billTo?.name || clientName,
    number: invoice.number,
    amountLabel: invoiceMoneyLabel(balance > BigInt(0) ? balance : BigInt(0), invoice.currency),
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
    memo: String(formData?.get("message") ?? "").trim() || invoice.memo,
    paymentInstructions: invoice.paymentInstructions,
    reminder,
  };
  const mailed = await sendEmail({
    to,
    subject: reminder
      ? `Reminder: invoice ${invoice.number} from ${emailInput.orgName} – ${emailInput.amountLabel} due`
      : `Invoice ${invoice.number} from ${emailInput.orgName} – ${emailInput.amountLabel}`,
    html: invoiceEmailHtml(emailInput),
    text: invoiceEmailText(emailInput),
    replyTo: brand.business.email || undefined,
    attachments: [
      { filename: `${invoice.number}.pdf`, content: buffer, contentType: "application/pdf" },
    ],
  });

  if (!mailed.ok) return { error: mailed.error };

  await markInvoiceSentAction(orgSlug, invoiceId);
  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: reminder ? "reminded" : "sent",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: { number: invoice.number, to },
  });
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "finance",
    title: (actor) =>
      reminder
        ? `${actor} sent a reminder for invoice ${invoice.number}`
        : `${actor} sent invoice ${invoice.number} to ${emailInput.clientName ?? to}`,
    body: `${emailInput.amountLabel} · emailed to ${to}`,
    href: `/${orgSlug}/invoices/${invoiceId}`,
    entity: { type: "invoice", id: invoiceId },
    actionLabel: "Open invoice",
  });
  revalidatePath(`/${orgSlug}/invoices/${invoiceId}`);
  return { ok: true as const, to };
}
