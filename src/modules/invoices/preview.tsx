import type { CSSProperties } from "react";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import { invoiceSubtotalMinor, lineTotalMinor } from "@/modules/invoices/totals";
import type { InvoiceRecord } from "@/modules/invoices/types";
import { formatMoney } from "@/shared/money";
import { cn } from "@/lib/utils";

export function InvoicePreview({
  invoice,
  clientName,
  brand,
  className,
}: {
  invoice: InvoiceRecord;
  clientName: string;
  brand: InvoiceBrand;
  className?: string;
}) {
  const total = invoiceSubtotalMinor(invoice.lines);
  const accent = brand.accentHex || "#1d4ed8";

  if (brand.layout === "minimal") {
    return (
      <article
        className={cn(
          "flex min-h-[36rem] flex-col rounded-[1.75rem] bg-white p-8 shadow-sm ring-1 ring-border/40 sm:min-h-[40rem] sm:p-10",
          className,
        )}
      >
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: accent }}>
              Invoice
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
              {invoice.number}
            </p>
          </div>
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-9 w-auto object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">{brand.orgName}</p>
          )}
        </header>
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase">Bill to</p>
            <p className="mt-1 font-medium">{clientName}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase">Issued</p>
            <p className="mt-1">{invoice.issuedOn ?? "-"}</p>
            <p className="mt-3 text-[11px] text-muted-foreground uppercase">Due</p>
            <p className="mt-1">{invoice.dueOn ?? "-"}</p>
          </div>
        </div>
        <LineTable invoice={invoice} headClassName="border-border/50" />
        <p className="mt-6 text-right text-lg font-semibold tabular-nums" style={{ color: accent }}>
          Total {formatMoney({ amountMinor: total, currency: invoice.currency })}
        </p>
        <Notes invoice={invoice} />
      </article>
    );
  }

  if (brand.layout === "bold") {
    return (
      <article
        className={cn(
          "flex min-h-[36rem] flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-border/40 sm:min-h-[40rem]",
          className,
        )}
      >
        <div
          className="flex items-center justify-between gap-4 px-8 py-7 text-white sm:px-10"
          style={{ backgroundColor: accent }}
        >
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase">Invoice</p>
            <p className="mt-1 font-heading text-2xl font-semibold">{invoice.number}</p>
          </div>
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-9 w-auto object-contain brightness-0 invert" />
          ) : (
            <p className="text-sm font-medium">{brand.orgName}</p>
          )}
        </div>
        <div className="flex flex-1 flex-col px-8 py-8 sm:px-10">
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase">From</p>
              <p className="mt-1 font-medium">{brand.orgName}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase">Bill to</p>
              <p className="mt-1 font-medium">{clientName}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase">Dates</p>
              <p className="mt-1 text-sm">Issued {invoice.issuedOn ?? "-"}</p>
              <p className="text-sm">Due {invoice.dueOn ?? "-"}</p>
            </div>
          </div>
          <LineTable invoice={invoice} headClassName="border-b-2" headStyle={{ borderColor: accent }} />
          <div
            className="mt-6 ml-auto max-w-[12rem] rounded-2xl border-2 px-4 py-3 text-right"
            style={{ borderColor: accent }}
          >
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Amount due</p>
            <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: accent }}>
              {formatMoney({ amountMinor: total, currency: invoice.currency })}
            </p>
          </div>
          <Notes invoice={invoice} />
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "relative flex min-h-[36rem] flex-col overflow-hidden rounded-[1.75rem] bg-white p-8 shadow-sm ring-1 ring-border/40 sm:min-h-[40rem] sm:p-10",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: accent }} />
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 pt-2">
        <div>
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="mb-3 h-9 w-auto object-contain" />
          ) : (
            <p className="font-heading text-lg font-semibold" style={{ color: accent }}>
              {brand.orgName}
            </p>
          )}
          <p className="font-heading text-3xl font-semibold tracking-tight">Invoice</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{invoice.number}</p>
          <p className="mt-1 text-sm text-muted-foreground">Issued {invoice.issuedOn ?? "-"}</p>
          <p className="text-sm text-muted-foreground">Due {invoice.dueOn ?? "-"}</p>
        </div>
      </header>
      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase">From</p>
          <p className="mt-1 font-medium">{brand.orgName}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground uppercase">Bill to</p>
          <p className="mt-1 font-medium">{clientName}</p>
        </div>
      </div>
      <LineTable
        invoice={invoice}
        headClassName="rounded-xl px-2"
        headStyle={{ backgroundColor: `${accent}14` }}
      />
      <p className="mt-6 text-right text-lg font-semibold tabular-nums" style={{ color: accent }}>
        Total {formatMoney({ amountMinor: total, currency: invoice.currency })}
      </p>
      <Notes invoice={invoice} />
    </article>
  );
}

function LineTable({
  invoice,
  headClassName,
  headStyle,
}: {
  invoice: InvoiceRecord;
  headClassName?: string;
  headStyle?: CSSProperties;
}) {
  return (
    <div className="min-h-[14rem] flex-1 overflow-x-auto sm:min-h-[16rem]">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr
            className={cn(
              "border-b border-border/40 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase",
              headClassName,
            )}
            style={headStyle}
          >
            <th className="px-2 py-2.5 font-semibold">Description</th>
            <th className="px-2 py-2.5 text-right font-semibold">Qty</th>
            <th className="px-2 py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-2 py-10 text-center text-muted-foreground">
                No lines yet
              </td>
            </tr>
          ) : (
            invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-border/25">
                <td className="px-2 py-2.5 font-medium">{line.description}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                  {line.quantity}
                </td>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                  {formatMoney({
                    amountMinor: lineTotalMinor(line),
                    currency: invoice.currency,
                  })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Notes({ invoice }: { invoice: InvoiceRecord }) {
  if (!invoice.memo && !invoice.terms) {
    return <div className="mt-auto pt-8" />;
  }
  return (
    <div className="mt-auto space-y-4 border-t border-border/30 pt-6">
      {invoice.memo ? (
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Memo
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{invoice.memo}</p>
        </div>
      ) : null}
      {invoice.terms ? (
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Terms
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {invoice.terms}
          </p>
        </div>
      ) : null}
    </div>
  );
}
