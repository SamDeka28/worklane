import { NextResponse } from "next/server";
import { requireOrg } from "@/modules/identity/org";
import { getInvoice } from "@/modules/invoices/queries";
import { renderInvoicePdf } from "@/modules/invoices/render";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgSlug: string; invoiceId: string }> },
) {
  const { orgSlug, invoiceId } = await context.params;
  await requireOrg(orgSlug);
  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { buffer } = await renderInvoicePdf(orgSlug, invoice);
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoice.number}.pdf"`,
    },
  });
}
