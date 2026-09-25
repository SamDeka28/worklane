import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Send } from "lucide-react";
import {
  FilterChip,
  FilterChips,
  StudioToolbar,
  WorkSurface,
} from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { listClients } from "@/modules/clients/queries";
import { formatDay } from "@/modules/finance/presentation";
import { CreateInvoiceDialog } from "@/modules/invoices/components/invoice-forms";
import { InvoiceSettingsDialog } from "@/modules/invoices/components/invoice-settings-form";
import { loadOrgInvoiceConfig, resolveInvoiceBrand } from "@/modules/invoices/config";
import { listInvoicePaidTotals, listInvoices } from "@/modules/invoices/queries";
import { dueOnFromDays } from "@/modules/invoices/settings";
import { ensureDefaultInvoiceTemplates } from "@/modules/invoices/templates";
import { invoiceSubtotalMinor } from "@/modules/invoices/totals";
import {
  INVOICE_DISPLAY_LABELS,
  invoiceDisplayStatus,
  type InvoiceDisplayStatus,
  type InvoiceRecord,
} from "@/modules/invoices/types";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { formatMoney } from "@/shared/money";

type Filter = "all" | "draft" | "outstanding" | "overdue" | "paid" | "void";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "outstanding", label: "Outstanding" },
  { id: "overdue", label: "Overdue" },
  { id: "draft", label: "Drafts" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
];

const OUTSTANDING: InvoiceDisplayStatus[] = ["issued", "sent", "partially_paid", "overdue"];

type Row = {
  invoice: InvoiceRecord;
  status: InvoiceDisplayStatus;
  total: bigint;
  paid: bigint;
  balance: bigint;
};

