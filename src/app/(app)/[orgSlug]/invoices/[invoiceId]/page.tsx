import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  Landmark,
  ListPlus,
  Palette,
  Store,
  type LucideIcon,
} from "lucide-react";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { StatusChip } from "@/components/studio/status-chip";
import { STUDIO_DRAWER_CLEARANCE, StudioDrawer } from "@/components/studio/studio-drawer";
import { getClient } from "@/modules/clients/queries";
import { formatDay } from "@/modules/finance/presentation";
import { resolveInvoiceBrand, loadOrgInvoiceConfig } from "@/modules/invoices/config";
import {
  InvoiceNextStep,
  InvoicePaymentsList,
  InvoiceSteps,
} from "@/modules/invoices/components/invoice-flow";
import {
  AddInvoiceLineForm,
  BillToForm,
  InvoiceActions,
  InvoiceDatesForm,
  InvoiceLineEditor,
  InvoiceNotesForm,
  InvoiceTemplatePicker,
} from "@/modules/invoices/components/invoice-forms";
import { InvoiceSettingsDialog } from "@/modules/invoices/components/invoice-settings-form";
import {
  InvoiceBusyOverlay,
  InvoiceBusyProvider,
} from "@/modules/invoices/components/invoice-busy";
import { InvoicePreview } from "@/modules/invoices/preview";
import {
  getClientBillingProfile,
  getInvoice,
  listClientBillingContacts,
  listInvoicePayments,
  listLineSuggestions,
} from "@/modules/invoices/queries";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import { invoicePaidMinor, resolveBrandForInvoice } from "@/modules/invoices/render";
import { ensureDefaultInvoiceTemplates } from "@/modules/invoices/templates";
import { invoiceSubtotalMinor } from "@/modules/invoices/totals";
import {
  INVOICE_DISPLAY_LABELS,
  invoiceDisplayStatus,
  type InvoiceDisplayStatus,
} from "@/modules/invoices/types";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { canWriteModule } from "@/modules/identity/permissions";
import { formatMoney } from "@/shared/money";

const STATUS_TONE = {
  draft: "planning",
  issued: "partial",
  sent: "partial",
  partially_paid: "partial",
  paid: "paid",
  overdue: "overdue",
  void: "cancelled",
} as const satisfies Record<InvoiceDisplayStatus, string>;

function AsideSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 px-5 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        {meta ? <span className="text-xs text-muted-foreground tabular-nums">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function BilledBySummary({
  brand,
  orgSlug,
  invoiceId,
}: {
  brand: InvoiceBrand;
  orgSlug: string;
  invoiceId: string;
}) {
  const business = brand.business;
  const rows = [
    business.address,
    [business.email, business.phone].filter(Boolean).join(" · "),
    business.website,
    business.taxId ? `Tax ID: ${business.taxId}` : null,
    ...business.extras.map((extra) => [extra.label, extra.value].filter(Boolean).join(": ")),
  ].filter(Boolean);
  return (
    <div className="grid gap-3">
      <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
        <p className="font-medium">{business.legalName || brand.orgName}</p>
        {rows.length ? (
          rows.map((row, index) => (
            <p key={index} className="text-xs whitespace-pre-line text-muted-foreground">
              {row}
            </p>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Add your address, tax ID, PAN or registration numbers so clients can pay and file you.
          </p>
        )}
        {!brand.showBusinessDetails ? (
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
            Hidden on invoices. Turn it on in business details.
          </p>
        ) : null}
      </div>
      <Link
        href={`/${orgSlug}/invoices/${invoiceId}?settings=business`}
        scroll={false}
        className="text-xs font-medium text-primary hover:underline"
      >
        Edit business details
      </Link>
      <p className="text-[11px] text-muted-foreground">
        Shared by all invoices. Issued invoices keep the details they were issued with.
      </p>
    </div>
  );
}

/** Collapsible studio section; sections sharing `name` behave as an accordion. */
function StudioSection({
  icon: Icon,
  title,
  summary,
  done,
  defaultOpen,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: ReactNode;
  done?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details name="invoice-studio" open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 transition-colors select-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span
          className={
            done
              ? "flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold tracking-tight">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 px-5 pt-1 pb-5">{children}</div>
    </details>
  );
}

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/[orgSlug]/invoices/[invoiceId]">) {
  const { orgSlug, invoiceId } = await params;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "finance");
  if (!ctx.org.modules.finance) notFound();

  const invoice = await getInvoice(orgSlug, invoiceId);
  if (!invoice) notFound();

  const issued = Boolean(invoice.issuedAt);
  const editable = ctx.canWrite && !issued && invoice.status === "draft";

  const [client, config, templates, orgBrand, brand, payments, contacts, suggestions, clientBilling] =
    await Promise.all([
      getClient(orgSlug, invoice.clientId),
      loadOrgInvoiceConfig(orgSlug),
      ensureDefaultInvoiceTemplates(orgSlug),
      resolveInvoiceBrand(orgSlug),
      resolveBrandForInvoice(orgSlug, invoice),
      listInvoicePayments(orgSlug, invoice),
      editable ? listClientBillingContacts(orgSlug, invoice.clientId) : Promise.resolve([]),
      editable
        ? listLineSuggestions(orgSlug, invoice.clientId, invoice.currency)
        : Promise.resolve([]),
      editable ? getClientBillingProfile(orgSlug, invoice.clientId) : Promise.resolve(null),
    ]);
  const total = invoiceSubtotalMinor(invoice.lines);
  const paidMinor = invoicePaidMinor(payments);
  const balance = total > paidMinor ? total - paidMinor : BigInt(0);
  const status = invoiceDisplayStatus(invoice);
  const money = (amountMinor: bigint) => formatMoney({ amountMinor, currency: invoice.currency });
  const clientName = client?.name ?? "Client";

  return (
    <InvoiceBusyProvider>
      <WorkSurface>
        <StudioToolbar
          title={invoice.number}
          subtitle={
            <span className="inline-flex items-center gap-2">
              <Link
                href={`/${orgSlug}/invoices`}
                className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Invoices
              </Link>
              <span aria-hidden>/</span>
              {client ? (
                <Link
                  href={`/${orgSlug}/clients/${client.id}`}
                  className="truncate transition-colors hover:text-foreground"
                >
                  {client.name}
                </Link>
              ) : (
                <span>Client</span>
              )}
            </span>
          }
          actions={
            <>
              <InvoiceSettingsDialog
                orgSlug={orgSlug}
                orgId={ctx.org.id}
                config={config}
                logoUrl={orgBrand.logoUrl ?? null}
                templates={templates}
                canWrite={ctx.canWrite}
                label="Settings"
              />
              <InvoiceActions orgSlug={orgSlug} invoice={invoice} canWrite={ctx.canWrite} />
            </>
          }
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${STUDIO_DRAWER_CLEARANCE}`}
          >
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/40 px-4 py-2.5 text-sm sm:px-6">
              <StatusChip tone={STATUS_TONE[status]}>{INVOICE_DISPLAY_LABELS[status]}</StatusChip>
              <span className="text-muted-foreground">
                {invoice.issuedOn ? `Issued ${formatDay(invoice.issuedOn)}` : "Not issued yet"}
                {invoice.dueOn ? ` · Due ${formatDay(invoice.dueOn)}` : ""}
                {invoice.sentAt ? ` · Sent ${formatDay(invoice.sentAt.slice(0, 10))}` : ""}
              </span>
              <span className="ml-auto flex items-center gap-3 text-muted-foreground">
                <span>
                  Total{" "}
                  <span className="font-semibold text-foreground tabular-nums">{money(total)}</span>
                </span>
                {issued && status !== "void" ? (
                  <span>
                    Balance{" "}
                    <span
                      className={
                        balance > BigInt(0)
                          ? "font-semibold text-foreground tabular-nums"
                          : "font-semibold text-emerald-600 tabular-nums dark:text-emerald-400"
                      }
                    >
                      {money(balance)}
                    </span>
                  </span>
                ) : null}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#ebe9e4] dark:bg-black/25">
              <div className="mx-auto w-full max-w-[52rem] px-3 py-6 sm:px-8 sm:py-10">
                <InvoiceBusyOverlay>
                  <InvoicePreview
                    invoice={invoice}
                    clientName={clientName}
                    brand={brand}
                    paidMinor={paidMinor}
                  />
                </InvoiceBusyOverlay>
              </div>
            </div>
          </div>

          <StudioDrawer
            label={editable ? "Edit invoice" : "Invoice actions"}
            summary={
              issued && status !== "void"
                ? `${INVOICE_DISPLAY_LABELS[status]} · Balance ${money(balance)}`
                : `${INVOICE_DISPLAY_LABELS[status]} · ${money(total)}`
            }
            className="lg:w-[22rem] lg:shrink-0 lg:border-l lg:border-border/50 lg:bg-card xl:w-[24rem]"
          >
            <div className="divide-y divide-border/40">
              <section className="grid gap-4 px-5 py-5">
                <InvoiceSteps invoice={invoice} status={status} />
                <InvoiceNextStep
                  orgSlug={orgSlug}
                  invoice={invoice}
                  status={status}
                  paidMinor={paidMinor}
                  canWrite={ctx.canWrite}
                  canRecordPayment={ctx.canWrite && canWriteModule(ctx.permissions, "finance")}
                />
              </section>

              {editable ? (
                <div className="divide-y divide-border/40">
                  <StudioSection
                    icon={Building2}
                    title="Billed to"
                    done={Boolean(invoice.billTo?.name)}
                    summary={
                      [invoice.billTo?.name || clientName, invoice.billTo?.email]
                        .filter(Boolean)
                        .join(" · ") || "Add billing details"
                    }
                  >
                    <BillToForm
                      orgSlug={orgSlug}
                      invoice={invoice}
                      clientName={clientName}
                      contacts={contacts}
                      clientBilling={clientBilling}
                    />
                  </StudioSection>
                  <StudioSection
                    icon={ListPlus}
                    title="Items"
                    done={invoice.lines.length > 0}
                    defaultOpen
                    summary={
                      invoice.lines.length
                        ? `${invoice.lines.length} item${invoice.lines.length === 1 ? "" : "s"} · ${money(total)}`
                        : "No items yet"
                    }
                  >
                    <InvoiceLineEditor orgSlug={orgSlug} invoice={invoice} />
                    <AddInvoiceLineForm
                      orgSlug={orgSlug}
                      invoiceId={invoice.id}
                      currency={invoice.currency}
                      defaultTaxBps={config.defaultTaxBps}
                      suggestions={suggestions}
                    />
                  </StudioSection>
                  <StudioSection
                    icon={CalendarDays}
                    title="Dates & reference"
                    done={Boolean(invoice.dueOn)}
                    summary={
                      [
                        invoice.dueOn ? `Due ${formatDay(invoice.dueOn)}` : "Due on receipt",
                        invoice.reference,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    }
                  >
                    <InvoiceDatesForm orgSlug={orgSlug} invoice={invoice} />
                  </StudioSection>
                  <StudioSection
                    icon={Landmark}
                    title="Payment details & notes"
                    done={Boolean(invoice.paymentInstructions)}
                    summary={
                      [
                        invoice.paymentInstructions ? "Payment details" : null,
                        invoice.memo ? "Notes" : null,
                        invoice.terms ? "Terms" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "How the client should pay you"
                    }
                  >
                    <InvoiceNotesForm orgSlug={orgSlug} invoice={invoice} />
                  </StudioSection>
                  <StudioSection
                    icon={Store}
                    title="Billed by"
                    done={Boolean(brand.business.legalName || brand.business.address)}
                    summary={
                      [brand.business.legalName || brand.orgName, brand.business.taxId]
                        .filter(Boolean)
                        .join(" · ")
                    }
                  >
                    <BilledBySummary brand={brand} orgSlug={orgSlug} invoiceId={invoice.id} />
                  </StudioSection>
                  {templates.length > 0 ? (
                    <StudioSection
                      icon={Palette}
                      title="Look"
                      summary={
                        templates.find((template) => template.id === invoice.templateId)?.name ??
                        "Workspace default"
                      }
                    >
                      <InvoiceTemplatePicker
                        orgSlug={orgSlug}
                        invoice={invoice}
                        templates={templates}
                        defaultAccent={orgBrand.accentHex}
                      />
                    </StudioSection>
                  ) : null}
                </div>
              ) : null}

              {issued ? (
                <AsideSection title="Payments" meta={paidMinor > BigInt(0) ? money(paidMinor) : null}>
                  <InvoicePaymentsList invoice={invoice} payments={payments} paidMinor={paidMinor} />
                </AsideSection>
              ) : null}
            </div>
          </StudioDrawer>
        </div>
      </WorkSurface>
    </InvoiceBusyProvider>
  );
}
