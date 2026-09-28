export type SignatureMode = "studio" | "custom" | "none";

/** Upper bound on a stored signature document, as JSON. */
export const SIGNATURE_MAX_BYTES = 20_000;

/** Placeholders filled from the sender when the signature is added. */
export const SIGNATURE_FIELDS = [
  { key: "my_name", label: "Your name", group: "you" },
  { key: "my_title", label: "Your job title", group: "you" },
  { key: "my_email", label: "Your email", group: "you" },
  { key: "my_phone", label: "Your phone", group: "you" },
  { key: "my_location", label: "Your location", group: "you" },
  { key: "my_address", label: "Your address", group: "you" },
  { key: "org_name", label: "Studio name", group: "studio" },
  { key: "org_legal_name", label: "Studio legal name", group: "studio" },
  { key: "org_email", label: "Studio email", group: "studio" },
  { key: "org_phone", label: "Studio phone", group: "studio" },
  { key: "org_website", label: "Studio website", group: "studio" },
  { key: "org_address", label: "Studio address", group: "studio" },
  { key: "org_tax_id", label: "Studio tax ID", group: "studio" },
] as const;

export const SIGNATURE_FIELD_GROUPS = [
  { id: "you", label: "You" },
  { id: "studio", label: "Studio" },
] as const;

export const SIGNATURE_FONTS = [
  { label: "Sans serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Fixed width", value: "'Courier New', Courier, monospace" },
  { label: "Wide", value: "Verdana, Geneva, sans-serif" },
] as const;

export const SIGNATURE_SIZES = [
  { label: "Small", value: "11px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "16px" },
  { label: "Huge", value: "22px" },
] as const;

/** Where the studio adds signatures. Set by owners and admins. */
export type SignatureModule = "leads" | "emails";

/** A rich-text signature, as the editor's document JSON. */
export type SignatureNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
  content?: SignatureNode[];
};

export type StudioSignature = {
  doc: SignatureNode | null;
  allowOverride: boolean;
  useInLeads: boolean;
  useInEmails: boolean;
};

export type PersonalSignature = { mode: SignatureMode; doc: SignatureNode | null };

export type SignatureSender = {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  address: string | null;
  orgName: string;
  org: {
    legalName: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    taxId: string;
  };
};

/** A signature filled in for one sender: HTML for the email, text for its plain part. */
export type RenderedSignature = { html: string; text: string };

const BLOCKS = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "link", "textStyle"]);
const FONT_VALUES = new Set<string>(SIGNATURE_FONTS.map((font) => font.value));
const FIELD_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(value: unknown) {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href) && href.length <= 2000) return href;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(href)) return `mailto:${href}`;
  return null;
}

function safeImageSrc(value: unknown) {
  return typeof value === "string" && /^https:\/\/[^\s"'<>]+$/i.test(value) && value.length <= 2000
    ? value
    : null;
}

function safeColor(value: unknown) {
  if (typeof value !== "string") return null;
  const color = value.trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) || /^rgba?\(\s*[\d\s.,%]+\)$/i.test(color) ? color : null;
}

function safeSize(value: unknown) {
  return typeof value === "string" && /^\d{1,2}px$/.test(value) ? value : null;
}

function safeFont(value: unknown) {
  return typeof value === "string" && FONT_VALUES.has(value) ? value : null;
}

function safeAlign(value: unknown) {
  return value === "center" || value === "right" ? value : null;
}

