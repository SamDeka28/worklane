import type { ReactNode } from "react";
import { Globe, Mail, MapPin, Phone, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { INVOICE_INK, invoiceLayoutSpec } from "@/modules/invoices/layouts";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import type { InvoiceRecord } from "@/modules/invoices/types";
import {
  buildInvoiceView,
  type InvoiceParty,
  type InvoicePartyLineKind,
  type InvoiceView,
} from "@/modules/invoices/view-model";

type PreviewProps = {
  invoice: InvoiceRecord;
  clientName: string;
  brand: InvoiceBrand;
  paidMinor?: bigint;
  className?: string;
};

function Label({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <p
      className="text-[9.5px] font-semibold tracking-[0.16em] text-slate-500 uppercase"
      style={accent ? { color: accent } : undefined}
    >
      {children}
    </p>
  );
}

export function InvoicePreview({ invoice, clientName, brand, paidMinor, className }: PreviewProps) {
  const view = buildInvoiceView({ invoice, clientName, brand, paidMinor });
  const { accent } = view;
  const spec = invoiceLayoutSpec(view.layout);

  return (
    <article
      data-theme="light"
      className={cn(
        "lane-paper relative flex min-h-[48rem] flex-col overflow-hidden rounded-[3px] bg-white text-[13px] leading-relaxed text-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_16px_48px_rgba(0,0,0,0.14)] ring-1 ring-black/5 sm:min-h-[62rem]",
        spec.serif && "font-serif [&_.font-heading]:font-serif",
        className,
      )}
    >
      <Header view={view} />

      <div className="flex flex-1 flex-col px-8 pb-8 sm:px-12">
        <MetaStrip view={view} />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:gap-10">
          <Party party={view.billedBy} accent={accent} />
          <Party party={view.billedTo} accent={accent} />
        </div>

        <LineTable view={view} />

        <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_17rem]">
          <div className="order-2 grid content-start gap-5 sm:order-1">
            <div>
              <Label>Amount in words</Label>
              <p className="mt-1 text-[12px] font-medium text-slate-800 italic">{view.amountWords}</p>
            </div>
            {view.paymentDetails ? (
              <div
                className="rounded-md border-l-[3px] bg-slate-50 px-4 py-3"
                style={{ borderLeftColor: accent }}
              >
                <Label accent={accent}>Payment details</Label>
                <p className="mt-1.5 text-[12px] whitespace-pre-wrap text-slate-700">
                  {view.paymentDetails}
                </p>
              </div>
            ) : null}
            {view.notes ? (
              <div>
                <Label>Notes</Label>
                <p className="mt-1 text-[12px] whitespace-pre-wrap text-slate-700">{view.notes}</p>
              </div>
            ) : null}
          </div>
          <Totals view={view} />
        </div>

        <div className="mt-auto pt-10">
          {view.terms ? (
            <div className="border-t border-slate-200 pt-4">
              <Label>Terms &amp; conditions</Label>
              <p className="mt-1 text-[11px] whitespace-pre-wrap text-slate-500">{view.terms}</p>
            </div>
          ) : null}
          <p className="mt-6 text-center text-[10.5px] text-slate-400">{view.footer}</p>
        </div>
      </div>

      {spec.bottomBar ? (
        <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: accent }} />
      ) : null}
      {spec.sideBar ? (
        <div className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: accent }} />
      ) : null}
      {view.stamp ? <Stamp label={view.stamp} /> : null}
    </article>
  );
}

function Logo({ view, invert }: { view: InvoiceView; invert?: boolean }) {
  if (view.logoUrl) {
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={view.logoUrl}
        alt={view.orgName}
        className="h-11 w-auto max-w-[11rem] object-contain"
      />
    );
    return invert ? (
      <span className="inline-flex shrink-0 rounded-xl bg-white px-3 py-2 shadow-sm">{image}</span>
    ) : (
      image
    );
  }
  return (
    <p className={cn("font-heading text-lg font-semibold tracking-tight", invert ? "text-white" : "text-slate-900")}>
      {view.orgName}
    </p>
  );
}

