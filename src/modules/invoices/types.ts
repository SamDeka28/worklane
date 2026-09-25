export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export type InvoiceLine = {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmountMinor: bigint;
  taxBps: number;
  discountMinor: bigint;
  milestoneId: string | null;
  workLogId: string | null;
  chargeId: string | null;
  position: number;
};

/** Free-form label/value line printed under a party, e.g. "PAN: ABCDE1234F". */
export type InvoiceExtraField = { label: string; value: string };

export const MAX_EXTRA_FIELDS = 6;

export function parseExtraFields(raw: unknown): InvoiceExtraField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim().slice(0, 60) : "";
      const value = typeof row.value === "string" ? row.value.trim().slice(0, 200) : "";
      return label || value ? { label, value } : null;
    })
    .filter((item): item is InvoiceExtraField => Boolean(item))
    .slice(0, MAX_EXTRA_FIELDS);
}

export function extraFieldsFromForm(formData: FormData, prefix: string): InvoiceExtraField[] {
  const labels = formData.getAll(`${prefix}_label`).map(String);
  const values = formData.getAll(`${prefix}_value`).map(String);
  return parseExtraFields(labels.map((label, index) => ({ label, value: values[index] ?? "" })));
}

export type InvoiceBillTo = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  extras: InvoiceExtraField[];
};

export const EMPTY_BILL_TO: InvoiceBillTo = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
  extras: [],
};

export function parseBillTo(raw: unknown): InvoiceBillTo | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    name: text(row.name),
    contactName: text(row.contactName),
    email: text(row.email),
    phone: text(row.phone),
    address: text(row.address),
    taxId: text(row.taxId),
    extras: parseExtraFields(row.extras),
  };
}

export const INVOICE_PAYMENT_METHODS = ["bank", "stripe", "upwork", "other"] as const;
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];

export const INVOICE_PAYMENT_METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  bank: "Bank transfer",
  stripe: "Card (Stripe)",
  upwork: "Upwork",
  other: "Other",
};

export type InvoicePayment = {
  id: string;
  paidOn: string;
  method: string;
  reference: string | null;
  status: "posted" | "void";
  /** Portion of this receipt applied to the invoice's charges. */
  appliedMinor: bigint;
};

export type InvoiceRecord = {
  id: string;
  organizationId: string;
  clientId: string;
  projectId: string | null;
  number: string;
  status: InvoiceStatus;
  currency: "USD" | "INR";
  issuedOn: string | null;
  dueOn: string | null;
  terms: string | null;
  termsDoc: Record<string, unknown> | null;
  memo: string | null;
  memoDoc: Record<string, unknown> | null;
  pdfFileId: string | null;
  templateId: string | null;
  brandSnapshot: Record<string, unknown> | null;
  billTo: InvoiceBillTo | null;
  reference: string | null;
  paymentInstructions: string | null;
  sentAt: string | null;
  paidAt: string | null;
  issuedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLine[];
};

export type InvoiceDisplayStatus = "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "void";

export const INVOICE_DISPLAY_LABELS: Record<InvoiceDisplayStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/** Lifecycle as the user sees it: overdue is derived from the due date. */
export function invoiceDisplayStatus(
  invoice: Pick<InvoiceRecord, "status" | "issuedAt" | "dueOn">,
  today = new Date().toISOString().slice(0, 10),
): InvoiceDisplayStatus {
  if (invoice.status === "void") return "void";
  if (invoice.status === "paid") return "paid";
  if (!invoice.issuedAt) return "draft";
  if (invoice.dueOn && invoice.dueOn < today) return "overdue";
  if (invoice.status === "partially_paid") return "partially_paid";
  if (invoice.status === "sent" || invoice.status === "viewed" || invoice.status === "overdue") {
    return "sent";
  }
  return "issued";
}

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}
