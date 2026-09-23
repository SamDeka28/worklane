"use client";

import { cn } from "@/lib/utils";

/** Hex kept for callers that still pass `color`; rendering prefers key → Tailwind. */
export const MONEY_COLORS = {
  collected: "#34d399",
  due: "#38bdf8",
  remaining: "#8b7cf8",
  muted: "#94a3b8",
} as const;

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function toNumber(value: number | bigint | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const SLICE_TONE: Record<string, { swatch: string; stroke: string }> = {
  collected: { swatch: "bg-emerald-400", stroke: "stroke-emerald-400" },
  due: { swatch: "bg-sky-400", stroke: "stroke-sky-400" },
  remaining: { swatch: "bg-violet-400", stroke: "stroke-violet-400" },
  unbilled: { swatch: "bg-violet-400", stroke: "stroke-violet-400" },
  muted: { swatch: "bg-slate-400", stroke: "stroke-slate-400" },
  empty: { swatch: "bg-slate-400", stroke: "stroke-slate-400" },
};

const FALLBACK_TONES = [
  { swatch: "bg-emerald-400", stroke: "stroke-emerald-400" },
  { swatch: "bg-sky-400", stroke: "stroke-sky-400" },
  { swatch: "bg-violet-400", stroke: "stroke-violet-400" },
  { swatch: "bg-amber-400", stroke: "stroke-amber-400" },
] as const;

function toneFor(key: string, index: number) {
  return SLICE_TONE[key] ?? FALLBACK_TONES[index % FALLBACK_TONES.length];
}

/**
 * Multicolor donut via SVG stroke arcs + Tailwind colors
 * (avoids Recharts Cell no-op and fragile conic-gradient inline fills).
 */
export function MoneyDonut({
  slices,
  centerLabel,
  centerValue,
  size = "md",
  showLegend = true,
  className,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  size?: "sm" | "md" | "lg";
  showLegend?: boolean;
  className?: string;
}) {
  const normalized = slices.map((slice) => ({
    ...slice,
    value: Math.max(0, toNumber(slice.value)),
  }));
  const positive = normalized.filter((slice) => slice.value > 0);
  const paint =
    positive.length > 0
      ? positive
      : [{ key: "empty", label: "None", value: 1, color: MONEY_COLORS.muted }];

  const total = paint.reduce((sum, slice) => sum + slice.value, 0);
  const dim = size === "sm" ? 96 : size === "lg" ? 200 : 136;
  const stroke = size === "sm" ? 12 : size === "lg" ? 22 : 16;
  const view = 120;
  const radius = (view - stroke) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const gap = paint.length > 1 ? circumference * 0.02 : 0;
  const usable = Math.max(0, circumference - gap * paint.length);

  let cursor = 0;
  const arcs = paint.map((slice, index) => {
    const length = (slice.value / total) * usable;
    const tone = toneFor(slice.key, index);
    const dashoffset = -cursor;
    cursor += length + gap;
    return { ...slice, length, dashoffset, tone };
  });

  return (
    <div
      className={cn(
        "flex items-center gap-4",
        showLegend ? "" : "justify-center",
        className,
      )}
    >
      <div
        className="relative shrink-0"
        style={{ width: dim, height: dim }}
        role="img"
        aria-label={
          centerValue
            ? `${centerLabel ?? "Total"} ${centerValue}`
            : (centerLabel ?? "Money mix")
        }
      >
        <svg
          viewBox={`0 0 ${view} ${view}`}
          className="size-full -rotate-90"
          aria-hidden
        >
          <circle
            cx={view / 2}
            cy={view / 2}
            r={radius}
            fill="none"
            className="stroke-muted/60"
            strokeWidth={stroke}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={view / 2}
              cy={view / 2}
              r={radius}
              fill="none"
              className={cn(arc.tone.stroke, "transition-[stroke-dasharray] duration-500")}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arc.length} ${circumference}`}
              strokeDashoffset={arc.dashoffset}
            />
          ))}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-[28%] flex flex-col items-center justify-center rounded-full bg-card text-center shadow-soft ring-1 ring-border/40">
            {centerValue ? (
              <p
                className={cn(
                  "px-1 font-semibold tabular-nums tracking-tight text-foreground",
                  size === "sm" ? "text-[11px]" : size === "lg" ? "text-sm" : "text-xs",
                )}
              >
                {centerValue}
              </p>
            ) : null}
            {centerLabel ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">{centerLabel}</p>
            ) : null}
          </div>
        )}
      </div>
      {showLegend ? (
        <ul className="min-w-0 flex-1 space-y-2.5 text-xs">
          {normalized.map((slice, index) => {
            const tone = toneFor(slice.key, index);
            return (
              <li key={slice.key} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20",
                    tone.swatch,
                  )}
                  aria-hidden
                />
                <span className="min-w-0 leading-snug text-muted-foreground">{slice.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Card-side donut: rounded segments, no legend. */
export function MoneyDonutCard({
  collected,
  due,
  remaining,
  collectedLabel,
  dueLabel,
  remainingLabel,
  centerValue,
  centerLabel = "Total",
  size = "md",
  className,
}: {
  collected: number;
  due?: number;
  remaining?: number;
  collectedLabel: string;
  dueLabel?: string;
  remainingLabel?: string;
  centerValue: string;
  centerLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const slices: DonutSlice[] = [
    {
      key: "collected",
      label: collectedLabel,
      value: Math.max(0, toNumber(collected)),
      color: MONEY_COLORS.collected,
    },
  ];
  if (due != null && dueLabel) {
    slices.push({
      key: "due",
      label: dueLabel,
      value: Math.max(0, toNumber(due)),
      color: MONEY_COLORS.due,
    });
  }
  if (remaining != null && remainingLabel) {
    slices.push({
      key: "remaining",
      label: remainingLabel,
      value: Math.max(0, toNumber(remaining)),
      color: MONEY_COLORS.remaining,
    });
  }

  return (
    <MoneyDonut
      slices={slices}
      centerValue={centerValue}
      centerLabel={centerLabel}
      size={size}
      showLegend={false}
      className={className}
    />
  );
}

export function MoneyMetaCards({
  items,
  className,
}: {
  items: { label: string; value: string; tone?: "slate" | "sky" | "emerald" | "violet" | "amber" }[];
  className?: string;
}) {
  const toneClass = {
    slate: "bg-muted text-foreground",
    sky: "bg-status-due text-status-due-fg",
    emerald: "bg-status-paid text-status-paid-fg",
    violet: "bg-status-planning text-status-planning-fg",
    amber: "bg-status-hold text-status-hold-fg",
  } as const;

  return (
    <div className={cn("grid gap-2", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-2xl px-3.5 py-3.5",
            toneClass[item.tone ?? "slate"],
          )}
        >
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </p>
          <p className="mt-2 truncate text-[15px] font-semibold tabular-nums tracking-tight">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
