import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { invoiceLayoutSpec } from "@/modules/invoices/layouts";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import type { InvoiceRecord } from "@/modules/invoices/types";
import {
  buildInvoiceView,
  type InvoiceParty,
  type InvoicePartyLineKind,
  type InvoiceView,
} from "@/modules/invoices/view-model";

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
  const { accent } = view;
  const spec = invoiceLayoutSpec(view.layout);
  const soft = tint(accent, 0.08);

  return (
    <Document title={`Invoice ${view.number}`} author={view.orgName}>
      <Page size="A4" style={[s.page, spec.serif ? { fontFamily: "Times-Roman" } : {}]}>
        {spec.topBar ? <View style={[s.topBar, { backgroundColor: accent }]} fixed /> : null}
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
        {spec.bottomBar ? (
          <View style={[s.bottomBar, { backgroundColor: accent }]} fixed />
        ) : null}
        {spec.sideBar ? <View style={[s.sideBar, { backgroundColor: accent }]} fixed /> : null}
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
  const spec = invoiceLayoutSpec(view.layout);
  const accent = view.accent;

  if (spec.header === "band") {
    return (
      <View>
        <View style={[s.banner, { backgroundColor: spec.band === "ink" ? INK : accent }]}>
          <Logo view={view} light />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.bannerTitle}>INVOICE</Text>
            <Text style={s.bannerNumber}># {view.number}</Text>
          </View>
        </View>
        {spec.band === "ink" ? <View style={{ height: 4, backgroundColor: accent }} /> : null}
      </View>
    );
  }

  if (spec.header === "block") {
    return (
      <View style={s.blockHeader}>
        <View style={{ justifyContent: "center", paddingTop: 34 }}>
          <Logo view={view} />
        </View>
        <View style={[s.titleBlock, { backgroundColor: accent }]}>
          <Text style={s.bannerTitle}>INVOICE</Text>
          <Text style={s.bannerNumber}># {view.number}</Text>
        </View>
      </View>
    );
  }

  if (spec.header === "letterhead") {
    return (
      <View style={s.letterhead}>
        <View style={{ alignItems: "center" }}>
          <Logo view={view} />
          {view.footer ? <Text style={s.letterheadLine}>{t(view.footer)}</Text> : null}
        </View>
        <View style={{ marginTop: 14, height: 1.75, backgroundColor: accent }} />
        <View style={{ marginTop: 2, height: 0.6, backgroundColor: accent }} />
        <View style={s.letterheadTitleRow}>
          <Text style={[s.minimalTitle, { color: accent }]}>INVOICE</Text>
          <Text style={[s.minimalNumber, { marginTop: 0 }]}># {view.number}</Text>
        </View>
      </View>
    );
  }

  if (spec.header === "ribbon") {
    return (
      <View style={s.header}>
        <View>
          <Text style={[s.ribbon, { backgroundColor: accent }]}>INVOICE</Text>
          <Text style={[s.minimalNumber, { marginTop: 8 }]}># {view.number}</Text>
        </View>
        <Logo view={view} />
      </View>
    );
  }

  if (spec.header === "centered") {
    return (
      <View style={s.centeredHeader}>
        <Logo view={view} />
        <View style={s.centeredTitleRow}>
          <View style={[s.centeredRule, { backgroundColor: accent }]} />
          <Text style={[s.centeredTitle, { color: accent }]}>INVOICE</Text>
          <View style={[s.centeredRule, { backgroundColor: accent }]} />
        </View>
        <Text style={s.minimalNumber}>No. {view.number}</Text>
      </View>
    );
  }

  const tinted = spec.header === "tint";
  const small = spec.title === "small";
  return (
    <View style={[s.header, tinted ? { backgroundColor: tint(accent, 0.07), paddingBottom: 24 } : {}]}>
      <Logo view={view} />
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={
            small ? [s.minimalTitle, { color: accent }] : [s.title, tinted ? { color: accent } : {}]
          }
        >
          INVOICE
        </Text>
        <Text style={small ? s.minimalNumber : s.number}># {view.number}</Text>
      </View>
    </View>
  );
}

