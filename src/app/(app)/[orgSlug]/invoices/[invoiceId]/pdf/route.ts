import { NextResponse } from "next/server";
import { getClient } from "@/modules/clients/queries";
import { requireOrg } from "@/modules/identity/org";
import { resolveInvoiceBrand } from "@/modules/invoices/config";
import { renderInvoicePdfBuffer } from "@/modules/invoices/pdf";
import { getInvoice } from "@/modules/invoices/queries";
import { getInvoiceTemplate } from "@/modules/invoices/templates";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orgSlug: string; invoiceId: string }> },
) {
  const { orgSlug, invoiceId } = await context.params;
  const ctx = await requireOrg(orgSlug);
  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = await getClient(orgSlug, invoice.clientId);
  let brand = await resolveInvoiceBrand(orgSlug, invoice.brandSnapshot);
  if (!invoice.brandSnapshot && invoice.templateId) {
    const template = await getInvoiceTemplate(orgSlug, invoice.templateId);
    if (template) {
      brand = {
        ...brand,
        layout: template.layout,
        accentHex: template.accentHex || brand.accentHex,
      };
    }
  }

  const buffer = await renderInvoicePdfBuffer({
    invoice,
    clientName: client?.name ?? "Client",
    brand,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
