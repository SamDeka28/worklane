import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/studio/composer";
import { SoftCard, StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import { StatusChip } from "@/components/studio/status-chip";
import { listClients } from "@/modules/clients/queries";
import { CreateInvoiceDialog } from "@/modules/invoices/components/invoice-forms";
import { loadOrgInvoiceConfig } from "@/modules/invoices/config";
import { listInvoices } from "@/modules/invoices/queries";
import { dueOnFromDays } from "@/modules/invoices/settings";
import { ensureDefaultInvoiceTemplates } from "@/modules/invoices/templates";
import { invoiceSubtotalMinor } from "@/modules/invoices/totals";
import { INVOICE_STATUS_LABELS } from "@/modules/invoices/types";
import { requireOrg } from "@/modules/identity/org";
import { formatMoney } from "@/shared/money";

export default async function InvoicesPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/invoices">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.finance) notFound();

  const [invoices, clients, config, templates] = await Promise.all([
    listInvoices(orgSlug),
    listClients(orgSlug),
    loadOrgInvoiceConfig(orgSlug),
    ensureDefaultInvoiceTemplates(orgSlug),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const defaultDueOn =
    config.defaultDueDays > 0 ? dueOnFromDays(config.defaultDueDays) : undefined;

  return (
    <WorkSurface>
      <StudioToolbar
        title="Invoices"
        subtitle="Draft, issue to ledger, then send"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${orgSlug}/settings#invoices`}
              className="text-sm text-muted-foreground hover:underline"
            >
              Configure
            </Link>
            {ctx.canWrite ? (
              <CreateInvoiceDialog
                orgSlug={orgSlug}
                clients={clients.map((c) => ({
                  id: c.id,
                  name: c.name,
                  currency: c.currency,
                }))}
                templates={templates}
                defaultDueOn={defaultDueOn}
                defaultTaxBps={config.defaultTaxBps}
                defaultOpen={query.new === "1"}
              />
            ) : null}
          </div>
        }
      />
      <PageShell className="px-6 pb-6">
        {invoices.length === 0 ? (
          <SoftCard>
            <EmptyState
              title="No invoices yet"
              body="Create a draft, add lines, then issue to the ledger."
              actionHref={ctx.canWrite ? `/${orgSlug}/invoices?new=1` : undefined}
              actionLabel={ctx.canWrite ? "New invoice" : undefined}
            />
          </SoftCard>
        ) : (
          <SoftCard className="overflow-hidden">
            <ul className="divide-y divide-border/60">
              {invoices.map((invoice) => {
                const total = invoiceSubtotalMinor(invoice.lines);
                return (
                  <li key={invoice.id}>
                    <Link
                      href={`/${orgSlug}/invoices/${invoice.id}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium tabular-nums">{invoice.number}</span>
                          <StatusChip
                            tone={
                              invoice.status === "paid"
                                ? "paid"
                                : invoice.status === "overdue"
                                  ? "overdue"
                                  : invoice.status === "void"
                                    ? "cancelled"
                                    : "due"
                            }
                          >
                            {INVOICE_STATUS_LABELS[invoice.status]}
                          </StatusChip>
                        </span>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {clientName.get(invoice.clientId) ?? "Client"}
                          {invoice.dueOn ? ` · due ${invoice.dueOn}` : ""}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums">
                        {formatMoney({ amountMinor: total, currency: invoice.currency })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SoftCard>
        )}
      </PageShell>
    </WorkSurface>
  );
}
