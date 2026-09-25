import { Document, Image, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { JSONContent } from "@tiptap/core";

export type DocumentPdfSignature = {
  party: "client" | "studio";
  signerName: string;
  signerEmail: string;
  signatureText: string | null;
  signedAt: string;
  contentHash: string | null;
  ipAddress: string | null;
};

export type DocumentPdfInput = {
  title: string;
  orgName: string;
  clientName: string | null;
  versionNumber: number | null;
  content: JSONContent;
  signatures: DocumentPdfSignature[];
  /** Only the signature certificate page (sent alongside the signed copy). */
  certificateOnly?: boolean;
};

const INK = "#0f172a";
const BODY = "#1e293b";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const SOFT_LINE = "#e2e8f0";

const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** The built-in PDF fonts only cover WinAnsi, so swap or drop glyphs they can't draw. */
function clean(value: string) {
  return value
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[−‒]/g, "-")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/[✓✔]/g, "v")
    .replace(/[☐□]/g, "[ ]")
    .replace(/\u00a0/g, " ")
    .replace(/[^\n\t\x20-\xff]/g, (char) => (WIN_ANSI_EXTRAS.has(char) ? char : ""));
}

function px(value: unknown, fallback: number) {
  const match = typeof value === "string" ? /^([\d.]+)px$/.exec(value.trim()) : null;
  return match ? Math.max(6, Number(match[1]) * 0.75) : fallback;
}

