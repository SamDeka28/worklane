"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { formatHoursMillis } from "@/modules/delivery/ledger";
import { formatMajorInput, grossFromHours } from "@/shared/money";

type TimesheetEntry = {
  workedOn: string;
  task: string;
  description: string;
  hoursMillis: number | null;
  hourlyRateMinor: string | null;
  fixedMinor: string | null;
};

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function MonthlyTimesheetExport({
  orgSlug,
  projectId,
  projectName,
  clientName,
  currency,
  entries,
}: {
  orgSlug: string;
  projectId: string;
  projectName: string;
  clientName: string;
  currency: "USD" | "INR";
  entries: TimesheetEntry[];
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const months = useMemo(
    () => [...new Set([currentMonth, ...entries.map((entry) => entry.workedOn.slice(0, 7))])].sort().reverse(),
    [currentMonth, entries],
  );
  const [month, setMonth] = useState(currentMonth);
  const [format, setFormat] = useState<"csv" | "pdf">("pdf");
  const [pending, setPending] = useState(false);
  const monthEntries = entries.filter((entry) => entry.workedOn.slice(0, 7) === month);

  async function download() {
    if (pending) return;
    setPending(true);
    const toastId = toast.loading(format === "pdf" ? "Preparing PDF…" : "Preparing CSV…");
    try {
      if (format === "pdf") {
        const response = await fetch(`/${orgSlug}/projects/${projectId}/timesheet/pdf?month=${month}`);
        if (!response.ok) throw new Error("Could not prepare the PDF. Please try again.");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-timesheet-${month}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded", { id: toastId });
        return;
      }
      const rows = monthEntries.map((entry) => {
        const hours = entry.hoursMillis == null ? "" : formatHoursMillis(entry.hoursMillis);
        const rate = entry.hourlyRateMinor == null
          ? ""
          : formatMajorInput(BigInt(entry.hourlyRateMinor), currency);
        const amountMinor = entry.fixedMinor != null
          ? BigInt(entry.fixedMinor)
          : entry.hoursMillis != null && entry.hourlyRateMinor != null
            ? grossFromHours(entry.hoursMillis / 1000, BigInt(entry.hourlyRateMinor))
            : BigInt(0);
        return [entry.workedOn, entry.task, entry.description, hours, rate, formatMajorInput(amountMinor, currency)];
      });
      const totalHoursMillis = monthEntries.reduce((sum, entry) => sum + (entry.hoursMillis ?? 0), 0);
      const totalMinor = monthEntries.reduce((sum, entry) => {
        if (entry.fixedMinor != null) return sum + BigInt(entry.fixedMinor);
        if (entry.hoursMillis != null && entry.hourlyRateMinor != null) {
          return sum + grossFromHours(entry.hoursMillis / 1000, BigInt(entry.hourlyRateMinor));
        }
        return sum;
      }, BigInt(0));
      const csv = [
        ["Monthly timesheet", monthLabel(month)],
        ["Client", clientName],
        ["Project", projectName],
        ["Currency", currency],
        [],
        ["Date", "Task", "Work description", "Hours", "Rate per hour", "Amount"],
        ...rows,
        [],
        ["Total hours", (totalHoursMillis / 1000).toFixed(3)],
        ["Total amount", formatMajorInput(totalMinor, currency)],
      ].map((row) => row.map((cell) => csvCell(cell ?? "")).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-timesheet-${month}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed. Please try again.", { id: toastId });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Timesheet month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        className="h-9 w-40"
      >
        {months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
      </NativeSelect>
      <NativeSelect
        aria-label="Export format"
        value={format}
        onChange={(event) => setFormat(event.target.value as "csv" | "pdf")}
        className="h-9 w-28"
      >
        <option value="pdf">PDF</option>
        <option value="csv">CSV</option>
      </NativeSelect>
      <Button type="button" variant="outline" size="sm" onClick={download} disabled={pending}>
        <Download data-icon="inline-start" />
        {pending ? "Preparing…" : "Export"}
      </Button>
    </div>
  );
}