/** Keeps only what the signature editor makes, so stored documents stay small and predictable. */
export function cleanSignatureDoc(input: unknown): SignatureNode | null {
  function clean(node: unknown, depth: number): SignatureNode | null {
    if (!node || typeof node !== "object" || depth > 8) return null;
    const raw = node as SignatureNode;
    if (raw.type === "text") {
      if (typeof raw.text !== "string" || !raw.text) return null;
      const marks = (raw.marks ?? [])
        .filter((mark) => MARKS.has(mark?.type))
        .map((mark) => {
          if (mark.type === "link") {
            const href = safeHref(mark.attrs?.href);
            return href ? { type: "link", attrs: { href } } : null;
          }
          if (mark.type === "textStyle") {
            const attrs: Record<string, string> = {};
            const color = safeColor(mark.attrs?.color);
            const fontSize = safeSize(mark.attrs?.fontSize);
            const fontFamily = safeFont(mark.attrs?.fontFamily);
            if (color) attrs.color = color;
            if (fontSize) attrs.fontSize = fontSize;
            if (fontFamily) attrs.fontFamily = fontFamily;
            return Object.keys(attrs).length ? { type: "textStyle", attrs } : null;
          }
          return { type: mark.type };
        })
        .filter((mark): mark is NonNullable<typeof mark> => mark !== null);
      return { type: "text", text: raw.text.slice(0, 2000), ...(marks.length ? { marks } : {}) };
    }
    if (raw.type === "hardBreak" || raw.type === "horizontalRule") return { type: raw.type };
    if (raw.type === "image") {
      const src = safeImageSrc(raw.attrs?.src);
      if (!src) return null;
      const width = Number(raw.attrs?.width);
      return {
        type: "image",
        attrs: {
          src,
          alt: typeof raw.attrs?.alt === "string" ? raw.attrs.alt.slice(0, 200) : "",
          ...(Number.isFinite(width) && width > 0 ? { width: Math.min(Math.round(width), 600) } : {}),
        },
      };
    }
    if (raw.type !== "doc" && !BLOCKS.has(raw.type)) return null;
    const content = (raw.content ?? [])
      .map((child) => clean(child, depth + 1))
      .filter((child): child is SignatureNode => child !== null);
    const align = safeAlign(raw.attrs?.textAlign);
    return {
      type: raw.type === "heading" ? "paragraph" : raw.type,
      ...(align ? { attrs: { textAlign: align } } : {}),
      ...(content.length ? { content } : {}),
    };
  }
  const doc = clean(input, 0);
  if (!doc || doc.type !== "doc" || isEmptySignature(doc)) return null;
  return JSON.stringify(doc).length <= SIGNATURE_MAX_BYTES ? doc : null;
}

function nodeText(node: SignatureNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "image") return "image";
  return (node.content ?? []).map(nodeText).join("");
}

export function isEmptySignature(doc: SignatureNode | null | undefined) {
  return !doc || !nodeText(doc).trim();
}

function senderValues(sender: SignatureSender): Record<string, string> {
  return {
    my_name: sender.name,
    my_title: sender.title ?? "",
    my_email: sender.email ?? "",
    my_phone: sender.phone ?? "",
    my_location: sender.location ?? "",
    my_address: sender.address ?? "",
    org_name: sender.orgName,
    org_legal_name: sender.org.legalName || sender.orgName,
    org_email: sender.org.email,
    org_phone: sender.org.phone,
    org_website: sender.org.website,
    org_address: sender.org.address,
    org_tax_id: sender.org.taxId,
  };
}

function hasField(node: SignatureNode): boolean {
  if (node.type === "text") return /\{\{\s*[a-z_]+\s*\}\}/.test(node.text ?? "");
  return (node.content ?? []).some(hasField);
}

