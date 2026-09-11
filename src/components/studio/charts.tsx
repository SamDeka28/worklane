import Link from "next/link";
import { cn } from "@/lib/utils";

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

export function HorizonBars({
  rows,
  className,
}: {
  rows: {
    id: string;
    label: string;
    href?: string;
    meta?: string;
    collected: number;
    due: number;
    remaining: number;
  }[];
  className?: string;
}) {
  const max = Math.max(
    1,
    ...rows.map(
      (row) => Math.max(0, row.collected) + Math.max(0, row.due) + Math.max(0, row.remaining),
    ),
  );

  return (
    <ul className={cn("flex flex-col gap-5", className)}>
      {rows.map((row) => {
        const total =
          Math.max(0, row.collected) + Math.max(0, row.due) + Math.max(0, row.remaining);
        const width = `${Math.round((total / max) * 100)}%`;
        const collectedPct = total > 0 ? (Math.max(0, row.collected) / total) * 100 : 0;
        const duePct = total > 0 ? (Math.max(0, row.due) / total) * 100 : 0;
        const remainingPct = total > 0 ? (Math.max(0, row.remaining) / total) * 100 : 0;
        const title = (
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium tracking-tight">{row.label}</span>
            {row.meta ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.meta}</span>
            ) : null}
          </div>
        );
        return (
          <li key={row.id} className="group">
            {row.href ? (
              <Link href={row.href} className="block transition-opacity hover:opacity-90">
                {title}
              </Link>
            ) : (
              title
            )}
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted/80">
              <div
                className="flex h-full overflow-hidden rounded-full transition-[width] duration-500 ease-out"
                style={{ width }}
              >
                <span
                  className="h-full bg-emerald-400 transition-[width] duration-500"
                  style={{ width: `${collectedPct}%` }}
                />
                <span
                  className="h-full bg-sky-400 transition-[width] duration-500"
                  style={{ width: `${duePct}%` }}
                />
                <span
                  className="h-full bg-amber-300/90 transition-[width] duration-500"
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
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
            className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            title={row.meta ?? row.label}
          >
            <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
  const well = {
    slate: "from-white to-slate-50/80",
    sky: "from-white to-sky-50/90",
    emerald: "from-white to-emerald-50/90",
    violet: "from-white to-violet-50/80",
    amber: "from-white to-amber-50/90",
  }[tone];
  const bar = {
    slate: "bg-slate-400",
    sky: "bg-sky-400",
    emerald: "bg-emerald-400",
    violet: "bg-violet-400",
    amber: "bg-amber-400",
  }[tone];
  const badgeTone = {
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
  }[tone];
  const width =
    fill == null ? undefined : `${Math.round(Math.min(1, Math.max(0.06, fill)) * 100)}%`;

  return (
    <div
      className={cn(
        "lane-surface lane-surface-hover h-full bg-linear-to-br p-5",
        well,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {badge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              badgeTone,
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {width ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted/70">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar)}
            style={{ width }}
          />
        </div>
      ) : null}
    </div>
  );
}
