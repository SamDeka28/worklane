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
  issuedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLine[];
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}