export default async function InvoicesPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/invoices">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "finance");
  if (!ctx.org.modules.finance) notFound();

  const [invoices, clients, config, templates, brand] = await Promise.all([
    listInvoices(orgSlug),
    listClients(orgSlug),
    loadOrgInvoiceConfig(orgSlug),
    ensureDefaultInvoiceTemplates(orgSlug),
    resolveInvoiceBrand(orgSlug),
  ]);
  const paidTotals = await listInvoicePaidTotals(orgSlug, invoices);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const defaultDueOn =
    config.defaultDueDays > 0 ? dueOnFromDays(config.defaultDueDays) : undefined;
  const base = `/${orgSlug}/invoices`;
  const today = new Date().toISOString().slice(0, 10);

  const rows: Row[] = invoices.map((invoice) => {
    const status = invoiceDisplayStatus(invoice, today);
    const total = invoiceSubtotalMinor(invoice.lines);
    const paid = paidTotals.get(invoice.id) ?? BigInt(0);
    const balance =
      status === "void" || status === "draft" ? BigInt(0) : total > paid ? total - paid : BigInt(0);
    return { invoice, status, total, paid, balance };
  });

  const filter: Filter = FILTERS.some((item) => item.id === query.status)
    ? (query.status as Filter)
    : "all";
  const matches = (row: Row, id: Filter) =>
    id === "all"
      ? true
      : id === "outstanding"
        ? OUTSTANDING.includes(row.status)
        : row.status === id;
  const filtered = rows.filter((row) => matches(row, filter));

  const outstanding = rows.filter((row) => OUTSTANDING.includes(row.status));
  const overdue = rows.filter((row) => row.status === "overdue");
  const drafts = rows.filter((row) => row.status === "draft");
  const collected = rows.filter((row) => row.status !== "void" && row.paid > BigInt(0));

  return (
    <WorkSurface>
      <StudioToolbar
        title="Invoices"
        subtitle="Draft, issue to ledger, then send"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <InvoiceSettingsDialog
              orgSlug={orgSlug}
              orgId={ctx.org.id}
              config={config}
              logoUrl={brand.logoUrl ?? null}
              templates={templates}
              canWrite={ctx.canWrite}
            />
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
      {rows.length > 0 ? (
        <FilterChips className="border-b border-border/40">
          {FILTERS.map((item) => {
            const count = rows.filter((row) => matches(row, item.id)).length;
            if (item.id !== "all" && item.id !== filter && count === 0) return null;
            return (
              <FilterChip
                key={item.id}
                href={item.id === "all" ? base : `${base}?status=${item.id}`}
                active={filter === item.id}
              >
                {item.label}
                <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
              </FilterChip>
            );
          })}
        </FilterChips>
      ) : null}
      <IndexBody>
        {rows.length > 0 ? (
          <SummaryStrip>
            <SummaryStat
              label="Outstanding"
              value={sumByCurrency(outstanding, (row) => row.balance)}
              hint={`${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"} awaiting payment`}
              tone="sky"
            />
            <SummaryStat
              label="Overdue"
              value={sumByCurrency(overdue, (row) => row.balance)}
              hint={
                overdue.length
                  ? `${overdue.length} past due · oldest ${formatDay(oldestDue(overdue) ?? today)}`
                  : "Nothing past due"
              }
              tone={overdue.length > 0 ? "rose" : "slate"}
            />
            <SummaryStat
              label="Collected"
              value={sumByCurrency(collected, (row) => row.paid)}
              hint={`Received against ${collected.length} invoice${collected.length === 1 ? "" : "s"}`}
              tone="emerald"
            />
            <SummaryStat
              label="Drafts"
              value={String(drafts.length)}
              hint={
                drafts.length
                  ? `${sumByCurrency(drafts, (row) => row.total)} not issued yet`
                  : `${rows.length} invoice${rows.length === 1 ? "" : "s"} in total`
              }
              tone={drafts.length > 0 ? "amber" : "slate"}
            />
          </SummaryStrip>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState
            fill
            title="No invoices yet"
            body="Create a draft, add lines, then issue to the ledger."
            actionHref={ctx.canWrite ? `${base}?new=1` : undefined}
            actionLabel={ctx.canWrite ? "New invoice" : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState fill title="Nothing here" body="No invoices match this filter." />
        ) : (
          <DenseListPanel
            columns={
              <>
                <span className="min-w-0 flex-1">Invoice</span>
                <span className="hidden w-28 lg:block">Issued</span>
                <span className="hidden w-32 md:block">Due</span>
                <span className="hidden w-32 xl:block">Sent</span>
                <span className="hidden w-28 text-right sm:block">Total</span>
                <span className="hidden w-36 text-right md:block">Balance</span>
                <span className="w-28 text-right">Status</span>
              </>
            }
            footer="Balances count payments recorded against each invoice's charges. Issued invoices are locked; void cancels their charges."
          >
            {filtered.map((row) => (
              <InvoiceRow
                key={row.invoice.id}
                row={row}
                href={`${base}/${row.invoice.id}`}
                client={clientName.get(row.invoice.clientId) ?? "Client"}
                today={today}
              />
            ))}
          </DenseListPanel>
        )}
      </IndexBody>
    </WorkSurface>
  );
}

