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
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 pt-3 sm:gap-4 sm:px-5 sm:pb-5 sm:pt-4 md:overflow-hidden",
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
        "lane-stagger grid shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4",
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
        "flex min-w-0 flex-col overflow-hidden lane-panel md:min-h-0 md:flex-1",
        className,
      )}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto md:overflow-y-hidden">
        <div className="flex h-full min-h-0 w-full flex-col">
          {columns ? (
            <div className="hidden shrink-0 items-center gap-3 border-b border-border/50 bg-card/70 px-4 py-3.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase sm:flex sm:px-5 sm:py-4">
              {columns}
            </div>
          ) : null}
          <ul className="min-h-0 flex-1 divide-y divide-border/40 bg-card/50 md:overflow-y-auto">
            {children}
          </ul>
        </div>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border/50 bg-card/60 px-4 py-3 text-sm text-muted-foreground sm:px-5">
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
        "flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/60 sm:items-center sm:gap-3 sm:px-5 sm:py-4",
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
