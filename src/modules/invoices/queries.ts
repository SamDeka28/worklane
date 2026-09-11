import { requireOrg } from "@/modules/identity/org";
import {
  isInvoiceStatus,
  type InvoiceLine,
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
    issuedAt: row.issued_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  };
}

const INVOICE_SELECT =
  "id, organization_id, client_id, project_id, number, status, currency, issued_on, due_on, terms, terms_doc, memo, memo_doc, pdf_file_id, template_id, brand_snapshot, issued_at, created_by, created_at, updated_at";

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