function Meta({ view, soft }: { view: InvoiceView; soft: string }) {
  const items = view.meta.filter((item) => item.label !== "Invoice no.");
  const minimal = invoiceLayoutSpec(view.layout).meta === "rules";
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

/** Lucide outlines (24px grid), drawn as vectors so they stay crisp in the PDF. */
function PartyIcon({ kind, color }: { kind: InvoicePartyLineKind; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, fill: "none" } as const;
  return (
    <Svg viewBox="0 0 24 24" style={s.partyIcon}>
      {kind === "contact" ? (
        <>
          <Circle cx="12" cy="8" r="5" {...stroke} />
          <Path d="M20 21a8 8 0 0 0-16 0" {...stroke} />
        </>
      ) : kind === "address" ? (
        <>
          <Path
            d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
            {...stroke}
          />
          <Circle cx="12" cy="10" r="3" {...stroke} />
        </>
      ) : kind === "email" ? (
        <>
          <Rect x="2" y="4" width="20" height="16" rx="2" {...stroke} />
          <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" {...stroke} />
        </>
      ) : kind === "phone" ? (
        <Path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          {...stroke}
        />
      ) : (
        <>
          <Circle cx="12" cy="12" r="10" {...stroke} />
          <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" {...stroke} />
          <Path d="M2 12h20" {...stroke} />
        </>
      )}
    </Svg>
  );
}

function Party({ party, accent }: { party: InvoiceParty; accent: string }) {
  return (
    <View style={s.party}>
      <Text style={[s.label, { color: accent }]}>{party.label}</Text>
      <Text style={s.partyName}>{t(party.name)}</Text>
      {party.lines.map((line, index) => (
        <View key={index} style={s.partyLineRow}>
          <PartyIcon kind={line.kind} color={FAINT} />
          <Text style={s.partyLine}>{t(line.text)}</Text>
        </View>
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
  const head = invoiceLayoutSpec(view.layout).tableHead;
  const headBg =
    head === "accent" ? view.accent : head === "ink" ? INK : head === "tint" ? soft : undefined;
  const headColor =
    head === "accent" || head === "ink"
      ? "#fff"
      : head === "tint" || head === "underline"
        ? view.accent
        : INK;
  const headText = [s.headText, { color: headColor }];
  const headLines =
    head === "underline"
      ? { borderBottomWidth: 2, borderBottomColor: view.accent }
      : head === "fine"
        ? {
            borderTopWidth: 0.75,
            borderTopColor: view.accent,
            borderBottomWidth: 0.75,
            borderBottomColor: view.accent,
          }
        : s.headMinimal;
  return (
    <View style={s.table}>
      <View
        style={[
          s.row,
          s.head,
          headBg ? { backgroundColor: headBg, borderBottomWidth: 0 } : headLines,
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
  const due = invoiceLayoutSpec(view.layout).due;
  const minimal = due === "rule";
  const outline = due === "outline";
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
            : outline
              ? { borderWidth: 1.25, borderColor: view.accent }
              : { backgroundColor: due === "ink" ? INK : view.accent },
        ]}
      >
        <Text
          style={[
            s.dueLabel,
            minimal ? { color: INK } : outline ? { color: view.accent } : { color: "#fff" },
          ]}
        >
          {view.balanceLabel.toUpperCase()}
        </Text>
        <Text style={[s.dueValue, minimal || outline ? { color: view.accent } : { color: "#fff" }]}>
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
  title: { fontSize: 24, lineHeight: 1.2, letterSpacing: 3, color: INK, fontWeight: 700 },
  number: { marginTop: 6, fontSize: 10, lineHeight: 1.2, color: MUTED },
  minimalTitle: { fontSize: 10, letterSpacing: 4, fontWeight: 700 },
  minimalNumber: { marginTop: 3, fontSize: 17, lineHeight: 1.2, color: INK, fontWeight: 700 },
  banner: {
    paddingHorizontal: 44,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sideBar: { position: "absolute", top: 0, bottom: 0, left: 0, width: 6 },
  letterhead: { paddingHorizontal: 44, paddingTop: 36 },
  letterheadLine: { marginTop: 6, fontSize: 8, color: MUTED, lineHeight: 1.2 },
  letterheadTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 14,
  },
  ribbon: {
    alignSelf: "flex-start",
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 4,
    lineHeight: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 44 },
  titleBlock: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingHorizontal: 44,
    paddingTop: 40,
    paddingBottom: 18,
    borderBottomLeftRadius: 18,
  },
  centeredHeader: { alignItems: "center", paddingHorizontal: 44, paddingTop: 40 },
  centeredTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  centeredRule: { width: 40, height: 0.75 },
  centeredTitle: { fontSize: 9.5, letterSpacing: 5, fontWeight: 700 },
  bannerTitle: { color: "#fff", fontSize: 22, lineHeight: 1.2, letterSpacing: 4, fontWeight: 700 },
  bannerNumber: { color: "#fff", fontSize: 10, lineHeight: 1.2, marginTop: 6, opacity: 0.85 },
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
  partyLineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 1.5 },
  partyIcon: { width: 7, height: 7, marginTop: 2, marginRight: 4 },
  partyLine: { fontSize: 9, color: "#475569", flex: 1, lineHeight: 1.35 },
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
