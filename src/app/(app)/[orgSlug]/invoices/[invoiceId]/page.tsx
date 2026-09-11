import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { StatusChip } from "@/components/studio/status-chip";
import { getClient } from "@/modules/clients/queries";
import { resolveInvoiceBrand, loadOrgInvoiceConfig } from "@/modules/invoices/config";
import {
  AddInvoiceLineForm,
  InvoiceActions,
  InvoiceLineEditor,
  UpdateInvoiceForm,
} from "@/modules/invoices/components/invoice-forms";
import { InvoicePreview } from "@/modules/invoices/preview";
import { getInvoice } from "@/modules/invoices/queries";
import { ensureDefaultInvoiceTemplates } from "@/modules/invoices/templates";
import { INVOICE_STATUS_LABELS } from "@/modules/invoices/types";
import { requireOrg } from "@/modules/identity/org";

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/[orgSlug]/invoices/[invoiceId]">) {
  const { orgSlug, invoiceId } = await params;
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.finance) notFound();

  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) notFound();

  const [client, config, templates] = await Promise.all([
    getClient(orgSlug, invoice.clientId),
    loadOrgInvoiceConfig(orgSlug),
    ensureDefaultInvoiceTemplates(orgSlug),
  ]);

  let brand = await resolveInvoiceBrand(orgSlug, invoice.brandSnapshot);
  if (!invoice.brandSnapshot && invoice.templateId) {
    const template = templates.find((row) => row.id === invoice.templateId);
    if (template) {
      brand = {
        ...brand,
        layout: template.layout,
        accentHex: template.accentHex || brand.accentHex,
      };
    }
  }

  const issued = Boolean(invoice.issuedAt);
  const editable = ctx.canWrite && !issued && invoice.status === "draft";

  return (
    <WorkSurface>
      <StudioToolbar
        title={invoice.number}
        subtitle={client?.name ?? "Invoice"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceActions orgSlug={orgSlug} invoice={invoice} canWrite={ctx.canWrite} />
            <Link
              href={`/${orgSlug}/invoices`}
              className="px-2 text-sm text-muted-foreground hover:underline"
            >
              All invoices
            </Link>
          </div>
        }
      />

      <div
        className={
          editable
            ? "flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
            : "min-h-0 flex-1 overflow-y-auto"
        }
      >
        <div
          className={
            editable
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-muted/35"
              : "mx-auto w-full max-w-[48rem] px-5 py-5"
          }
        >
          <div
            className={
              editable
                ? "flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-3 lg:px-5"
                : "mb-4 flex flex-wrap items-center gap-2"
            }
          >
            <StatusChip
              tone={
                invoice.status === "paid"
                  ? "paid"
                  : invoice.status === "overdue"
                    ? "overdue"
                    : invoice.status === "void"
                      ? "cancelled"
                      : issued
                        ? "partial"
                        : "planning"
              }
            >
              {issued && invoice.status === "draft"
                ? "Issued"
                : INVOICE_STATUS_LABELS[invoice.status]}
            </StatusChip>
            <span className="text-sm text-muted-foreground">
              {invoice.issuedOn ? `Issued ${invoice.issuedOn}` : "Draft"}
              {invoice.dueOn ? ` · Due ${invoice.dueOn}` : ""}
            </span>
            <Link
              href={`/${orgSlug}/settings#invoices`}
              className="ml-auto text-xs text-muted-foreground hover:underline"
            >
              Brand settings
            </Link>
          </div>

          <div className={editable ? "flex-1 p-4 lg:p-5" : undefined}>
            <InvoicePreview
              invoice={invoice}
              clientName={client?.name ?? "Client"}
              brand={brand}
              className={editable ? "w-full rounded-3xl" : undefined}
            />
          </div>
        </div>

        {editable ? (
          <aside className="flex max-h-[50vh] w-full shrink-0 flex-col overflow-y-auto border-t border-border/50 bg-card lg:max-h-none lg:w-[22rem] lg:border-t-0 lg:border-l xl:w-[24rem]">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-sm font-semibold tracking-tight">Edit</p>
              <p className="text-xs text-muted-foreground">Template, due date, terms, lines</p>
            </div>
            <div className="space-y-5 px-4 py-4">
              <UpdateInvoiceForm
                orgSlug={orgSlug}
                invoice={invoice}
                templates={templates}
                compact
              />
              <div className="border-t border-border/40 pt-4">
                <p className="mb-3 text-sm font-semibold tracking-tight">Lines</p>
                <InvoiceLineEditor orgSlug={orgSlug} invoice={invoice} />
                <div className="mt-4">
                  <AddInvoiceLineForm
                    orgSlug={orgSlug}
                    invoiceId={invoice.id}
                    defaultTaxBps={config.defaultTaxBps}
                    compact
                  />
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </WorkSurface>
  );
}
