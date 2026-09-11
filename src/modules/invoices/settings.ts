export const INVOICE_LAYOUTS = ["classic", "minimal", "bold"] as const;
export type InvoiceLayout = (typeof INVOICE_LAYOUTS)[number];

export type InvoiceBrand = {
  accentHex: string;
  logoFileId: string | null;
  logoUrl?: string | null;
  showOrgAddress: boolean;
  layout: InvoiceLayout;
  orgName: string;
};

export type InvoiceBrandSnapshot = {
  layout: InvoiceLayout;
  accentHex: string;
  logoFileId: string | null;
  orgName: string;
  showOrgAddress: boolean;
};

export type OrgInvoiceSettings = {
  numberPrefix: string;
  defaultDueDays: number;
  defaultTaxBps: number;
  defaultTerms: string;
  defaultMemo: string;
  brand: {
    accentHex: string;
    logoFileId: string | null;
    showOrgAddress: boolean;
    layout: InvoiceLayout;
  };
};

export const DEFAULT_ORG_INVOICE_SETTINGS: OrgInvoiceSettings = {
  numberPrefix: "INV",
  defaultDueDays: 14,
  defaultTaxBps: 0,
  defaultTerms: "Payment due within 14 days of invoice date.",
  defaultMemo: "",
  brand: {
    accentHex: "#1d4ed8",
    logoFileId: null,
    showOrgAddress: false,
    layout: "classic",
  },
};

function isLayout(value: unknown): value is InvoiceLayout {
  return (
    typeof value === "string" &&
    (INVOICE_LAYOUTS as readonly string[]).includes(value)
  );
}

function asHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : fallback;
}

export function parseOrgInvoiceSettings(raw: unknown): OrgInvoiceSettings {
  const base = DEFAULT_ORG_INVOICE_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...base, brand: { ...base.brand } };
  const invoice = (raw as { invoice?: unknown }).invoice;
  if (!invoice || typeof invoice !== "object") return { ...base, brand: { ...base.brand } };
  const row = invoice as Record<string, unknown>;
  const brandRaw =
    row.brand && typeof row.brand === "object"
      ? (row.brand as Record<string, unknown>)
      : {};

  return {
    numberPrefix:
      typeof row.numberPrefix === "string" && row.numberPrefix.trim()
        ? row.numberPrefix.trim().slice(0, 12)
        : base.numberPrefix,
    defaultDueDays:
      typeof row.defaultDueDays === "number" &&
      Number.isInteger(row.defaultDueDays) &&
      row.defaultDueDays >= 0
        ? row.defaultDueDays
        : base.defaultDueDays,
    defaultTaxBps:
      typeof row.defaultTaxBps === "number" &&
      Number.isInteger(row.defaultTaxBps) &&
      row.defaultTaxBps >= 0 &&
      row.defaultTaxBps <= 10_000
        ? row.defaultTaxBps
        : base.defaultTaxBps,
    defaultTerms:
      typeof row.defaultTerms === "string" ? row.defaultTerms : base.defaultTerms,
    defaultMemo:
      typeof row.defaultMemo === "string" ? row.defaultMemo : base.defaultMemo,
    brand: {
      accentHex: asHex(brandRaw.accentHex, base.brand.accentHex),
      logoFileId:
        typeof brandRaw.logoFileId === "string" && brandRaw.logoFileId
          ? brandRaw.logoFileId
          : null,
      showOrgAddress: Boolean(brandRaw.showOrgAddress ?? base.brand.showOrgAddress),
      layout: isLayout(brandRaw.layout) ? brandRaw.layout : base.brand.layout,
    },
  };
}

export function parseBrandSnapshot(raw: unknown): InvoiceBrandSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.orgName !== "string" || !row.orgName.trim()) return null;
  return {
    layout: isLayout(row.layout) ? row.layout : "classic",
    accentHex: asHex(row.accentHex, DEFAULT_ORG_INVOICE_SETTINGS.brand.accentHex),
    logoFileId:
      typeof row.logoFileId === "string" && row.logoFileId ? row.logoFileId : null,
    orgName: row.orgName.trim(),
    showOrgAddress: Boolean(row.showOrgAddress),
  };
}

export function dueOnFromDays(days: number, from = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days),
  );
  return d.toISOString().slice(0, 10);
}

export function plainToDoc(plain: string): Record<string, unknown> | null {
  const text = plain.trim();
  if (!text) return null;
  return {
    type: "doc",
    content: text.split(/\n+/).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