function InvoiceRow({
  row,
  href,
  client,
  today,
}: {
  row: Row;
  href: string;
  client: string;
  today: string;
}) {
  const { invoice, status, total, paid, balance } = row;
  const money = (amountMinor: bigint) => formatMoney({ amountMinor, currency: invoice.currency });
  const billedName = invoice.billTo?.name?.trim();
  const itemCount = invoice.lines.length;
  const due = dueLabel(invoice.dueOn, status, today);
  const paidShare = total > BigInt(0) ? Number((paid * BigInt(100)) / total) : 0;

  return (
    <DenseRow>
      <DenseCell className="min-w-0 flex-1">
        <Link href={href} className="block min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm font-medium tabular-nums">
              {invoice.issuedAt ? invoice.number : "Draft"}
            </span>
            <span className="truncate text-sm text-foreground/80">{client}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[
              billedName && billedName !== client ? `Billed to ${billedName}` : null,
              invoice.reference ? `Ref ${invoice.reference}` : null,
              `${itemCount} item${itemCount === 1 ? "" : "s"}`,
              invoice.currency,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground md:hidden">
            <span className={cn(due.tone === "late" && "font-medium text-rose-600 dark:text-rose-400")}>
              {due.text}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {balance > BigInt(0) ? `${money(balance)} due` : money(total)}
            </span>
          </p>
        </Link>
      </DenseCell>
      <DenseCell width="hidden w-28 lg:block" className="text-xs text-muted-foreground">
        {invoice.issuedOn ? formatDay(invoice.issuedOn) : <span className="opacity-60">Not issued</span>}
      </DenseCell>
      <DenseCell width="hidden w-32 md:block" className="text-xs">
        <p className="text-foreground/90">{invoice.dueOn ? formatDay(invoice.dueOn) : "On receipt"}</p>
        {due.hint ? (
          <p
            className={cn(
              "mt-0.5",
              due.tone === "late"
                ? "font-medium text-rose-600 dark:text-rose-400"
                : due.tone === "soon"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground",
            )}
          >
            {due.hint}
          </p>
        ) : null}
      </DenseCell>
      <DenseCell width="hidden w-32 xl:block" className="text-xs">
        {invoice.sentAt ? (
          <span className="inline-flex items-center gap-1.5 text-foreground/90">
            <Mail className="size-3 text-muted-foreground" />
            {formatDay(invoice.sentAt.slice(0, 10))}
          </span>
        ) : invoice.issuedAt && status !== "void" ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <Send className="size-3" />
            Not sent yet
          </span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </DenseCell>
      <DenseCell align="right" width="hidden w-28 sm:block" className="text-sm tabular-nums">
        <span className={cn(status === "void" && "text-muted-foreground line-through")}>
          {money(total)}
        </span>
      </DenseCell>
      <DenseCell align="right" width="hidden w-36 md:block" className="text-xs">
        {status === "draft" || status === "void" ? (
          <span className="text-muted-foreground/60">—</span>
        ) : status === "paid" || balance === BigInt(0) ? (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            Paid{invoice.paidAt ? ` ${formatDay(invoice.paidAt.slice(0, 10))}` : ""}
          </span>
        ) : (
          <div className="ml-auto grid w-full max-w-[8.5rem] gap-1">
            <span className="font-semibold text-foreground tabular-nums">{money(balance)}</span>
            <span className="h-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-emerald-500/80"
                style={{ width: `${Math.min(100, paidShare)}%` }}
              />
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {paid > BigInt(0) ? `${money(paid)} paid` : "Nothing paid yet"}
            </span>
          </div>
        )}
      </DenseCell>
      <DenseCell align="right" width="w-28">
        <StatusChip tone={STATUS_TONE[status]}>{INVOICE_DISPLAY_LABELS[status]}</StatusChip>
      </DenseCell>
    </DenseRow>
  );
}

const STATUS_TONE: Record<
  InvoiceDisplayStatus,
  "paid" | "overdue" | "cancelled" | "planning" | "partial" | "due" | "active"
> = {
  draft: "planning",
  issued: "active",
  sent: "due",
  partially_paid: "partial",
  paid: "paid",
  overdue: "overdue",
  void: "cancelled",
};

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function dueLabel(dueOn: string | null, status: InvoiceDisplayStatus, today: string) {
  const open = OUTSTANDING.includes(status);
  if (!dueOn) return { text: "Due on receipt", hint: null, tone: "muted" as const };
  const text = `Due ${formatDay(dueOn)}`;
  if (!open) return { text, hint: null, tone: "muted" as const };
  const days = daysBetween(today, dueOn);
  if (days < 0) return { text: `${-days}d overdue`, hint: `${-days}d overdue`, tone: "late" as const };
  if (days === 0) return { text: "Due today", hint: "Due today", tone: "soon" as const };
  if (days <= 7) return { text, hint: `in ${days}d`, tone: "soon" as const };
  return { text, hint: `in ${days}d`, tone: "muted" as const };
}

function oldestDue(rows: Row[]) {
  return rows
    .map((row) => row.invoice.dueOn)
    .filter((due): due is string => Boolean(due))
    .sort()[0];
}

function sumByCurrency(rows: Row[], pick: (row: Row) => bigint) {
  const sums = new Map<InvoiceRecord["currency"], bigint>();
  for (const row of rows) {
    sums.set(row.invoice.currency, (sums.get(row.invoice.currency) ?? BigInt(0)) + pick(row));
  }
  const parts = [...sums.entries()]
    .filter(([, amount]) => amount > BigInt(0))
    .map(([currency, amountMinor]) => formatMoney({ amountMinor, currency }));
  return parts.length ? parts.join(" · ") : "—";
}
