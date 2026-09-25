import type { InvoiceBrand } from "@/modules/invoices/settings";
import { invoiceBreakdown, invoiceTaxByRate, lineTotalMinor } from "@/modules/invoices/totals";
import type { InvoiceExtraField, InvoiceRecord } from "@/modules/invoices/types";
import { amountInWords } from "@/modules/invoices/words";
import { formatMoney } from "@/shared/money";

export type InvoicePartyLineKind = "contact" | "address" | "email" | "phone" | "website";

export type InvoicePartyLine = { kind: InvoicePartyLineKind; text: string };

export type InvoiceParty = {
  label: string;
  name: string;
  lines: InvoicePartyLine[];
  facts: InvoiceExtraField[];
};

export type InvoiceViewLine = {
  id: string;
  index: number;
  title: string;
  detail: string;
  quantity: string;
  rate: string;
  discount: string | null;
  tax: string | null;
  amount: string;
};

export type InvoiceView = {
  accent: string;
  layout: InvoiceBrand["layout"];
  logoUrl: string | null;
  orgName: string;
  number: string;
  meta: { label: string; value: string }[];
  billedBy: InvoiceParty;
  billedTo: InvoiceParty;
  lines: InvoiceViewLine[];
  hasDiscount: boolean;
  hasTax: boolean;
  totals: { label: string; value: string }[];
  total: string;
  paid: string | null;
  balanceDue: string;
  balanceLabel: string;
  amountWords: string;
  notes: string | null;
  paymentDetails: string | null;
  terms: string | null;
  footer: string;
  stamp: "Paid" | "Void" | null;
};

function day(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function partyLines(
  entries: [InvoicePartyLineKind, string | null | undefined][],
): InvoicePartyLine[] {
  return entries
    .map(([kind, value]) => ({ kind, text: value?.trim() ?? "" }))
    .filter((line) => line.text);
}

function compact(values: (string | null | undefined)[]) {
  return values.map((value) => value?.trim() ?? "").filter(Boolean);
}

function quantityLabel(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/0+$/, "");
}

function rateLabel(bps: number) {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function buildInvoiceView({
  invoice,
  clientName,
  brand,
  paidMinor = BigInt(0),
}: {
  invoice: InvoiceRecord;
  clientName: string;
  brand: InvoiceBrand;
  paidMinor?: bigint;
}): InvoiceView {
  const money = (amountMinor: bigint) => formatMoney({ amountMinor, currency: invoice.currency });
  const business = brand.business;
  const website = business.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const bill = invoice.billTo;
  const breakdown = invoiceBreakdown(invoice.lines);
  const taxes = invoiceTaxByRate(invoice.lines);
  const balance = breakdown.totalMinor > paidMinor ? breakdown.totalMinor - paidMinor : BigInt(0);

  const billedBy: InvoiceParty = {
    label: "Billed by",
    name: business.legalName || brand.orgName,
    lines: brand.showBusinessDetails
      ? partyLines([
          ["address", business.address],
          ["email", business.email],
          ["phone", business.phone],
          ["website", website],
        ])
      : [],
    facts: brand.showBusinessDetails
      ? [
          ...(business.taxId ? [{ label: "Tax ID", value: business.taxId }] : []),
          ...business.extras,
        ]
      : [],
  };

  const billedTo: InvoiceParty = {
    label: "Billed to",
    name: bill?.name || clientName,
    lines: partyLines([
      ["contact", bill?.contactName],
      ["address", bill?.address],
      ["email", bill?.email],
      ["phone", bill?.phone],
    ]),
    facts: [...(bill?.taxId ? [{ label: "Tax ID", value: bill.taxId }] : []), ...(bill?.extras ?? [])],
  };

  const meta = [
    { label: "Invoice no.", value: invoice.number },
    { label: "Issue date", value: day(invoice.issuedOn) ?? "On issue" },
    { label: "Due date", value: day(invoice.dueOn) ?? "On receipt" },
    ...(invoice.reference ? [{ label: "Reference", value: invoice.reference }] : []),
  ];

  const hasDiscount = invoice.lines.some((line) => line.discountMinor > BigInt(0));
  const hasTax = invoice.lines.some((line) => line.taxBps > 0);
  const lines = invoice.lines.map((line, index) => {
    const [title, ...rest] = line.description.split("\n");
    return {
      id: line.id,
      index: index + 1,
      title: title?.trim() || "Item",
      detail: rest.join("\n").trim(),
      quantity: quantityLabel(line.quantity),
      rate: money(line.unitAmountMinor),
      discount: hasDiscount
        ? line.discountMinor > BigInt(0)
          ? `-${money(line.discountMinor)}`
          : "-"
        : null,
      tax: hasTax ? (line.taxBps > 0 ? rateLabel(line.taxBps) : "-") : null,
      amount: money(lineTotalMinor(line)),
    };
  });

  const totals: InvoiceView["totals"] = [
    { label: "Subtotal", value: money(breakdown.subtotalMinor) },
    ...(breakdown.discountMinor > BigInt(0)
      ? [{ label: "Discount", value: `-${money(breakdown.discountMinor)}` }]
      : []),
    ...taxes.map((tax) => ({ label: `Tax (${rateLabel(tax.bps)})`, value: money(tax.taxMinor) })),
  ];

  const footer = compact([
    business.legalName || brand.orgName,
    brand.showBusinessDetails ? business.email : null,
    brand.showBusinessDetails ? website : null,
  ]).join("  ·  ");

  return {
    accent: brand.accentHex || "#1d4ed8",
    layout: brand.layout,
    logoUrl: brand.logoUrl ?? null,
    orgName: brand.orgName,
    number: invoice.number,
    meta,
    billedBy,
    billedTo,
    lines,
    hasDiscount,
    hasTax,
    totals,
    total: money(breakdown.totalMinor),
    balanceDue: money(balance),
    balanceLabel: paidMinor > BigInt(0) ? "Balance due" : "Amount due",
    amountWords: amountInWords(breakdown.totalMinor, invoice.currency),
    notes: invoice.memo?.trim() || null,
    paymentDetails: invoice.paymentInstructions?.trim() || null,
    terms: invoice.terms?.trim() || null,
    footer,
    stamp: invoice.status === "paid" ? "Paid" : invoice.status === "void" ? "Void" : null,
    paid: paidMinor > BigInt(0) ? `-${money(paidMinor)}` : null,
  };
}
