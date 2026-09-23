import type { ChargeLife } from "@/modules/finance/presentation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PILL: Record<string, string> = {
  due: "status-due",
  partial: "status-partial",
  overdue: "status-overdue",
  paid: "status-paid",
  cancelled: "status-cancelled",
  active: "status-active",
  planning: "status-planning",
  on_hold: "status-hold",
  completed: "status-due",
  hourly: "status-due",
};

/** Status badge — one accent signal. Keep short labels. */
export function StatusChip({
  tone = "due",
  children,
}: {
  tone?: ChargeLife | "active" | "planning" | "on_hold" | "completed" | "hourly" | "cancelled";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide",
        PILL[tone] ?? PILL.due,
      )}
    >
      {children}
    </span>
  );
}