/** Fills fields; an empty one takes a separator next to it along, so "{{my_title}} · Studio" reads "Studio". */
function fill(text: string, values: Record<string, string>) {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    if (value.trim()) continue;
    out = out
      .replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}\\s*[·|,\\-–—]\\s*`, "g"), "")
      .replace(new RegExp(`\\s*[·|,\\-–—]\\s*\\{\\{\\s*${key}\\s*\\}\\}`, "g"), "");
  }
  return out.replace(FIELD_PATTERN, (match, key: string) => (key in values ? values[key] : match));
}

function filledText(node: SignatureNode, values: Record<string, string>): string {
  if (node.type === "text") return fill(node.text ?? "", values);
  if (node.type === "image") return "image";
  return (node.content ?? []).map((child) => filledText(child, values)).join("");
}

/** A line whose fields all came out empty, like a phone line for someone without a phone. */
function emptiedByFields(node: SignatureNode, values: Record<string, string>) {
  return hasField(node) && !filledText(node, values).replace(/[\s·|,\-–—:]/g, "");
}

function textHtml(node: SignatureNode, values: Record<string, string>) {
  let html = escapeHtml(fill(node.text ?? "", values)).replace(/\r?\n/g, "<br>");
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") html = `<strong>${html}</strong>`;
    else if (mark.type === "italic") html = `<em>${html}</em>`;
    else if (mark.type === "underline") html = `<u>${html}</u>`;
    else if (mark.type === "strike") html = `<s>${html}</s>`;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (href) html = `<a href="${escapeHtml(href)}" style="color:#1a73e8">${html}</a>`;
    } else if (mark.type === "textStyle") {
      const styles = [
        safeColor(mark.attrs?.color) && `color:${safeColor(mark.attrs?.color)}`,
        safeSize(mark.attrs?.fontSize) && `font-size:${safeSize(mark.attrs?.fontSize)}`,
        safeFont(mark.attrs?.fontFamily) && `font-family:${safeFont(mark.attrs?.fontFamily)}`,
      ].filter(Boolean);
      if (styles.length) html = `<span style="${escapeHtml(styles.join(";"))}">${html}</span>`;
    }
  }
  return html;
}

function nodeHtml(node: SignatureNode, values: Record<string, string>): string {
  const inner = () => (node.content ?? []).map((child) => nodeHtml(child, values)).join("");
  switch (node.type) {
    case "doc":
      return (node.content ?? [])
        .filter((child) => !emptiedByFields(child, values))
        .map((child) => nodeHtml(child, values))
        .join("");
    case "paragraph": {
      const align = safeAlign(node.attrs?.textAlign);
      const body = inner();
      return `<div${align ? ` style="text-align:${align}"` : ""}>${body || "<br>"}</div>`;
    }
    case "bulletList":
    case "orderedList": {
      const tag = node.type === "bulletList" ? "ul" : "ol";
      const items = (node.content ?? [])
        .filter((child) => !emptiedByFields(child, values))
        .map((child) => nodeHtml(child, values))
        .join("");
      return items ? `<${tag} style="margin:0;padding-left:20px">${items}</${tag}>` : "";
    }
    case "listItem":
      return `<li>${(node.content ?? [])
        .map((child) =>
          child.type === "paragraph"
            ? (child.content ?? []).map((part) => nodeHtml(part, values)).join("")
            : nodeHtml(child, values),
        )
        .join("<br>")}</li>`;
    case "text":
      return textHtml(node, values);
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return `<hr style="border:0;border-top:1px solid #d0d7de;margin:8px 0">`;
    case "image": {
      const src = safeImageSrc(node.attrs?.src);
      if (!src) return "";
      const width = Number(node.attrs?.width);
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${
        Number.isFinite(width) && width > 0 ? ` width="${Math.round(width)}"` : ""
      } style="max-width:100%;height:auto;border:0">`;
    }
    default:
      return "";
  }
}

function nodePlain(node: SignatureNode, values: Record<string, string>): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? [])
        .filter((child) => !emptiedByFields(child, values))
        .map((child) => nodePlain(child, values))
        .join("\n");
    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .filter((child) => !emptiedByFields(child, values))
        .map((child, index) =>
          `${node.type === "orderedList" ? `${index + 1}.` : "-"} ${nodePlain(child, values)}`,
        )
        .join("\n");
    case "listItem":
      return (node.content ?? []).map((child) => nodePlain(child, values)).join(" ");
    case "text": {
      const text = fill(node.text ?? "", values);
      const href = node.marks?.find((mark) => mark.type === "link")?.attrs?.href;
      const url = typeof href === "string" ? href.replace(/^mailto:|^tel:/, "") : null;
      return url && url !== text ? `${text} (${url})` : text;
    }
    case "hardBreak":
      return "\n";
    case "horizontalRule":
      return "---";
    case "image":
      return "";
    default:
      return (node.content ?? []).map((child) => nodePlain(child, values)).join("");
  }
}

/** Fills in the sender's details and turns the signature into email-safe HTML and plain text. */
export function renderSignature(
  doc: SignatureNode | null,
  sender: SignatureSender,
): RenderedSignature | null {
  if (isEmptySignature(doc)) return null;
  const values = senderValues(sender);
  const text = nodePlain(doc!, values)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  const html = nodeHtml(doc!, values);
  if (!text && !html.includes("<img")) return null;
  return { html, text };
}

/** The signature a member's emails get: theirs, the studio's, or none. */
export function pickSignature(
  studio: StudioSignature | null,
  personal: PersonalSignature | null,
): SignatureNode | null {
  const own = studio?.allowOverride !== false ? personal : null;
  if (own?.mode === "none") return null;
  if (own?.mode === "custom" && !isEmptySignature(own.doc)) return own.doc;
  return isEmptySignature(studio?.doc) ? null : studio!.doc;
}

/** Whether the studio adds signatures to emails sent from this module. */
export function signatureOnIn(studio: StudioSignature | null, module: SignatureModule) {
  if (!studio) return true;
  return module === "leads" ? studio.useInLeads : studio.useInEmails;
}