function Header({ view }: { view: InvoiceView }) {
  const spec = invoiceLayoutSpec(view.layout);
  const accent = view.accent;

  if (spec.header === "band") {
    return (
      <header
        className="text-white"
        style={{ backgroundColor: spec.band === "ink" ? INVOICE_INK : accent }}
      >
        <div className="flex items-center justify-between gap-6 px-8 py-9 sm:px-12">
          <Logo view={view} invert />
          <div className="text-right">
            <p className="font-heading text-3xl font-semibold tracking-[0.18em] uppercase">Invoice</p>
            <p className="mt-1 text-sm tabular-nums opacity-85"># {view.number}</p>
          </div>
        </div>
        {spec.band === "ink" ? <div className="h-1.5" style={{ backgroundColor: accent }} /> : null}
      </header>
    );
  }

  if (spec.header === "block") {
    return (
      <header className="flex items-stretch justify-between gap-6 pl-8 sm:pl-12">
        <div className="flex items-center pt-10 pb-2">
          <Logo view={view} />
        </div>
        <div
          className="flex flex-col justify-end rounded-bl-3xl px-8 pt-12 pb-6 text-right text-white sm:px-12"
          style={{ backgroundColor: accent }}
        >
          <p className="font-heading text-[1.75rem] leading-none font-semibold tracking-[0.18em] uppercase">
            Invoice
          </p>
          <p className="mt-2 text-sm tabular-nums opacity-85"># {view.number}</p>
        </div>
      </header>
    );
  }

  if (spec.header === "letterhead") {
    return (
      <header className="px-8 pt-10 sm:px-12">
        <div className="flex flex-col items-center text-center">
          <Logo view={view} />
          {view.footer ? <p className="mt-2 text-[11px] text-slate-500">{view.footer}</p> : null}
        </div>
        <div className="mt-5 border-t-2" style={{ borderColor: accent }} />
        <div className="mt-[3px] border-t" style={{ borderColor: accent }} />
        <div className="mt-5 flex items-baseline justify-between gap-6">
          <p
            className="font-heading text-[13px] font-semibold tracking-[0.3em] uppercase"
            style={{ color: accent }}
          >
            Invoice
          </p>
          <p className="font-heading text-xl font-semibold text-slate-900 tabular-nums"># {view.number}</p>
        </div>
      </header>
    );
  }

  if (spec.header === "ribbon") {
    return (
      <header className="px-8 pt-10 pb-2 sm:px-12 sm:pt-12">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span
              className="inline-flex items-center rounded-full px-4 py-1.5 font-heading text-[12px] font-semibold tracking-[0.3em] text-white uppercase"
              style={{ backgroundColor: accent }}
            >
              Invoice
            </span>
            <p className="mt-3 font-heading text-2xl font-semibold text-slate-900 tabular-nums">
              # {view.number}
            </p>
          </div>
          <Logo view={view} />
        </div>
      </header>
    );
  }

  if (spec.header === "centered") {
    return (
      <header className="px-8 pt-12 pb-2 text-center sm:px-12">
        <div className="flex justify-center">
          <Logo view={view} />
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <span className="h-px w-14" style={{ backgroundColor: accent }} />
          <p className="text-[12px] font-semibold tracking-[0.42em] uppercase" style={{ color: accent }}>
            Invoice
          </p>
          <span className="h-px w-14" style={{ backgroundColor: accent }} />
        </div>
        <p className="mt-1.5 text-xl font-semibold text-slate-900 tabular-nums">No. {view.number}</p>
      </header>
    );
  }

  const tint = spec.header === "tint";
  return (
    <header
      className={cn("relative px-8 pt-10 sm:px-12 sm:pt-12", tint ? "pb-8" : "pb-2")}
      style={tint ? { backgroundColor: `color-mix(in srgb, ${accent} 7%, white)` } : undefined}
    >
      {spec.topBar ? (
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: accent }} />
      ) : null}
      <div className="flex items-start justify-between gap-6">
        <Logo view={view} />
        <div className="text-right">
          <p
            className={cn(
              "font-heading font-semibold uppercase",
              spec.title === "small"
                ? "text-[13px] tracking-[0.3em]"
                : "text-[2rem] leading-none tracking-[0.14em] text-slate-900",
            )}
            style={spec.title === "small" || tint ? { color: accent } : undefined}
          >
            Invoice
          </p>
          <p
            className={cn(
              "tabular-nums",
              spec.title === "small"
                ? "mt-1 font-heading text-2xl font-semibold text-slate-900"
                : "mt-2 text-sm text-slate-500",
            )}
          >
            # {view.number}
          </p>
        </div>
      </div>
    </header>
  );
}

function MetaStrip({ view }: { view: InvoiceView }) {
  const items = view.meta.filter((item) => item.label !== "Invoice no.");
  const rules = invoiceLayoutSpec(view.layout).meta === "rules";
  return (
    <div
      className={cn(
        "mt-6 grid gap-px overflow-hidden rounded-md",
        rules ? "border-y border-slate-200" : "bg-slate-200 ring-1 ring-slate-200",
      )}
      style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className={cn("px-4 py-3", !rules && "bg-slate-50")}>
          <Label>{item.label}</Label>
          <p className="mt-0.5 text-[13px] font-semibold text-slate-900 tabular-nums">{item.value}</p>
        </div>
      ))}
      <div
        className="bg-white px-4 py-3"
        style={
          rules ? undefined : { backgroundColor: `color-mix(in srgb, ${view.accent} 8%, white)` }
        }
      >
        <Label accent={view.accent}>{view.balanceLabel}</Label>
        <p className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: view.accent }}>
          {view.balanceDue}
        </p>
      </div>
    </div>
  );
}

const PARTY_ICON: Record<InvoicePartyLineKind, LucideIcon> = {
  contact: UserRound,
  address: MapPin,
  email: Mail,
  phone: Phone,
  website: Globe,
};

