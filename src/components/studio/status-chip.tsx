import type { ChargeLife } from "@/modules/finance/presentation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TEXT: Record<string, string> = {
  due: "text-status-due-fg",
  partial: "text-status-partial-fg",
  overdue: "text-status-overdue-fg",
  paid: "text-status-paid-fg",
  cancelled: "text-status-cancelled-fg",
  active: "text-status-active-fg",
  planning: "text-status-planning-fg",
  on_hold: "text-status-hold-fg",
  completed: "text-status-due-fg",
  hourly: "text-status-due-fg",
};

/** Status as colored text with a dot. Keep short labels. */
export function StatusChip({
  tone = "due",
  children,
}: {
  tone?: ChargeLife | "active" | "planning" | "on_hold" | "completed" | "hourly" | "cancelled";
  children: ReactNode;
}) {
  const color = TEXT[tone] ?? TEXT.due;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", color)}>
      <span className={cn("size-1.5 shrink-0 rounded-full bg-current")} aria-hidden />
      {children}
    </span>
  );
}
