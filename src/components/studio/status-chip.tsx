import type { ChargeLife } from "@/modules/finance/presentation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PILL: Record<string, string> = {
  due: "bg-sky-100 text-sky-700",
  partial: "bg-violet-100 text-violet-700",
  overdue: "bg-rose-100 text-rose-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700",
  planning: "bg-violet-100 text-violet-700",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-sky-100 text-sky-700",
  hourly: "bg-sky-100 text-sky-700",
};

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
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        PILL[tone] ?? PILL.due,
      )}
    >
      {children}
    </span>
  );
}