function Party({ party, accent }: { party: InvoiceParty; accent: string }) {
  return (
    <div className="min-w-0">
      <Label accent={accent}>{party.label}</Label>
      <p className="mt-1.5 text-[15px] font-semibold text-slate-900">{party.name}</p>
      {party.lines.length > 0 ? (
        <ul className="mt-1 grid gap-0.5">
          {party.lines.map((line, index) => {
            const Icon = PARTY_ICON[line.kind];
            return (
              <li key={index} className="flex items-start gap-1.5 text-[12.5px] text-slate-600">
                <Icon
                  aria-label={line.kind}
                  className="mt-[4px] size-3 shrink-0 text-slate-400"
                  strokeWidth={1.75}
                />
                <span className="min-w-0 break-words whitespace-pre-line">{line.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {party.facts.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          {party.facts.map((fact, index) => (
            <div key={`${fact.label}-${index}`} className="contents">
              <dt className="text-slate-500">{fact.label || "·"}</dt>
              <dd className="font-medium break-words text-slate-800">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function LineTable({ view }: { view: InvoiceView }) {
  const head = invoiceLayoutSpec(view.layout).tableHead;
  const headStyle =
    head === "accent"
      ? { backgroundColor: view.accent, color: "#fff" }
      : head === "ink"
        ? { backgroundColor: INVOICE_INK, color: "#fff" }
        : head === "tint"
          ? { backgroundColor: `${view.accent}14`, color: view.accent }
          : head === "underline"
            ? { color: view.accent, borderBottomColor: view.accent }
            : head === "fine"
              ? { borderColor: view.accent }
              : undefined;
  const columns = 5 + (view.hasDiscount ? 1 : 0) + (view.hasTax ? 1 : 0);
  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-[12.5px]">
        <thead>
          <tr
            className={cn(
              "text-left text-[9.5px] font-semibold tracking-[0.12em] uppercase",
              head === "rules" && "border-y-2 border-slate-900 text-slate-900",
              head === "fine" && "border-y text-slate-900",
              head === "underline" && "border-b-2",
            )}
            style={headStyle}
          >
            <th className="w-8 py-2.5 pl-3 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">Item &amp; description</th>
            <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
            <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
            {view.hasDiscount ? <th className="px-3 py-2.5 text-right font-semibold">Discount</th> : null}
            {view.hasTax ? <th className="px-3 py-2.5 text-right font-semibold">Tax</th> : null}
            <th className="py-2.5 pr-3 pl-3 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.length === 0 ? (
            <tr>
              <td colSpan={columns} className="px-3 py-14 text-center text-slate-400">
                Add line items to see them here
              </td>
            </tr>
          ) : (
            view.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pl-3 text-slate-400 tabular-nums">{line.index}</td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-900">{line.title}</p>
                  {line.detail ? (
                    <p className="mt-0.5 text-[11.5px] whitespace-pre-line text-slate-500">{line.detail}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-3 text-right tabular-nums">{line.rate}</td>
                {line.discount !== null ? (
                  <td className="px-3 py-3 text-right tabular-nums">{line.discount}</td>
                ) : null}
                {line.tax !== null ? <td className="px-3 py-3 text-right tabular-nums">{line.tax}</td> : null}
                <td className="py-3 pr-3 pl-3 text-right font-semibold text-slate-900 tabular-nums">
                  {line.amount}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ view }: { view: InvoiceView }) {
  const due = invoiceLayoutSpec(view.layout).due;
  return (
    <div className="order-1 sm:order-2">
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[12.5px]">
        {view.totals.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="text-right tabular-nums">{row.value}</dd>
          </div>
        ))}
        <dt className="mt-1 border-t border-slate-200 pt-2 font-semibold text-slate-900">Total</dt>
        <dd className="mt-1 border-t border-slate-200 pt-2 text-right font-semibold text-slate-900 tabular-nums">
          {view.total}
        </dd>
        {view.paid ? (
          <>
            <dt className="text-emerald-700">Amount paid</dt>
            <dd className="text-right text-emerald-700 tabular-nums">{view.paid}</dd>
          </>
        ) : null}
      </dl>
      <div
        className={cn(
          "mt-3 flex items-center justify-between gap-4 rounded-md px-4 py-3",
          due === "rule" && "border-t-2 border-slate-900 px-0",
          due === "outline" && "border-[1.5px]",
          (due === "accent" || due === "ink") && "text-white",
        )}
        style={
          due === "rule"
            ? undefined
            : due === "outline"
              ? { borderColor: view.accent, color: view.accent }
              : { backgroundColor: due === "ink" ? INVOICE_INK : view.accent }
        }
      >
        <span className="text-[10px] font-semibold tracking-[0.16em] uppercase">{view.balanceLabel}</span>
        <span
          className="text-lg font-bold tabular-nums"
          style={due === "rule" || due === "outline" ? { color: view.accent } : undefined}
        >
          {view.balanceDue}
        </span>
      </div>
    </div>
  );
}

function Stamp({ label }: { label: "Paid" | "Void" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-40 right-12 rotate-[-14deg] rounded-md border-[3px] px-4 py-1 font-heading text-3xl font-bold tracking-[0.2em] uppercase opacity-75",
        label === "Paid" ? "border-emerald-600 text-emerald-600" : "border-rose-500 text-rose-500",
      )}
    >
      {label}
    </div>
  );
}
