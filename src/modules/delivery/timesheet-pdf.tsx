import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { formatHoursMillis } from "@/modules/delivery/ledger";
import { formatMajorInput, grossFromHours, type IsoCurrency } from "@/shared/money";

export type TimesheetPdfEntry = {
  workedOn: string;
  task: string;
  description: string;
  hoursMillis: number | null;
  hourlyRateMinor: bigint | null;
  fixedMinor: bigint | null;
};

function safeText(value: string) {
  return value.replace(/₹\s?/g, "Rs. ").replace(/−/g, "-");
}

function monthTitle(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function amountLabel(amountMinor: bigint, currency: IsoCurrency) {
  const symbol = currency === "INR" ? "Rs. " : "$";
  return `${symbol}${formatMajorInput(amountMinor, currency)}`;
}

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 48, paddingHorizontal: 42, fontFamily: "Helvetica", color: "#172b3a", fontSize: 9 },
  topLine: { height: 5, backgroundColor: "#0f8f83", marginBottom: 26 },
  brand: { fontSize: 8, color: "#0f8f83", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: 25, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  subtitle: { fontSize: 10, color: "#64748b", marginBottom: 20 },
  meta: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e2e8f0", paddingVertical: 12, marginBottom: 20 },
  metaItem: { flexGrow: 1, flexBasis: 0 },
  label: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  summary: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryCard: { flexGrow: 1, flexBasis: 0, padding: 12, backgroundColor: "#f1f7f6", borderRadius: 6 },
  summaryValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0b6e65" },
  tableHead: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, backgroundColor: "#172b3a", color: "#ffffff", borderRadius: 4 },
  headText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#e8edf1", minHeight: 30 },
  altRow: { backgroundColor: "#f8fafb" },
  date: { width: 68, flexShrink: 0 },
  description: { width: 250, flexShrink: 1, paddingRight: 8 },
  hours: { width: 42, flexShrink: 0, textAlign: "right" },
  rate: { width: 65, flexShrink: 0, textAlign: "right" },
  amount: { width: 70, flexShrink: 0, textAlign: "right", fontFamily: "Helvetica-Bold" },
  total: { flexDirection: "row", justifyContent: "flex-end", gap: 18, paddingTop: 12, marginTop: 2, borderTopWidth: 1.5, borderTopColor: "#172b3a" },
  totalLabel: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0b6e65" },
  empty: { padding: 18, textAlign: "center", color: "#64748b", borderBottomWidth: 1, borderBottomColor: "#e8edf1" },
  footer: { position: "absolute", bottom: 22, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#94a3b8" },
});

function TimesheetDocument({
  organizationName,
  projectName,
  clientName,
  month,
  currency,
  entries,
}: {
  organizationName: string;
  projectName: string;
  clientName: string;
  month: string;
  currency: IsoCurrency;
  entries: TimesheetPdfEntry[];
}) {
  const hoursMillis = entries.reduce((sum, entry) => sum + (entry.hoursMillis ?? 0), 0);
  const totalMinor = entries.reduce((sum, entry) => {
    if (entry.fixedMinor != null) return sum + entry.fixedMinor;
    if (entry.hoursMillis != null && entry.hourlyRateMinor != null) {
      return sum + grossFromHours(entry.hoursMillis / 1000, entry.hourlyRateMinor);
    }
    return sum;
  }, BigInt(0));

  return (
    <Document title={`${projectName} timesheet · ${monthTitle(month)}`} author={organizationName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topLine} />
        <Text style={styles.brand}>{safeText(organizationName)}</Text>
        <Text style={styles.title}>Monthly timesheet</Text>
        <Text style={styles.subtitle}>{monthTitle(month)} · Work delivered and billable time</Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}><Text style={styles.label}>Prepared for</Text><Text style={styles.metaValue}>{safeText(clientName)}</Text></View>
          <View style={styles.metaItem}><Text style={styles.label}>Project</Text><Text style={styles.metaValue}>{safeText(projectName)}</Text></View>
          <View style={styles.metaItem}><Text style={styles.label}>Period</Text><Text style={styles.metaValue}>{monthTitle(month)}</Text></View>
        </View>
        <View style={styles.summary} wrap={false}>
          <View style={styles.summaryCard}><Text style={styles.label}>Logged hours</Text><Text style={styles.summaryValue}>{formatHoursMillis(hoursMillis)} h</Text></View>
          <View style={styles.summaryCard}><Text style={styles.label}>Billable total · {currency}</Text><Text style={styles.summaryValue}>{amountLabel(totalMinor, currency)}</Text></View>
        </View>
        <View style={styles.tableHead} fixed>
          <Text style={[styles.headText, styles.date]}>Date</Text>
          <Text style={[styles.headText, styles.description]}>Work item / description</Text>
          <Text style={[styles.headText, styles.hours]}>Hours</Text>
          <Text style={[styles.headText, styles.rate]}>Rate</Text>
          <Text style={[styles.headText, styles.amount]}>Amount</Text>
        </View>
        {entries.length === 0 ? <Text style={styles.empty}>No work was logged during this month.</Text> : entries.map((entry, index) => {
          const amount = entry.fixedMinor != null
            ? entry.fixedMinor
            : entry.hoursMillis != null && entry.hourlyRateMinor != null
              ? grossFromHours(entry.hoursMillis / 1000, entry.hourlyRateMinor)
              : BigInt(0);
          return (
            <View key={`${entry.workedOn}-${index}`} style={[styles.row, index % 2 === 1 ? styles.altRow : {}]} wrap={false}>
              <Text style={styles.date}>{new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${entry.workedOn}T00:00:00Z`))}</Text>
              <Text style={styles.description}>
                {safeText([entry.task, entry.description].filter(Boolean).join(" · ") || "Work logged")}
              </Text>
              <Text style={styles.hours}>{entry.hoursMillis == null ? "—" : formatHoursMillis(entry.hoursMillis)}</Text>
              <Text style={styles.rate}>{entry.hourlyRateMinor == null ? "—" : amountLabel(entry.hourlyRateMinor, currency)}</Text>
              <Text style={styles.amount}>{amountLabel(amount, currency)}</Text>
            </View>
          );
        })}
        <View style={styles.total} wrap={false}>
          <Text style={styles.totalLabel}>Total · {formatHoursMillis(hoursMillis)} hours</Text>
          <Text style={styles.totalValue}>{amountLabel(totalMinor, currency)}</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text>{safeText(organizationName)} · {safeText(projectName)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderTimesheetPdfBuffer(input: {
  organizationName: string;
  projectName: string;
  clientName: string;
  month: string;
  currency: IsoCurrency;
  entries: TimesheetPdfEntry[];
}) {
  const blob = await pdf(<TimesheetDocument {...input} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
