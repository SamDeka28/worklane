import { INVOICE_LAYOUTS, type InvoiceLayout } from "@/modules/invoices/settings";

/** How each invoice look is built. Preview, PDF and thumbnails all read from this. */
export type InvoiceLayoutSpec = {
  label: string;
  description: string;
  header: "plain" | "tint" | "band" | "centered" | "block" | "letterhead" | "ribbon";
  band: "accent" | "ink";
  title: "large" | "small";
  topBar: boolean;
  bottomBar: boolean;
  sideBar: boolean;
  meta: "boxed" | "rules";
  tableHead: "tint" | "accent" | "ink" | "rules" | "fine" | "underline";
  due: "accent" | "ink" | "rule" | "outline";
  serif: boolean;
};

export const INVOICE_INK = "#0f172a";

export const INVOICE_LAYOUT_SPECS: Record<InvoiceLayout, InvoiceLayoutSpec> = {
  classic: {
    label: "Classic",
    description: "Accent bars, tinted table header",
    header: "plain",
    band: "accent",
    title: "large",
    topBar: true,
    bottomBar: true,
    sideBar: false,
    meta: "boxed",
    tableHead: "tint",
    due: "accent",
    serif: false,
  },
  minimal: {
    label: "Minimal",
    description: "Typographic, no fills",
    header: "plain",
    band: "accent",
    title: "small",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "rules",
    tableHead: "rules",
    due: "rule",
    serif: false,
  },
  bold: {
    label: "Bold",
    description: "Solid accent header band",
    header: "band",
    band: "accent",
    title: "large",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "boxed",
    tableHead: "accent",
    due: "accent",
    serif: false,
  },
  modern: {
    label: "Modern",
    description: "Soft tinted header, accent underlines",
    header: "tint",
    band: "accent",
    title: "large",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "boxed",
    tableHead: "underline",
    due: "accent",
    serif: false,
  },
  elegant: {
    label: "Elegant",
    description: "Centred serif with fine rules",
    header: "centered",
    band: "accent",
    title: "small",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "rules",
    tableHead: "fine",
    due: "rule",
    serif: true,
  },
  studio: {
    label: "Studio",
    description: "Charcoal header with an accent edge",
    header: "band",
    band: "ink",
    title: "large",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "boxed",
    tableHead: "ink",
    due: "ink",
    serif: false,
  },
  corporate: {
    label: "Corporate",
    description: "Logo left, accent title block right",
    header: "block",
    band: "accent",
    title: "large",
    topBar: false,
    bottomBar: true,
    sideBar: false,
    meta: "boxed",
    tableHead: "accent",
    due: "accent",
    serif: false,
  },
  swiss: {
    label: "Swiss",
    description: "Black type, strong rules, no colour blocks",
    header: "plain",
    band: "ink",
    title: "large",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "rules",
    tableHead: "rules",
    due: "ink",
    serif: false,
  },
  edge: {
    label: "Edge",
    description: "Accent stripe down the left edge",
    header: "plain",
    band: "accent",
    title: "large",
    topBar: false,
    bottomBar: false,
    sideBar: true,
    meta: "boxed",
    tableHead: "underline",
    due: "accent",
    serif: false,
  },
  letterhead: {
    label: "Letterhead",
    description: "Centred letterhead with double rule",
    header: "letterhead",
    band: "accent",
    title: "small",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "boxed",
    tableHead: "tint",
    due: "accent",
    serif: false,
  },
  ribbon: {
    label: "Ribbon",
    description: "Accent pill title, outlined totals",
    header: "ribbon",
    band: "accent",
    title: "small",
    topBar: false,
    bottomBar: false,
    sideBar: false,
    meta: "rules",
    tableHead: "fine",
    due: "outline",
    serif: false,
  },
};

/** Quick accent swatches offered next to the colour picker. */
export const INVOICE_ACCENT_PRESETS = [
  { name: "Blue", hex: "#1d4ed8" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Amber", hex: "#b45309" },
  { name: "Emerald", hex: "#047857" },
  { name: "Teal", hex: "#0f766e" },
  { name: "Slate", hex: "#334155" },
  { name: "Black", hex: "#111111" },
] as const;

export function invoiceLayoutSpec(layout: string): InvoiceLayoutSpec {
  return INVOICE_LAYOUT_SPECS[asInvoiceLayout(layout)];
}

export function asInvoiceLayout(value: unknown): InvoiceLayout {
  return typeof value === "string" && (INVOICE_LAYOUTS as readonly string[]).includes(value)
    ? (value as InvoiceLayout)
    : "classic";
}
