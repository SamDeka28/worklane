"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AvatarMark } from "@/components/studio/chrome";
import { cn } from "@/lib/utils";

export type SplitPartnerChargeRow = {
  chargeId: string;
  label: string;
  dateLabel: string;
  amountLabel: string;
  href?: string;
};

export type SplitPartnerTableRow = {
  partnerId: string;
  name: string;
  shareLabel: string;
  effectiveLabel: string | null;
  targetLabel: string;
  earnedLabel: string;
  stillLabel: string;
  /** 0–1 earned vs target for the progress rail */
  progress?: number | null;
  charges: SplitPartnerChargeRow[];
};

export function SplitPartnerTable({ rows }: { rows: SplitPartnerTableRow[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  function toggle(partnerId: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const open = openIds.has(row.partnerId);
        const canExpand = row.charges.length > 0;
        const progress =
          row.progress == null ? null : Math.min(1, Math.max(0, row.progress));

        return (
          <li
            key={row.partnerId}
            className={cn(
              "overflow-hidden rounded-[1.5rem] bg-card/90 shadow-soft ring-1 transition-[box-shadow,ring-color]",
              open ? "ring-emerald-500/35" : "ring-border/30",
            )}
          >
            <button
              type="button"
              className={cn(
                "flex w-full flex-col gap-3.5 p-4 text-left sm:flex-row sm:items-start sm:gap-5 sm:px-5 sm:py-5",
                canExpand && "hover:bg-muted/20",
                !canExpand && "cursor-default",
              )}
              onClick={() => {
                if (canExpand) toggle(row.partnerId);
              }}
              aria-expanded={canExpand ? open : undefined}
              disabled={!canExpand}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AvatarMark name={row.name} size="md" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-base font-semibold tracking-tight">
                      {row.name}
                    </p>
                    <span className="rounded-lg bg-muted/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {row.shareLabel}
                    </span>
                    {canExpand ? (
                      <ChevronDown
                        className={cn(
                          "ml-auto size-4 text-muted-foreground transition-transform duration-200 sm:hidden",
                          open && "rotate-180",
                        )}
                      />
                    ) : null}
                  </div>
                  {row.effectiveLabel ? (
                    <p className="text-xs text-muted-foreground">{row.effectiveLabel}</p>
                  ) : null}
                  {progress != null ? (
                    <div className="max-w-xs pt-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 dark:bg-emerald-400"
                          style={{ width: `${Math.max(progress * 100, progress > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {Math.round(progress * 100)}% of target earned
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid w-full grid-cols-3 gap-2 border-t border-border/25 pt-3 sm:w-[22rem] sm:shrink-0 sm:gap-3 sm:border-0 sm:pt-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Target
                  </p>
                  <p className="mt-1 truncate text-sm tabular-nums text-muted-foreground">
                    {row.targetLabel}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.08em] text-emerald-700 uppercase dark:text-emerald-300">
                    Earned
                  </p>
                  <p className="mt-1 truncate font-heading text-base font-semibold tracking-tight tabular-nums text-emerald-800 sm:text-lg dark:text-emerald-200">
                    {row.earnedLabel}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Still
                  </p>
                  <p className="mt-1 truncate text-sm font-medium tabular-nums text-foreground">
                    {row.stillLabel}
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  "hidden size-8 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground sm:inline-flex",
                  !canExpand && "opacity-0",
                )}
                aria-hidden={!canExpand}
              >
                <ChevronDown
                  className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
                />
              </span>
            </button>

            {open && canExpand ? (
              <div className="border-t border-border/30 bg-muted/30 px-4 py-3 sm:px-5">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    From charges
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.charges.length}{" "}
                    {row.charges.length === 1 ? "allocation" : "allocations"}
                  </p>
                </div>
                <ul className="space-y-2">
                  {row.charges.map((charge) => (
                    <li
                      key={`${row.partnerId}-${charge.chargeId}-${charge.dateLabel}-${charge.amountLabel}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-card px-3 py-2.5 ring-1 ring-border/25"
                    >
                      <div className="min-w-0">
                        {charge.href ? (
                          <Link
                            href={charge.href}
                            className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {charge.label}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-medium">{charge.label}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {charge.dateLabel}
                        </p>
                      </div>
                      <span className="shrink-0 font-heading text-base font-semibold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-200">
                        {charge.amountLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
