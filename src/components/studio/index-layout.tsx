import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Full-height body under purpose + filters. */
export function IndexBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-5 pt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Compact metrics that give sparse indexes visual weight. */
export function SummaryStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lane-stagger grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SummaryStat({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "sky" | "amber" | "emerald" | "rose";
}) {
  const well = {
    slate: "from-white to-slate-50/90",
    sky: "from-white to-sky-50/90",
    amber: "from-white to-amber-50/90",
    emerald: "from-white to-emerald-50/90",
    rose: "from-white to-rose-50/90",
  }[tone];

  return (
    <div
      className={cn(
        "lane-surface lane-surface-hover bg-linear-to-br px-5 py-4",
        well,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Grounded full-height list workspace — not floating rows on white. */
export function DenseListPanel({
  columns,
  children,
  footer,
  className,
}: {
  columns?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-card/70 shadow-soft ring-1 ring-border/30 backdrop-blur-sm",
        className,
      )}
    >
      {columns ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-muted/30 px-5 py-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {columns}
        </div>
      ) : null}
      <ul className="min-h-0 flex-1 divide-y divide-border/35 overflow-y-auto">
        {children}
      </ul>
      {footer ? (
        <div className="shrink-0 border-t border-border/40 bg-muted/20 px-5 py-3.5 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function DenseRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-5 py-4 transition-colors duration-200 hover:bg-sky-50/50",
        className,
      )}
    >
      {children}
    </li>
  );
}

export function DenseCell({
  children,
  className,
  align = "left",
  width,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right";
  /** Tailwind width utility, e.g. w-28 */
  width?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        width,
        align === "right" && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </div>
  );
}
