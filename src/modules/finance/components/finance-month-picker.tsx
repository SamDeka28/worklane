"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseYearMonth(value: string) {
  const [y, m] = value.split("-").map(Number);
  return {
    year: Number.isFinite(y) ? y : new Date().getUTCFullYear(),
    month: Number.isFinite(m) ? m : new Date().getUTCMonth() + 1,
  };
}

function formatLabel(value: string) {
  const { year, month } = parseYearMonth(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function FinanceMonthPicker({
  orgSlug,
  value,
}: {
  orgSlug: string;
  value: string;
}) {
  const router = useRouter();
  const selected = parseYearMonth(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.year);

  const label = useMemo(() => formatLabel(value), [value]);

  function pick(monthIndex: number) {
    const next = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    setOpen(false);
    router.push(`/${orgSlug}/finance?view=month&month=${next}`);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViewYear(selected.year);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-card px-3 text-sm font-medium tracking-tight",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
            aria-label={`Month ${label}`}
          />
        }
      >
        <CalendarDays className="size-4 text-muted-foreground" />
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[17.5rem] gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous year"
            onClick={() => setViewYear((year) => year - 1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-semibold tabular-nums">{viewYear}</p>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next year"
            onClick={() => setViewYear((year) => year + 1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((monthLabel, index) => {
            const active = viewYear === selected.year && index + 1 === selected.month;
            return (
              <button
                key={monthLabel}
                type="button"
                onClick={() => pick(index)}
                className={cn(
                  "h-8 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {monthLabel}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
