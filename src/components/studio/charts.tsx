"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Stat } from "@/components/studio/chrome";

export type MoneySlice = {
  label: string;
  value: number;
  color: string;
};

/** Soft donut built with conic-gradient — no chart library. */
export function MoneyRing({
  slices,
  centerLabel,
  centerValue,
  className,
}: {
  slices: MoneySlice[];
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const safe = total > 0 ? slices : [{ label: "Empty", value: 1, color: "var(--muted)" }];
  const sum = safe.reduce((acc, slice) => acc + Math.max(0, slice.value), 0);
  let cursor = 0;
  const stops = safe
    .map((slice) => {
      const start = (cursor / sum) * 360;
      cursor += Math.max(0, slice.value);
      const end = (cursor / sum) * 360;
      return `${slice.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div
        className="relative size-40 shrink-0 rounded-full shadow-inner transition-transform duration-500 hover:scale-[1.02]"
        style={{ background: `conic-gradient(${stops})` }}
        aria-hidden
      >
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card text-center shadow-soft">
          {centerValue ? (
            <p className="text-sm font-semibold tabular-nums tracking-tight">{centerValue}</p>
          ) : null}
          {centerLabel ? <p className="text-[11px] text-muted-foreground">{centerLabel}</p> : null}
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2.5 text-sm">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((Math.max(0, slice.value) / total) * 100) : 0;
          return (
            <li key={slice.label} className="flex items-center gap-2.5">
              <span
                className="size-2.5 shrink-0 rounded-full shadow-sm"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.label}</span>
              <span className="tabular-nums font-medium">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ProjectMoneyRow = {
  id: string;
  label: string;
  href?: string;
  meta?: string;
  /** Amount in minor units (cents). */
  collected: number;
  due: number;
  remaining: number;
  collectedLabel?: string;
  dueLabel?: string;
  remainingLabel?: string;
};

const SERIES = [
  { key: "collected" as const, label: "Collected", color: "#34d399", dot: "bg-emerald-400" },
  { key: "due" as const, label: "Due", color: "#38bdf8", dot: "bg-sky-400" },
  { key: "remaining" as const, label: "Unbilled", color: "#fbbf24", dot: "bg-amber-400" },
];

type ChartDatum = {
  id: string;
  name: string;
  href?: string;
  collected: number;
  due: number;
  remaining: number;
  collectedLabel: string;
  dueLabel: string;
  remainingLabel: string;
};

function ProjectMoneyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-44 rounded-xl bg-card px-3 py-2.5 text-xs shadow-lift ring-1 ring-border/60">
      <p className="mb-2 truncate font-medium text-foreground">{row.name}</p>
      <ul className="space-y-1.5">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className={cn("size-2 rounded-full", s.dot)} />
              {s.label}
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {row[`${s.key}Label`]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Recharts grouped bars — collected / due / unbilled per project. */
export function ProjectMoneyCurves({
  rows,
  className,
}: {
  rows: ProjectMoneyRow[];
  className?: string;
}) {
  const router = useRouter();

  const data = useMemo<ChartDatum[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.label,
        href: row.href,
        // Chart in major units so the axis reads as money, not cents.
        collected: Math.max(0, row.collected) / 100,
        due: Math.max(0, row.due) / 100,
        remaining: Math.max(0, row.remaining) / 100,
        collectedLabel: row.collectedLabel ?? formatMajor(row.collected / 100),
        dueLabel: row.dueLabel ?? row.meta ?? formatMajor(row.due / 100),
        remainingLabel: row.remainingLabel ?? formatMajor(row.remaining / 100),
      })),
    [rows],
  );

  if (rows.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.dot)} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            barCategoryGap="28%"
            barGap={4}
          >
            <CartesianGrid
              vertical={false}
              stroke="currentColor"
              className="text-border/50"
              strokeDasharray="4 6"
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "currentColor", fontSize: 11 }}
              className="text-muted-foreground"
              interval={0}
              tickFormatter={(value: string) =>
                value.length > 12 ? `${value.slice(0, 10)}…` : value
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "currentColor", fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={(value: number) => formatAxisMoney(value)}
            />
            <Tooltip
              cursor={{ fill: "currentColor", className: "text-muted/40", opacity: 0.35 }}
              content={<ProjectMoneyTooltip />}
              wrapperStyle={{ outline: "none", zIndex: 40 }}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[6, 6, 2, 2]}
                maxBarSize={28}
                cursor="pointer"
                onClick={(entry) => {
                  const payload = entry as { payload?: ChartDatum; href?: string };
                  const href = payload.payload?.href ?? payload.href;
                  if (href) router.push(href);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatMajor(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAxisMoney(value: number) {
  if (!Number.isFinite(value) || value === 0) return "$0";
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${Math.round(value)}`;
}

/** @deprecated Prefer ProjectMoneyCurves. */
export function HorizonBars({
  rows,
  className,
}: {
  rows: ProjectMoneyRow[];
  className?: string;
}) {
  return <ProjectMoneyCurves rows={rows} className={className} />;
}

/** Vertical stacks of dots — inspired by soft analytics dashboards. */
export function DotStackChart({
  rows,
  className,
}: {
  rows: {
    id: string;
    label: string;
    value: number;
    meta?: string;
  }[];
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const DOTS = 10;

  return (
    <ul className={cn("flex h-full min-h-44 items-end gap-2 sm:gap-3", className)}>
      {rows.map((row) => {
        const filled =
          max > 0 ? Math.max(row.value > 0 ? 1 : 0, Math.round((row.value / max) * DOTS)) : 0;
        return (
          <li
            key={row.id}
            className="group relative flex min-w-0 flex-1 flex-col items-center gap-2"
            title={row.meta ?? row.label}
          >
            <span className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-lg bg-card px-2 py-1 text-[10px] tabular-nums text-foreground opacity-0 shadow-lift ring-1 ring-border/50 transition-opacity group-hover:opacity-100">
              {row.meta ?? (row.value > 0 ? String(row.value) : "—")}
            </span>
            <div className="flex flex-col-reverse items-center gap-1.5">
              {Array.from({ length: DOTS }, (_, index) => {
                const on = index < filled;
                return (
                  <span
                    key={index}
                    className={cn(
                      "size-2.5 rounded-full transition-all duration-300 sm:size-3",
                      on
                        ? "scale-100 bg-emerald-400 ring-4 ring-emerald-400/20"
                        : "scale-90 bg-muted",
                    )}
                    style={{ transitionDelay: `${index * 18}ms` }}
                  />
                );
              })}
            </div>
            <span className="truncate text-[11px] text-muted-foreground">{row.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Pill-segment progress (completion rate style). */
export function PillTrack({
  value,
  max = 1,
  className,
  tone = "emerald",
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "emerald" | "sky" | "amber";
}) {
  const slots = 16;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = Math.round(ratio * slots);
  const on = {
    emerald: "bg-emerald-400",
    sky: "bg-sky-400",
    amber: "bg-amber-400",
  }[tone];

  return (
    <div className={cn("flex gap-1", className)} aria-hidden>
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-full transition-colors duration-300",
            i < filled ? on : "bg-muted",
          )}
          style={{ transitionDelay: `${i * 12}ms` }}
        />
      ))}
    </div>
  );
}

export function SoftStatCard({
  label,
  value,
  hint,
  tone = "slate",
  fill,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "sky" | "emerald" | "violet" | "amber";
  fill?: number;
  badge?: string;
}) {
  return (
    <Stat
      label={label}
      value={value}
      hint={hint}
      tone={tone}
      fill={fill}
      badge={badge}
      variant="tile"
    />
  );
}
