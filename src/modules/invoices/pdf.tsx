import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdf } from "@react-pdf/renderer";
import type { InvoiceBrand } from "@/modules/invoices/settings";
import { lineTotalMinor } from "@/modules/invoices/totals";
import type { InvoiceRecord } from "@/modules/invoices/types";
import { formatMoney, type IsoCurrency } from "@/shared/money";

function money(amountMinor: bigint, currency: IsoCurrency) {
  return formatMoney({ amountMinor, currency });
}

function invoiceTotal(invoice: InvoiceRecord) {
  return invoice.lines.reduce(
    (sum, line) =>
      sum +
      lineTotalMinor({
        quantity: line.quantity,
        unitAmountMinor: line.unitAmountMinor,
        taxBps: line.taxBps,
        discountMinor: line.discountMinor,
      }),
    BigInt(0),
  );
}

export function InvoicePdfDocument({
  invoice,
  clientName,
  brand,
}: {
  invoice: InvoiceRecord;
  clientName: string;
  brand: InvoiceBrand;
}) {
  const total = invoiceTotal(invoice);
  const accent = brand.accentHex || "#1d4ed8";
  const layout = brand.layout;

  if (layout === "minimal") {
    return (
      <Document>
        <Page size="A4" style={minimal.page}>
          <View style={minimal.header}>
            <View>
              <Text style={[minimal.kicker, { color: accent }]}>Invoice</Text>
              <Text style={minimal.number}>{invoice.number}</Text>
            </View>
            {brand.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
              <Image src={brand.logoUrl} style={minimal.logo} />
            ) : (
              <Text style={minimal.org}>{brand.orgName}</Text>
            )}
          </View>
          <View style={minimal.metaRow}>
            <View style={{ flex: 1 }}>
              <Text style={minimal.label}>Bill to</Text>
              <Text style={minimal.value}>{clientName}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={minimal.label}>Issued</Text>
              <Text style={minimal.value}>{invoice.issuedOn ?? "-"}</Text>
              <Text style={[minimal.label, { marginTop: 8 }]}>Due</Text>
              <Text style={minimal.value}>{invoice.dueOn ?? "-"}</Text>
            </View>
          </View>
          <View style={minimal.table}>
            <View style={[minimal.row, minimal.head]}>
              <Text style={minimal.colDesc}>Description</Text>
              <Text style={minimal.colQty}>Qty</Text>
              <Text style={minimal.colAmt}>Amount</Text>
            </View>
            {invoice.lines.map((line) => (
              <View key={line.id} style={minimal.row}>
                <Text style={minimal.colDesc}>{line.description}</Text>
                <Text style={minimal.colQty}>{line.quantity}</Text>
                <Text style={minimal.colAmt}>
                  {money(lineTotalMinor(line), invoice.currency)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[minimal.total, { color: accent }]}>
            Total {money(total, invoice.currency)}
          </Text>
          {invoice.memo ? <Text style={minimal.note}>{invoice.memo}</Text> : null}
          {invoice.terms ? <Text style={minimal.terms}>{invoice.terms}</Text> : null}
        </Page>
      </Document>
    );
  }

  if (layout === "bold") {
    return (
      <Document>
        <Page size="A4" style={bold.page}>
          <View style={[bold.banner, { backgroundColor: accent }]}>
            <View>
              <Text style={bold.bannerTitle}>INVOICE</Text>
              <Text style={bold.bannerNumber}>{invoice.number}</Text>
            </View>
            {brand.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
              <Image src={brand.logoUrl} style={bold.logo} />
            ) : (
              <Text style={bold.bannerOrg}>{brand.orgName}</Text>
            )}
          </View>
          <View style={bold.body}>
            <View style={bold.metaRow}>
              <View style={{ flex: 1 }}>
                <Text style={bold.label}>From</Text>
                <Text style={bold.value}>{brand.orgName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={bold.label}>Bill to</Text>
                <Text style={bold.value}>{clientName}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={bold.label}>Dates</Text>
                <Text style={bold.value}>Issued {invoice.issuedOn ?? "-"}</Text>
                <Text style={bold.value}>Due {invoice.dueOn ?? "-"}</Text>
              </View>
            </View>
            <View style={bold.table}>
              <View style={[bold.row, bold.head, { borderBottomColor: accent }]}>
                <Text style={bold.colDesc}>Description</Text>
                <Text style={bold.colQty}>Qty</Text>
                <Text style={bold.colAmt}>Amount</Text>
              </View>
              {invoice.lines.map((line) => (
                <View key={line.id} style={bold.row}>
                  <Text style={bold.colDesc}>{line.description}</Text>
                  <Text style={bold.colQty}>{line.quantity}</Text>
                  <Text style={bold.colAmt}>
                    {money(lineTotalMinor(line), invoice.currency)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[bold.totalBox, { borderColor: accent }]}>
              <Text style={bold.totalLabel}>Amount due</Text>
              <Text style={[bold.totalValue, { color: accent }]}>
                {money(total, invoice.currency)}
              </Text>
            </View>
            {invoice.memo ? <Text style={bold.note}>{invoice.memo}</Text> : null}
            {invoice.terms ? <Text style={bold.terms}>{invoice.terms}</Text> : null}
          </View>
        </Page>
      </Document>
    );
  }

  // classic
  return (
    <Document>
      <Page size="A4" style={classic.page}>
        <View style={[classic.accentBar, { backgroundColor: accent }]} />
        <View style={classic.header}>
          <View style={{ flex: 1 }}>
            {brand.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
              <Image src={brand.logoUrl} style={classic.logo} />
            ) : (
              <Text style={[classic.org, { color: accent }]}>{brand.orgName}</Text>
            )}
            <Text style={classic.title}>Invoice</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={classic.number}>{invoice.number}</Text>
            <Text style={classic.meta}>Issued {invoice.issuedOn ?? "-"}</Text>
            <Text style={classic.meta}>Due {invoice.dueOn ?? "-"}</Text>
          </View>
        </View>
        <View style={classic.parties}>
          <View style={{ flex: 1 }}>
            <Text style={classic.label}>From</Text>
            <Text style={classic.value}>{brand.orgName}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={classic.label}>Bill to</Text>
            <Text style={classic.value}>{clientName}</Text>
          </View>
        </View>
        <View style={classic.table}>
          <View style={[classic.row, classic.head, { backgroundColor: `${accent}14` }]}>
            <Text style={classic.colDesc}>Description</Text>
            <Text style={classic.colQty}>Qty</Text>
            <Text style={classic.colAmt}>Amount</Text>
          </View>
          {invoice.lines.map((line) => (
            <View key={line.id} style={classic.row}>
              <Text style={classic.colDesc}>{line.description}</Text>
              <Text style={classic.colQty}>{line.quantity}</Text>
              <Text style={classic.colAmt}>
                {money(lineTotalMinor(line), invoice.currency)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[classic.total, { color: accent }]}>
          Total {money(total, invoice.currency)}
        </Text>
        {invoice.memo ? (
          <View style={classic.block}>
            <Text style={classic.label}>Memo</Text>
            <Text style={classic.value}>{invoice.memo}</Text>
          </View>
        ) : null}
        {invoice.terms ? (
          <View style={classic.block}>
            <Text style={classic.label}>Terms</Text>
            <Text style={classic.terms}>{invoice.terms}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

const classic = StyleSheet.create({
  page: { padding: 40, paddingTop: 48, fontSize: 11, fontFamily: "Helvetica" },
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 8 },
  header: { flexDirection: "row", marginBottom: 24 },
  org: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 22, marginTop: 4 },
  logo: { width: 96, height: 36, objectFit: "contain" },
  number: { fontSize: 14, fontWeight: 700 },
  meta: { marginTop: 4, color: "#555" },
  parties: { flexDirection: "row", gap: 24, marginBottom: 20 },
  label: { fontSize: 9, textTransform: "uppercase", color: "#777", marginBottom: 4 },
  value: { fontSize: 12 },
  table: { marginTop: 8 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
  },
  head: { paddingVertical: 10 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colAmt: { flex: 1.5, textAlign: "right" },
  total: { marginTop: 16, textAlign: "right", fontSize: 14, fontWeight: 700 },
  block: { marginTop: 16 },
  terms: { fontSize: 10, color: "#555" },
});

const minimal = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  kicker: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  number: { fontSize: 20, marginTop: 4 },
  org: { fontSize: 12, color: "#444" },
  logo: { width: 88, height: 32, objectFit: "contain" },
  metaRow: { flexDirection: "row", gap: 24, marginBottom: 24 },
  label: { fontSize: 9, color: "#888", marginBottom: 2 },
  value: { fontSize: 12 },
  table: { marginTop: 4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 8,
  },
  head: { borderBottomColor: "#ccc" },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colAmt: { flex: 1.5, textAlign: "right" },
  total: { marginTop: 20, textAlign: "right", fontSize: 14 },
  note: { marginTop: 20, fontSize: 11 },
  terms: { marginTop: 8, fontSize: 10, color: "#666" },
});

const bold = StyleSheet.create({
  page: { padding: 0, fontSize: 11, fontFamily: "Helvetica" },
  banner: {
    paddingHorizontal: 36,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTitle: { color: "#fff", fontSize: 12, letterSpacing: 3 },
  bannerNumber: { color: "#fff", fontSize: 22, marginTop: 6 },
  bannerOrg: { color: "#fff", fontSize: 14 },
  logo: { width: 96, height: 36, objectFit: "contain" },
  body: { padding: 36 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 24 },
  label: { fontSize: 9, color: "#777", marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 11, marginBottom: 2 },
  table: { marginTop: 4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 9,
  },
  head: { borderBottomWidth: 2 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colAmt: { flex: 1.5, textAlign: "right" },
  totalBox: {
    marginTop: 20,
    alignSelf: "flex-end",
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 180,
  },
  totalLabel: { fontSize: 9, color: "#666", textTransform: "uppercase" },
  totalValue: { fontSize: 16, marginTop: 4 },
  note: { marginTop: 20 },
  terms: { marginTop: 8, fontSize: 10, color: "#555" },
});

export async function renderInvoicePdfBuffer(input: {
  invoice: InvoiceRecord;
  clientName: string;
  brand: InvoiceBrand;
}): Promise<Buffer> {
  const instance = pdf(
    <InvoicePdfDocument
      invoice={input.invoice}
      clientName={input.clientName}
      brand={input.brand}
    />,
  );
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
