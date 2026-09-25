import { requireOrg } from "@/modules/identity/org";
import {
  isInvoiceStatus,
  parseBillTo,
  type InvoiceBillTo,
  type InvoiceLine,
  type InvoicePayment,
  type InvoiceRecord,
  type InvoiceStatus,
} from "@/modules/invoices/types";
import type { IsoCurrency } from "@/shared/money";

type InvoiceRow = {
  id: string;
  organization_id: string;
  client_id: string;
  project_id: string | null;
  number: string;
  status: string;
  currency: string;
  issued_on: string | null;
  due_on: string | null;
  terms: string | null;
  terms_doc: Record<string, unknown> | null;
  memo: string | null;
  memo_doc: Record<string, unknown> | null;
  pdf_file_id: string | null;
  template_id: string | null;
  brand_snapshot: Record<string, unknown> | null;
  bill_to: unknown;
  reference: string | null;
  payment_instructions: string | null;
  sent_at: string | null;
  paid_at: string | null;
  issued_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type LineRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string | number;
  unit_amount_minor: string | number;
  tax_bps: number;
  discount_minor: string | number;
  milestone_id: string | null;
  work_log_id: string | null;
  charge_id: string | null;
  position: number;
};

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

function mapLine(row: LineRow): InvoiceLine {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    quantity: Number(row.quantity),
    unitAmountMinor: BigInt(row.unit_amount_minor),
    taxBps: row.tax_bps,
    discountMinor: BigInt(row.discount_minor),
    milestoneId: row.milestone_id,
    workLogId: row.work_log_id,
    chargeId: row.charge_id,
    position: row.position,
  };
}

function mapInvoice(row: InvoiceRow, lines: InvoiceLine[]): InvoiceRecord {
  const status: InvoiceStatus = isInvoiceStatus(row.status) ? row.status : "draft";
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    projectId: row.project_id,
    number: row.number,
    status,
    currency: asCurrency(row.currency),
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    terms: row.terms,
    termsDoc: row.terms_doc,
    memo: row.memo,
    memoDoc: row.memo_doc,
    pdfFileId: row.pdf_file_id,
    templateId: row.template_id ?? null,
    brandSnapshot: row.brand_snapshot ?? null,
    billTo: parseBillTo(row.bill_to),
    reference: row.reference ?? null,
    paymentInstructions: row.payment_instructions ?? null,
    sentAt: row.sent_at ?? null,
    paidAt: row.paid_at ?? null,
    issuedAt: row.issued_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  };
}

const INVOICE_SELECT =
  "id, organization_id, client_id, project_id, number, status, currency, issued_on, due_on, terms, terms_doc, memo, memo_doc, pdf_file_id, template_id, brand_snapshot, bill_to, reference, payment_instructions, sent_at, paid_at, issued_at, created_by, created_at, updated_at";

export async function listInvoices(orgSlug: string): Promise<InvoiceRecord[]> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.finance) return [];

  const { data, error } = await ctx.supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (error.message.includes("invoices") || error.code === "42P01") return [];
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((row) => row.id as string);
  if (ids.length === 0) return [];

  const { data: lines, error: linesError } = await ctx.supabase
    .from("invoice_lines")
    .select(
      "id, invoice_id, description, quantity, unit_amount_minor, tax_bps, discount_minor, milestone_id, work_log_id, charge_id, position",
    )
    .eq("organization_id", ctx.org.id)
    .in("invoice_id", ids)
    .order("position");

  if (linesError) throw new Error(linesError.message);

  const byInvoice = new Map<string, InvoiceLine[]>();
  for (const line of lines ?? []) {
    const mapped = mapLine(line as LineRow);
    const list = byInvoice.get(mapped.invoiceId) ?? [];
    list.push(mapped);
    byInvoice.set(mapped.invoiceId, list);
  }

  return (data ?? []).map((row) =>
    mapInvoice(row as InvoiceRow, byInvoice.get(row.id as string) ?? []),
  );
}

export async function getInvoice(
  orgSlug: string,
  invoiceId: string,
): Promise<InvoiceRecord | null> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("organization_id", ctx.org.id)
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    if (error.message.includes("invoices") || error.code === "42P01") return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  const { data: lines, error: linesError } = await ctx.supabase
    .from("invoice_lines")
    .select(
      "id, invoice_id, description, quantity, unit_amount_minor, tax_bps, discount_minor, milestone_id, work_log_id, charge_id, position",
    )
    .eq("organization_id", ctx.org.id)
    .eq("invoice_id", invoiceId)
    .order("position");

  if (linesError) throw new Error(linesError.message);

  return mapInvoice(
    data as InvoiceRow,
    (lines ?? []).map((line) => mapLine(line as LineRow)),
  );
}

type AllocationRow = {
  amount_minor: string | number;
  payment:
    | {
        id: string;
        paid_on: string;
        method: string;
        reference: string | null;
        status: string;
        kind: string;
      }
    | {
        id: string;
        paid_on: string;
        method: string;
        reference: string | null;
        status: string;
        kind: string;
      }[]
    | null;
};

