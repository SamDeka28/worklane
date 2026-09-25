import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import type { InvoiceRecord } from "@/modules/invoices/types";
import { buildInvoiceView, type InvoiceParty, type InvoiceView } from "@/modules/invoices/view-model";

type PdfProps = {
  invoice: InvoiceRecord;
  clientName: string;
  brand: InvoiceBrand;
  paidMinor?: bigint;
};

const INK = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const BAND = "#f8fafc";

/** The built-in Helvetica only covers WinAnsi, so swap glyphs it can't draw. */
function t(value: string) {
  return value.replace(/₹\s?/g, "Rs. ").replace(/−/g, "-");
}

function tint(hex: string, amount: number) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * (1 - amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function InvoicePdfDocument({ invoice, clientName, brand, paidMinor }: PdfProps) {
  const view = buildInvoiceView({ invoice, clientName, brand, paidMinor });
  const { accent, layout } = view;
  const soft = tint(accent, 0.08);

  return (
    <Document title={`Invoice ${view.number}`} author={view.orgName}>
      <Page size="A4" style={s.page}>
        {layout === "classic" ? <View style={[s.topBar, { backgroundColor: accent }]} fixed /> : null}
        <Header view={view} />

        <View style={s.body}>
          <Meta view={view} soft={soft} />

          <View style={s.parties}>
            <Party party={view.billedBy} accent={accent} />
            <Party party={view.billedTo} accent={accent} />
          </View>

          <Lines view={view} soft={soft} />

          <View style={s.summary} wrap={false}>
            <View style={s.summaryLeft}>
              <Text style={s.label}>Amount in words</Text>
              <Text style={s.words}>{view.amountWords}</Text>
              {view.paymentDetails ? (
                <View style={[s.payBox, { borderLeftColor: accent }]}>
                  <Text style={[s.label, { color: accent }]}>Payment details</Text>
                  <Text style={s.blockText}>{t(view.paymentDetails)}</Text>
                </View>
              ) : null}
              {view.notes ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={s.label}>Notes</Text>
                  <Text style={s.blockText}>{t(view.notes)}</Text>
                </View>
              ) : null}
            </View>
            <Totals view={view} />
          </View>

          {view.terms ? (
            <View style={s.terms} wrap={false}>
              <Text style={s.label}>Terms & conditions</Text>
              <Text style={[s.blockText, { color: MUTED, fontSize: 8.5 }]}>{t(view.terms)}</Text>
            </View>
          ) : null}
        </View>

        {view.stamp ? (
          <Text
            style={[
              s.stamp,
              view.stamp === "Paid"
                ? { color: "#059669", borderColor: "#059669" }
                : { color: "#e11d48", borderColor: "#e11d48" },
            ]}
          >
            {view.stamp.toUpperCase()}
          </Text>
        ) : null}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${view.footer}   ·   ${view.number}   ·   Page ${pageNumber} of ${totalPages}`
          }
        />
        {layout === "classic" ? (
          <View style={[s.bottomBar, { backgroundColor: accent }]} fixed />
        ) : null}
      </Page>
    </Document>
  );
}

function Logo({ view, light }: { view: InvoiceView; light?: boolean }) {
  if (view.logoUrl) {
    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
    const image = <Image src={view.logoUrl} style={s.logo} />;
    return light ? <View style={s.logoCard}>{image}</View> : image;
  }
  return <Text style={[s.orgName, light ? { color: "#fff" } : {}]}>{view.orgName}</Text>;
}

function Header({ view }: { view: InvoiceView }) {
  if (view.layout === "bold") {
    return (
      <View style={[s.banner, { backgroundColor: view.accent }]}>
        <Logo view={view} light />
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.bannerTitle}>INVOICE</Text>
          <Text style={s.bannerNumber}># {view.number}</Text>
        </View>
      </View>
    );
  }
  const minimal = view.layout === "minimal";
  return (
    <View style={s.header}>
      <Logo view={view} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={minimal ? [s.minimalTitle, { color: view.accent }] : s.title}>INVOICE</Text>
        <Text style={minimal ? s.minimalNumber : s.number}># {view.number}</Text>
      </View>
    </View>
  );
}

function Meta({ view, soft }: { view: InvoiceView; soft: string }) {
  const items = view.meta.filter((item) => item.label !== "Invoice no.");
  const minimal = view.layout === "minimal";
  return (
    <View style={[s.meta, minimal ? s.metaMinimal : {}]}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[s.metaCell, minimal ? {} : { backgroundColor: BAND }, index > 0 ? s.metaDivider : {}]}
        >
          <Text style={s.label}>{item.label}</Text>
          <Text style={s.metaValue}>{t(item.value)}</Text>
        </View>
      ))}
      <View style={[s.metaCell, s.metaDivider, minimal ? {} : { backgroundColor: soft }]}>
        <Text style={[s.label, { color: view.accent }]}>{view.balanceLabel}</Text>
        <Text style={[s.metaValue, { color: view.accent, fontSize: 12, fontWeight: 700 }]}>
          {t(view.balanceDue)}
        </Text>
      </View>
    </View>
  );
}

function Party({ party, accent }: { party: InvoiceParty; accent: string }) {
  return (
    <View style={s.party}>
      <Text style={[s.label, { color: accent }]}>{party.label}</Text>
      <Text style={s.partyName}>{t(party.name)}</Text>
      {party.lines.map((line, index) => (
        <Text key={index} style={s.partyLine}>
          {t(line)}
        </Text>
      ))}
      {party.facts.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          {party.facts.map((fact, index) => (
            <View key={`${fact.label}-${index}`} style={s.fact}>
              {fact.label ? <Text style={s.factLabel}>{t(fact.label)}</Text> : null}
              <Text style={s.factValue}>{t(fact.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Lines({ view, soft }: { view: InvoiceView; soft: string }) {
  const headBg =
    view.layout === "bold" ? view.accent : view.layout === "classic" ? soft : undefined;
  const headColor =
    view.layout === "bold" ? "#fff" : view.layout === "classic" ? view.accent : INK;
  const headText = [s.headText, { color: headColor }];
  return (
    <View style={s.table}>
      <View
        style={[
          s.row,
          s.head,
          headBg ? { backgroundColor: headBg, borderBottomWidth: 0 } : s.headMinimal,
        ]}
        fixed
      >
        <Text style={[s.colIdx, ...headText]}>#</Text>
        <Text style={[s.colDesc, ...headText]}>Item & description</Text>
        <Text style={[s.colQty, ...headText]}>Qty</Text>
        <Text style={[s.colRate, ...headText]}>Rate</Text>
        {view.hasDiscount ? <Text style={[s.colSmall, ...headText]}>Discount</Text> : null}
        {view.hasTax ? <Text style={[s.colSmall, ...headText]}>Tax</Text> : null}
        <Text style={[s.colAmt, ...headText]}>Amount</Text>
      </View>
      {view.lines.map((line) => (
        <View key={line.id} style={s.row} wrap={false}>
          <Text style={[s.colIdx, { color: FAINT }]}>{line.index}</Text>
          <View style={s.colDesc}>
            <Text style={s.itemTitle}>{t(line.title)}</Text>
            {line.detail ? <Text style={s.itemDetail}>{t(line.detail)}</Text> : null}
          </View>
          <Text style={s.colQty}>{line.quantity}</Text>
          <Text style={s.colRate}>{t(line.rate)}</Text>
          {line.discount !== null ? <Text style={s.colSmall}>{t(line.discount)}</Text> : null}
          {line.tax !== null ? <Text style={s.colSmall}>{line.tax}</Text> : null}
          <Text style={[s.colAmt, { color: INK, fontWeight: 700 }]}>{t(line.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

function Totals({ view }: { view: InvoiceView }) {
  const minimal = view.layout === "minimal";
  return (
    <View style={s.totals}>
      {view.totals.map((row) => (
        <View key={row.label} style={s.totalRow}>
          <Text style={{ color: MUTED }}>{row.label}</Text>
          <Text>{t(row.value)}</Text>
        </View>
      ))}
      <View style={[s.totalRow, s.totalStrong]}>
        <Text style={{ color: INK, fontWeight: 700 }}>Total</Text>
        <Text style={{ color: INK, fontWeight: 700 }}>{t(view.total)}</Text>
      </View>
      {view.paid ? (
        <View style={s.totalRow}>
          <Text style={{ color: "#047857" }}>Amount paid</Text>
          <Text style={{ color: "#047857" }}>{t(view.paid)}</Text>
        </View>
      ) : null}
      <View
        style={[
          s.dueBox,
          minimal
            ? { borderTopWidth: 2, borderTopColor: INK, paddingHorizontal: 0 }
            : { backgroundColor: view.accent },
        ]}
      >
        <Text style={[s.dueLabel, minimal ? { color: INK } : { color: "#fff" }]}>
          {view.balanceLabel.toUpperCase()}
        </Text>
        <Text style={[s.dueValue, minimal ? { color: view.accent } : { color: "#fff" }]}>
          {t(view.balanceDue)}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    paddingBottom: 56,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: BODY,
    lineHeight: 1.35,
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 44,
    paddingTop: 40,
  },
  logo: { width: 120, height: 42, objectFit: "contain" },
  logoCard: { backgroundColor: "#ffffff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  orgName: { fontSize: 15, fontWeight: 700, color: INK },
  title: { fontSize: 24, letterSpacing: 3, color: INK, fontWeight: 700 },
  number: { marginTop: 4, fontSize: 10, color: MUTED },
  minimalTitle: { fontSize: 10, letterSpacing: 4, fontWeight: 700 },
  minimalNumber: { marginTop: 3, fontSize: 17, color: INK, fontWeight: 700 },
  banner: {
    paddingHorizontal: 44,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTitle: { color: "#fff", fontSize: 22, letterSpacing: 4, fontWeight: 700 },
  bannerNumber: { color: "#fff", fontSize: 10, marginTop: 4, opacity: 0.85 },
  body: { paddingHorizontal: 44 },
  meta: {
    flexDirection: "row",
    marginTop: 20,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
  },
  metaMinimal: { borderWidth: 0, borderTopWidth: 1, borderBottomWidth: 1, borderRadius: 0 },
  metaCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  metaDivider: { borderLeftWidth: 1, borderLeftColor: LINE },
  metaValue: { fontSize: 10, color: INK, fontWeight: 700, marginTop: 2 },
  label: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: MUTED,
    fontWeight: 700,
  },
  parties: { flexDirection: "row", gap: 28, marginTop: 22 },
  party: { flex: 1 },
  partyName: { fontSize: 11.5, fontWeight: 700, color: INK, marginTop: 4, marginBottom: 2 },
  partyLine: { fontSize: 9, color: "#475569", marginBottom: 1 },
  fact: { flexDirection: "row", marginBottom: 1 },
  factLabel: { fontSize: 8.5, color: MUTED, width: 62 },
  factValue: { fontSize: 8.5, color: INK, flex: 1 },
  table: { marginTop: 22 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  head: { paddingVertical: 7, borderRadius: 2 },
  headMinimal: { borderTopWidth: 1.5, borderTopColor: INK, borderBottomWidth: 1.5, borderBottomColor: INK },
  headText: { fontSize: 7, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 },
  colIdx: { width: 18 },
  colDesc: { flex: 3.4, paddingRight: 8 },
  colQty: { flex: 0.6, textAlign: "right" },
  colRate: { flex: 1.3, textAlign: "right" },
  colSmall: { flex: 1, textAlign: "right" },
  colAmt: { flex: 1.4, textAlign: "right" },
  itemTitle: { color: INK, fontWeight: 700 },
  itemDetail: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  summary: { flexDirection: "row", gap: 28, marginTop: 16 },
  summaryLeft: { flex: 1 },
  words: { fontSize: 9, color: INK, marginTop: 2, fontStyle: "italic" },
  payBox: {
    marginTop: 12,
    borderLeftWidth: 3,
    backgroundColor: BAND,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  blockText: { fontSize: 8.8, lineHeight: 1.45, color: BODY, marginTop: 3 },
  totals: { width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalStrong: { borderTopWidth: 1, borderTopColor: LINE, marginTop: 3, paddingTop: 5 },
  dueBox: {
    marginTop: 8,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dueLabel: { fontSize: 7.5, letterSpacing: 1.2, fontWeight: 700 },
  dueValue: { fontSize: 13, fontWeight: 700 },
  terms: { marginTop: 22, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10 },
  stamp: {
    position: "absolute",
    top: 150,
    right: 56,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 4,
    borderWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 2,
    transform: "rotate(-14deg)",
    opacity: 0.7,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: FAINT,
    textAlign: "center",
  },
});

export async function renderInvoicePdfBuffer(input: PdfProps): Promise<Buffer> {
  const instance = pdf(
    <InvoicePdfDocument
      invoice={input.invoice}
      clientName={input.clientName}
      brand={input.brand}
      paidMinor={input.paidMinor}
    />,
  );
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
