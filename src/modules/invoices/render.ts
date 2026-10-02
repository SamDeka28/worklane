import { getClient } from "@/modules/clients/queries";
import type { OrgContext } from "@/modules/identity/org";
import { resolveInvoiceBrand } from "@/modules/invoices/config";
import { renderInvoicePdfBuffer } from "@/modules/invoices/pdf";
import { listInvoicePayments } from "@/modules/invoices/queries";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import { getInvoiceTemplate } from "@/modules/invoices/templates";
import type { InvoicePayment, InvoiceRecord } from "@/modules/invoices/types";

export function invoicePaidMinor(payments: InvoicePayment[]): bigint {
  return payments
    .filter((payment) => payment.status === "posted")
    .reduce((sum, payment) => sum + payment.appliedMinor, BigInt(0));
}

/** Snapshot brand once issued; live org brand (with template overrides) while drafting. */
export async function resolveBrandForInvoice(
  orgSlug: string,
  invoice: Pick<InvoiceRecord, "brandSnapshot" | "templateId">,
  session?: OrgContext,
): Promise<InvoiceBrand> {
  const brand = await resolveInvoiceBrand(orgSlug, invoice.brandSnapshot, session);
  if (invoice.brandSnapshot || !invoice.templateId) return brand;
  const template = await getInvoiceTemplate(orgSlug, invoice.templateId, session);
  if (!template) return brand;
  return {
    ...brand,
    layout: template.layout,
    accentHex: template.accentHex || brand.accentHex,
  };
}

export async function renderInvoicePdf(orgSlug: string, invoice: InvoiceRecord, session?: OrgContext) {
  const [client, brand, payments] = await Promise.all([
    getClient(orgSlug, invoice.clientId, session),
    resolveBrandForInvoice(orgSlug, invoice, session),
    listInvoicePayments(orgSlug, invoice, session),
  ]);
  const clientName = client?.name ?? "Client";
  const paidMinor = invoicePaidMinor(payments);
  const buffer = await renderInvoicePdfBuffer({ invoice, clientName, brand, paidMinor });
  return { buffer, clientName, brand, paidMinor };
}
