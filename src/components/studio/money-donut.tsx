"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export const MONEY_COLORS = {
  collected: "#34d399",
  due: "#38bdf8",
  remaining: "#c4b5fd",
  muted: "#e2e8f0",
} as const;

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: DonutSlice & { fill?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const slice = row.payload;
  return (
    <div className="rounded-2xl bg-card px-3 py-2 text-xs shadow-soft ring-1 ring-border/50">
      <span className="inline-flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: slice?.color ?? slice?.fill }}
        />
        <span className="font-medium">{slice?.label ?? row.name}</span>
      </span>
    </div>
  );
}

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
  const positive = slices.filter((slice) => slice.value > 0);
  const data =
    positive.length > 0
      ? positive.map((slice) => ({ ...slice, fill: slice.color }))
      : [{ key: "empty", label: "None", value: 1, color: MONEY_COLORS.muted, fill: MONEY_COLORS.muted }];
  const dim = size === "sm" ? 96 : size === "lg" ? 200 : 136;
  const inner = size === "sm" ? "64%" : size === "lg" ? "56%" : "58%";
  const outer = size === "sm" ? "92%" : size === "lg" ? "90%" : "86%";
  const corner = size === "sm" ? 6 : size === "lg" ? 14 : 9;

  return (
    <div
      className={cn(
        "flex items-center gap-4",
        showLegend ? "" : "justify-center",
        className,
      )}
    >
      <div className="relative z-0 shrink-0" style={{ width: dim, height: dim }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={positive.length > 1 ? 3 : 0}
              cornerRadius={corner}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell
                  key={slice.key}
                  fill={slice.fill}
                  stroke="none"
                  style={{ fill: slice.fill, outline: "none" }}
                />
              ))}
            </Pie>
            <Tooltip
              content={<DonutTooltip />}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 60, outline: "none" }}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-[22%] z-0 flex flex-col items-center justify-center rounded-full bg-card text-center">
            {centerValue ? (
              <p
                className={cn(
                  "font-semibold tabular-nums tracking-tight text-foreground",
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
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-start gap-2.5">
              <span
                className="mt-1 size-2.5 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="min-w-0 leading-snug text-muted-foreground">{slice.label}</span>
            </li>
          ))}
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
      value: Math.max(0, collected),
      color: MONEY_COLORS.collected,
    },
  ];
  if (due != null && dueLabel) {
    slices.push({
      key: "due",
      label: dueLabel,
      value: Math.max(0, due),
      color: MONEY_COLORS.due,
    });
  }
  if (remaining != null && remainingLabel) {
    slices.push({
      key: "remaining",
      label: remainingLabel,
      value: Math.max(0, remaining),
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
    slate: "bg-slate-50 text-foreground",
    sky: "bg-sky-50 text-sky-950",
    emerald: "bg-emerald-50 text-emerald-950",
    violet: "bg-violet-50 text-violet-950",
    amber: "bg-amber-50 text-amber-950",
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
