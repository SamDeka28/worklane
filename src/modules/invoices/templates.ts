import { requireOrg } from "@/modules/identity/org";
import { asInvoiceLayout } from "@/modules/invoices/layouts";
import type { InvoiceLayout } from "@/modules/invoices/settings";

export type InvoiceTemplateStarterLine = {
  description: string;
  quantity: number;
  unitAmountMinor: string;
  taxBps: number;
};

export type InvoiceTemplate = {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  layout: InvoiceLayout;
  accentHex: string | null;
  defaultDueDays: number | null;
  defaultTaxBps: number | null;
  terms: string | null;
  termsDoc: Record<string, unknown> | null;
  memo: string | null;
  memoDoc: Record<string, unknown> | null;
  starterLines: InvoiceTemplateStarterLine[];
  createdAt: string;
  updatedAt: string;
};

type TemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  layout: string;
  accent_hex: string | null;
  default_due_days: number | null;
  default_tax_bps: number | null;
  terms: string | null;
  terms_doc: Record<string, unknown> | null;
  memo: string | null;
  memo_doc: Record<string, unknown> | null;
  starter_lines: unknown;
  created_at: string;
  updated_at: string;
};

function asLayout(value: string): InvoiceLayout {
  return asInvoiceLayout(value);
}

function mapStarterLines(raw: unknown): InvoiceTemplateStarterLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const description =
        typeof row.description === "string" ? row.description.trim() : "";
      if (!description) return null;
      return {
        description,
        quantity: typeof row.quantity === "number" ? row.quantity : Number(row.quantity) || 1,
        unitAmountMinor: String(row.unit_amount_minor ?? row.unitAmountMinor ?? "0"),
        taxBps: typeof row.tax_bps === "number" ? row.tax_bps : Number(row.taxBps) || 0,
      };
    })
    .filter((row): row is InvoiceTemplateStarterLine => Boolean(row));
}

function mapTemplate(row: TemplateRow): InvoiceTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    isDefault: row.is_default,
    layout: asLayout(row.layout),
    accentHex: row.accent_hex,
    defaultDueDays: row.default_due_days,
    defaultTaxBps: row.default_tax_bps,
    terms: row.terms,
    termsDoc: row.terms_doc,
    memo: row.memo,
    memoDoc: row.memo_doc,
    starterLines: mapStarterLines(row.starter_lines),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TEMPLATE_SELECT =
  "id, organization_id, name, is_default, layout, accent_hex, default_due_days, default_tax_bps, terms, terms_doc, memo, memo_doc, starter_lines, created_at, updated_at";

export async function listInvoiceTemplates(orgSlug: string): Promise<InvoiceTemplate[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("invoice_templates")
    .select(TEMPLATE_SELECT)
    .eq("organization_id", ctx.org.id)
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    if (error.message.includes("invoice_templates") || error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapTemplate(row as TemplateRow));
}

export async function getInvoiceTemplate(
  orgSlug: string,
  templateId: string,
): Promise<InvoiceTemplate | null> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("invoice_templates")
    .select(TEMPLATE_SELECT)
    .eq("organization_id", ctx.org.id)
    .eq("id", templateId)
    .maybeSingle();
  if (error) {
    if (error.message.includes("invoice_templates") || error.code === "42P01") return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapTemplate(data as TemplateRow);
}

export async function ensureDefaultInvoiceTemplates(orgSlug: string): Promise<InvoiceTemplate[]> {
  const existing = await listInvoiceTemplates(orgSlug);
  if (existing.length > 0) return existing;

  const ctx = await requireWritableForSeed(orgSlug);
  if (!ctx) return existing;

  const seeds = [
    {
      name: "Classic",
      layout: "classic",
      is_default: true,
      terms: "Payment due within 14 days of invoice date.",
    },
    {
      name: "Minimal",
      layout: "minimal",
      is_default: false,
      terms: "Thank you for your business.",
    },
    {
      name: "Bold",
      layout: "bold",
      is_default: false,
      terms: "Net 14. Late fees may apply after the due date.",
    },
    {
      name: "Modern",
      layout: "modern",
      is_default: false,
      terms: "Payment due within 14 days of invoice date.",
    },
    {
      name: "Elegant",
      layout: "elegant",
      is_default: false,
      terms: "With thanks for your business.",
    },
    {
      name: "Studio",
      layout: "studio",
      is_default: false,
      terms: "Net 14. Please quote the invoice number with your payment.",
    },
    {
      name: "Corporate",
      layout: "corporate",
      is_default: false,
      terms: "Payment due within 30 days. Late payments may incur interest.",
    },
    {
      name: "Swiss",
      layout: "swiss",
      is_default: false,
      terms: "Payment due within 14 days.",
    },
    {
      name: "Edge",
      layout: "edge",
      is_default: false,
      terms: "Net 14. Thank you for working with us.",
    },
    {
      name: "Letterhead",
      layout: "letterhead",
      is_default: false,
      terms: "Payment due within 30 days of invoice date.",
    },
    {
      name: "Ribbon",
      layout: "ribbon",
      is_default: false,
      terms: "Thanks! Payment due within 14 days.",
    },
  ];

  await ctx.supabase.from("invoice_templates").insert(
    seeds.map((seed) => ({
      organization_id: ctx.org.id,
      name: seed.name,
      layout: seed.layout,
      is_default: seed.is_default,
      terms: seed.terms,
      starter_lines: [],
    })),
  );

  return listInvoiceTemplates(orgSlug);
}

async function requireWritableForSeed(orgSlug: string) {
  try {
    const { requireWritableOrg } = await import("@/modules/identity/org");
    return await requireWritableOrg(orgSlug);
  } catch {
    return null;
  }
}