function font(bold: boolean, italic: boolean) {
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function Inline({ nodes, bold = false }: { nodes: JSONContent[] | undefined; bold?: boolean }) {
  return (
    <>
      {(nodes ?? []).map((node, index) => {
        if (node.type === "hardBreak") return <Text key={index}>{"\n"}</Text>;
        if (node.type === "mention") {
          const label = String(node.attrs?.label ?? node.attrs?.id ?? "");
          return (
            <Text key={index} style={{ fontFamily: font(true, false) }}>
              {clean(label)}
            </Text>
          );
        }
        if (node.type !== "text" || !node.text) return null;
        const marks = node.marks ?? [];
        const has = (type: string) => marks.some((mark) => mark.type === type);
        const style: Style = {
          fontFamily: font(bold || has("bold"), has("italic")),
        };
        const decorations = [has("underline") && "underline", has("strike") && "line-through"].filter(
          Boolean,
        );
        if (decorations.length) style.textDecoration = decorations.join(" ") as Style["textDecoration"];
        for (const mark of marks) {
          if (mark.type === "textStyle") {
            if (mark.attrs?.color) style.color = String(mark.attrs.color);
            if (mark.attrs?.fontSize) style.fontSize = px(mark.attrs.fontSize, 10.5);
          }
          if (mark.type === "highlight") style.backgroundColor = String(mark.attrs?.color ?? "#fef9c3");
          if (mark.type === "code") style.fontFamily = "Courier";
        }
        const link = marks.find((mark) => mark.type === "link")?.attrs?.href;
        if (link) {
          return (
            <Link key={index} src={String(link)} style={{ ...style, color: "#1d4ed8" }}>
              {clean(node.text)}
            </Link>
          );
        }
        return (
          <Text key={index} style={style}>
            {clean(node.text)}
          </Text>
        );
      })}
    </>
  );
}

function align(node: JSONContent): Style {
  const value = node.attrs?.textAlign;
  return value === "center" || value === "right" || value === "justify" ? { textAlign: value } : {};
}

const HEADING_SIZE: Record<number, number> = { 1: 20, 2: 14.5, 3: 12, 4: 11 };

function Block({ node, depth = 0 }: { node: JSONContent; depth?: number }) {
  switch (node.type) {
    case "paragraph":
      return (
        <Text style={[s.paragraph, align(node)]}>
          {node.content?.length ? <Inline nodes={node.content} /> : " "}
        </Text>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      return (
        <Text
          style={[s.heading, { fontSize: HEADING_SIZE[level] ?? 12 }, align(node)]}
          minPresenceAhead={40}
        >
          <Inline nodes={node.content} bold />
        </Text>
      );
    }
    case "bulletList":
    case "orderedList":
    case "taskList": {
      const start = Number(node.attrs?.start ?? 1);
      return (
        <View style={s.list}>
          {(node.content ?? []).map((item, index) => {
            const marker =
              node.type === "orderedList"
                ? `${start + index}.`
                : node.type === "taskList"
                  ? item.attrs?.checked
                    ? "[x]"
                    : "[ ]"
                  : "•";
            return (
              <View key={index} style={s.listItem} wrap={false}>
                <Text style={s.marker}>{marker}</Text>
                <View style={{ flex: 1 }}>
                  {(item.content ?? []).map((child, childIndex) => (
                    <Block key={childIndex} node={child} depth={depth + 1} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      );
    }
    case "blockquote":
      return (
        <View style={s.quote}>
          {(node.content ?? []).map((child, index) => (
            <Block key={index} node={child} depth={depth} />
          ))}
        </View>
      );
    case "horizontalRule":
      return <View style={s.rule} />;
    case "codeBlock":
      return (
        <Text style={s.code}>{clean((node.content ?? []).map((child) => child.text ?? "").join(""))}</Text>
      );
    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : null;
      if (!src || !/^https?:/.test(src)) return null;
      // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images have no alt attribute
      return <Image src={src} style={s.image} />;
    }
    case "table":
      return <Table node={node} />;
    default:
      return node.content?.length ? (
        <View>
          {node.content.map((child, index) => (
            <Block key={index} node={child} depth={depth} />
          ))}
        </View>
      ) : null;
  }
}

function Table({ node }: { node: JSONContent }) {
  const rows = node.content ?? [];
  return (
    <View style={s.table}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={s.row} wrap={false}>
          {(row.content ?? []).map((cell, cellIndex) => {
            const border = cell.attrs?.borderStyle as string | null | undefined;
            const cellStyle: Style = {
              flex: Number(cell.attrs?.colspan ?? 1),
              padding: border === "band" ? 12 : 6,
              backgroundColor: (cell.attrs?.backgroundColor as string | null) ?? undefined,
              color: (cell.attrs?.color as string | null) ?? undefined,
            };
            if (border === "bottom") {
              cellStyle.borderBottomWidth = 0.8;
              cellStyle.borderBottomColor = "#334155";
            } else if (border !== "none" && border !== "band") {
              cellStyle.borderWidth = 0.5;
              cellStyle.borderColor = SOFT_LINE;
            }
            return (
              <View key={cellIndex} style={cellStyle}>
                {(cell.content ?? []).map((child, index) => (
                  <Block key={index} node={child} />
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function SignatureCard({ signature, orgName, clientName }: {
  signature: DocumentPdfSignature;
  orgName: string;
  clientName: string | null;
}) {
  const label = signature.party === "studio" ? `For ${orgName}` : clientName ? `For ${clientName}` : "Client";
  return (
    <View style={s.sigCard} wrap={false}>
      <Text style={s.sigLabel}>{clean(label.toUpperCase())}</Text>
      <Text style={s.sigScript}>{clean(signature.signatureText ?? signature.signerName)}</Text>
      <View style={s.sigMeta}>
        <MetaRow label="Name" value={signature.signerName} />
        <MetaRow label="Email" value={signature.signerEmail} />
        <MetaRow label="Signed" value={new Date(signature.signedAt).toUTCString()} />
        <MetaRow
          label="Method"
          value={signature.party === "client" ? "Typed signature via secure client link" : "Typed signature by team member"}
        />
        {signature.ipAddress ? <MetaRow label="IP address" value={signature.ipAddress} /> : null}
        {signature.contentHash ? <MetaRow label="Fingerprint" value={signature.contentHash} mono /> : null}
      </View>
    </View>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, mono ? { fontFamily: "Courier", fontSize: 7.5 } : {}]}>{clean(value)}</Text>
    </View>
  );
}

export function DocumentPdf({
  title,
  orgName,
  clientName,
  versionNumber,
  content,
  signatures,
  certificateOnly = false,
}: DocumentPdfInput) {
  const fingerprint = signatures.find((sig) => sig.contentHash)?.contentHash ?? null;
  const footer = `${clean(title)}${versionNumber ? ` · v${versionNumber}` : ""}${fingerprint ? ` · ${fingerprint.slice(0, 16)}` : ""}`;
  const ordered = [...signatures].sort((a, b) =>
    a.party === b.party ? a.signedAt.localeCompare(b.signedAt) : a.party === "client" ? -1 : 1,
  );

  return (
    <Document
      title={clean(certificateOnly ? `Signature certificate - ${title}` : title)}
      author={clean(orgName)}
      creator="Worklane"
      producer="Worklane"
    >
      {certificateOnly ? null : (
        <Page size="A4" style={s.page}>
          {(content.content ?? []).map((node, index) => (
            <Block key={index} node={node} />
          ))}
          <Footer text={footer} />
        </Page>
      )}
      {ordered.length > 0 ? (
        <Page size="A4" style={s.page}>
          <Text style={s.certKicker}>SIGNATURE CERTIFICATE</Text>
          <Text style={s.certTitle}>{clean(title)}</Text>
          <Text style={s.certSub}>
            {clean(orgName)}
            {clientName ? ` and ${clean(clientName)}` : ""}
            {versionNumber ? ` · version ${versionNumber}` : ""}
          </Text>
          <Text style={s.certNote}>
            Each party signed the same locked copy of this document electronically. The fingerprint is a
            SHA-256 hash of the signed content; any change to the text would produce a different value.
          </Text>
          <View style={s.sigGrid}>
            {ordered.map((signature, index) => (
              <SignatureCard key={index} signature={signature} orgName={orgName} clientName={clientName} />
            ))}
          </View>
          <Footer text={footer} />
        </Page>
      ) : null}
    </Document>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <>
      <View style={s.footerRule} fixed />
      <Text style={[s.footerText, s.footerLeft]} fixed>
        {text}
      </Text>
    </>
  );
}

async function renderBuffer(input: DocumentPdfInput) {
  const blob = await pdf(<DocumentPdf {...input} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

function withoutImages(node: JSONContent): JSONContent {
  return {
    ...node,
    content: node.content?.filter((child) => child.type !== "image").map(withoutImages),
  };
}

export async function renderDocumentPdfBuffer(input: DocumentPdfInput): Promise<Buffer> {
  try {
    return await renderBuffer(input);
  } catch (error) {
    // Remote images (expired or private URLs) are the usual failure; retry without them.
    console.error("document pdf render failed, retrying without images", error);
    return renderBuffer({ ...input, content: withoutImages(input.content) });
  }
}

export function documentPdfFilename(title: string, suffix = "signed") {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "document"}-${suffix}.pdf`;
}

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 60,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: BODY,
  },
  paragraph: { marginBottom: 6 },
  heading: { color: INK, marginTop: 12, marginBottom: 6, lineHeight: 1.25 },
  list: { marginBottom: 6 },
  listItem: { flexDirection: "row", marginBottom: 2 },
  marker: { width: 18, color: MUTED },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: "#93c5fd",
    backgroundColor: "#f8fafc",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  rule: { borderBottomWidth: 0.6, borderBottomColor: LINE, marginVertical: 10 },
  code: {
    fontFamily: "Courier",
    fontSize: 9,
    backgroundColor: "#f1f5f9",
    padding: 8,
    marginBottom: 8,
  },
  image: { maxWidth: "100%", marginBottom: 8, objectFit: "contain" },
  table: { marginBottom: 10 },
  row: { flexDirection: "row" },
  footerRule: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    borderTopWidth: 0.5,
    borderTopColor: SOFT_LINE,
  },
  footerText: { position: "absolute", bottom: 26, fontSize: 7.5, color: MUTED, lineHeight: 1 },
  footerLeft: { left: 60, right: 60 },
  certKicker: { fontSize: 8, color: "#1e40af", fontFamily: "Helvetica-Bold", letterSpacing: 1.2 },
  certTitle: { fontSize: 18, color: INK, fontFamily: "Helvetica-Bold", marginTop: 6, lineHeight: 1.3 },
  certSub: { fontSize: 10, color: MUTED, marginTop: 4 },
  certNote: { fontSize: 8.5, color: MUTED, marginTop: 14, lineHeight: 1.5 },
  sigGrid: { marginTop: 24, gap: 18 },
  sigCard: {
    borderWidth: 0.6,
    borderColor: SOFT_LINE,
    borderRadius: 6,
    padding: 16,
  },
  sigLabel: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold", letterSpacing: 0.8 },
  sigScript: {
    fontFamily: "Times-Italic",
    fontSize: 28,
    lineHeight: 1.3,
    color: INK,
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.8,
    borderBottomColor: "#334155",
  },
  sigMeta: { marginTop: 10, gap: 2 },
  metaRow: { flexDirection: "row" },
  metaLabel: { width: 70, fontSize: 8.5, color: MUTED },
  metaValue: { flex: 1, fontSize: 8.5, color: BODY },
});
