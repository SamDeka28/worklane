import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Stat, type StatTone } from "@/components/studio/chrome";

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
  tone?: Extract<StatTone, "slate" | "sky" | "amber" | "emerald" | "rose">;
}) {
  return <Stat label={label} value={value} hint={hint} tone={tone} variant="strip" />;
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
        "flex min-h-0 flex-1 flex-col overflow-hidden lane-panel",
        className,
      )}
    >
      {columns ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-border/50 bg-card/70 px-5 py-3.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {columns}
        </div>
      ) : null}
      <ul className="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto bg-card/50">
        {children}
      </ul>
      {footer ? (
        <div className="shrink-0 border-t border-border/50 bg-card/60 px-5 py-3 text-sm text-muted-foreground">
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
        "flex items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-muted/60",
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