/** Receipts applied to the invoice's charges, newest first. */
export async function listInvoicePayments(
  orgSlug: string,
  invoice: Pick<InvoiceRecord, "lines">,
): Promise<InvoicePayment[]> {
  const chargeIds = invoice.lines
    .map((line) => line.chargeId)
    .filter((id): id is string => Boolean(id));
  if (chargeIds.length === 0) return [];

  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("payment_allocations")
    .select("amount_minor, payment:payments(id, paid_on, method, reference, status, kind)")
    .eq("organization_id", ctx.org.id)
    .in("charge_id", chargeIds);
  if (error) throw new Error(error.message);

  const byPayment = new Map<string, InvoicePayment>();
  for (const row of (data ?? []) as AllocationRow[]) {
    const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    if (!payment || payment.kind !== "receipt") continue;
    const existing = byPayment.get(payment.id);
    const amount = BigInt(row.amount_minor);
    if (existing) {
      existing.appliedMinor += amount;
      continue;
    }
    byPayment.set(payment.id, {
      id: payment.id,
      paidOn: payment.paid_on,
      method: payment.method,
      reference: payment.reference,
      status: payment.status === "void" ? "void" : "posted",
      appliedMinor: amount,
    });
  }

  return [...byPayment.values()].sort((a, b) => b.paidOn.localeCompare(a.paidOn));
}

/** Posted receipts applied to each invoice's charges, keyed by invoice id. */
export async function listInvoicePaidTotals(
  orgSlug: string,
  invoices: Pick<InvoiceRecord, "id" | "lines">[],
): Promise<Map<string, bigint>> {
  const invoiceByCharge = new Map<string, string>();
  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      if (line.chargeId) invoiceByCharge.set(line.chargeId, invoice.id);
    }
  }
  const totals = new Map<string, bigint>();
  if (invoiceByCharge.size === 0) return totals;

  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("payment_allocations")
    .select("charge_id, amount_minor, payment:payments(status, kind)")
    .eq("organization_id", ctx.org.id)
    .in("charge_id", [...invoiceByCharge.keys()]);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as Array<{
    charge_id: string;
    amount_minor: string | number;
    payment: { status: string; kind: string } | { status: string; kind: string }[] | null;
  }>) {
    const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    if (!payment || payment.kind !== "receipt" || payment.status === "void") continue;
    const invoiceId = invoiceByCharge.get(row.charge_id);
    if (!invoiceId) continue;
    totals.set(invoiceId, (totals.get(invoiceId) ?? BigInt(0)) + BigInt(row.amount_minor));
  }
  return totals;
}

export type LineSuggestion = {
  description: string;
  unitAmountMinor: string;
  taxBps: number;
  forClient: boolean;
};

/** Recently billed line items (this client's first), for one-click re-use. */
export async function listLineSuggestions(
  orgSlug: string,
  clientId: string,
  currency: IsoCurrency,
): Promise<LineSuggestion[]> {
  const ctx = await requireOrg(orgSlug);
  const { data } = await ctx.supabase
    .from("invoice_lines")
    .select("description, unit_amount_minor, tax_bps, created_at, invoice:invoices!inner(client_id, currency)")
    .eq("organization_id", ctx.org.id)
    .eq("invoice.currency", currency)
    .order("created_at", { ascending: false })
    .limit(300);

  const seen = new Map<string, LineSuggestion>();
  for (const row of (data ?? []) as {
    description: string;
    unit_amount_minor: string | number;
    tax_bps: number;
    invoice: { client_id: string } | { client_id: string }[] | null;
  }[]) {
    const description = row.description?.trim();
    if (!description) continue;
    const key = description.toLowerCase();
    const invoice = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
    const forClient = invoice?.client_id === clientId;
    const existing = seen.get(key);
    if (existing && (existing.forClient || !forClient)) continue;
    seen.set(key, {
      description,
      unitAmountMinor: String(row.unit_amount_minor ?? "0"),
      taxBps: Number(row.tax_bps ?? 0),
      forClient,
    });
  }
  return [...seen.values()]
    .sort((a, b) => Number(b.forClient) - Number(a.forClient))
    .slice(0, 40);
}

export async function getClientBillingProfile(
  orgSlug: string,
  clientId: string,
): Promise<InvoiceBillTo | null> {
  const ctx = await requireOrg(orgSlug);
  const { data } = await ctx.supabase
    .from("clients")
    .select("billing")
    .eq("organization_id", ctx.org.id)
    .eq("id", clientId)
    .maybeSingle();
  return parseBillTo(data?.billing);
}

export type BillingContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export async function listClientBillingContacts(
  orgSlug: string,
  clientId: string,
): Promise<BillingContact[]> {
  const ctx = await requireOrg(orgSlug);
  const { data } = await ctx.supabase
    .from("contacts")
    .select("id, name, email, phone, is_primary")
    .eq("organization_id", ctx.org.id)
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .limit(10);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    isPrimary: Boolean(row.is_primary),
  }));
}
