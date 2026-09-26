import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export { SoftTab, FilterChip } from "@/components/studio/nav-links";
export { AvatarMark } from "@/components/studio/avatar-mark";
export { ProjectChip, TagRow } from "@/components/studio/project-chip";

export function moneyFill(part: bigint, whole: bigint) {
  if (whole <= BigInt(0)) return part > BigInt(0) ? 1 : 0.12;
  const n = Number(part) / Number(whole);
  if (!Number.isFinite(n) || n <= 0) return 0.08;
  return Math.min(1, n);
}

export function SoftCard({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "lane-panel transition-[transform,box-shadow] duration-200 ease-out",
        hover && "lane-surface-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WorkSurface({
  children,
  className,
  variant = "open",
}: {
  children: ReactNode;
  className?: string;
  /**
   * `open` pages have their own cards, so the user's surface style decides the backdrop;
   * `panel` pages always keep one because their content has no surfaces of its own.
   */
  variant?: "open" | "panel";
}) {
  return (
    <div
      data-variant={variant}
      className={cn("lane-work flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      {children}
    </div>
  );
}

const STAT_BAR = {
  slate: "bg-slate-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
} as const;

const STAT_BADGE = {
  slate: "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-100",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-100",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-400/20 dark:text-rose-100",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-100",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100",
} as const;

export type StatTone = keyof typeof STAT_BAR;

/** Unified metric — strip (index) or tile (dashboard). Quiet surface; color only on bar/badge. */
export function Stat({
  label,
  value,
  hint,
  tone = "slate",
  fill,
  badge,
  icon,
  variant = "strip",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
  fill?: number;
  badge?: string;
  icon?: ReactNode;
  variant?: "strip" | "tile";
  className?: string;
}) {
  const width =
    fill == null ? undefined : `${Math.round(Math.min(1, Math.max(0.06, fill)) * 100)}%`;

  return (
    <div
      className={cn(
        "h-full bg-card",
        variant === "tile"
          ? "rounded-2xl p-3 ring-1 ring-border/40 sm:rounded-none sm:p-5 sm:ring-0 md:p-6"
          : "lane-surface px-3 py-2.5 sm:px-5 sm:py-4",
        variant === "strip" && "lane-surface-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-[11px]">
          {label}
        </p>
        {badge ? (
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 text-[10px] font-bold tabular-nums sm:px-2.5 sm:py-1 sm:text-xs",
              STAT_BADGE[tone],
            )}
          >
            {badge}
          </span>
        ) : icon ? (
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-lg sm:size-7",
              STAT_BADGE[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 font-semibold tracking-tight tabular-nums text-foreground sm:mt-2",
          variant === "tile"
            ? "text-lg sm:text-2xl"
            : "text-base sm:text-xl md:text-2xl",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:mt-1 sm:text-xs">
          {hint}
        </p>
      ) : null}
      {width ? (
        <div data-slot="meter" className="mt-2 h-1 overflow-hidden rounded-full bg-muted sm:mt-3">
          <div className={cn("h-full rounded-full", STAT_BAR[tone])} style={{ width }} />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use Stat variant="tile" */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  fill = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "violet" | "amber";
  fill?: number;
}) {
  return (
    <Stat
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      tone={tone}
      fill={fill}
      variant="tile"
    />
  );
}

export function StudioToolbar({
  title,
  purpose,
  subtitle,
  actions,
  className,
}: {
  /** Entity name on detail pages (large). Prefer purpose on index pages. */
  title?: ReactNode;
  /** Journey line on index pages — not a second H1. */
  purpose?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-toolbar
      className={cn(
        "flex shrink-0 flex-col gap-3 border-b border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-3.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? (
          <div className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </div>
        ) : null}
        {purpose ? (
          <p
            className={cn(
              "line-clamp-2 sm:truncate",
              title
                ? "text-sm text-muted-foreground"
                : "text-sm font-medium tracking-tight text-foreground",
            )}
          >
            {purpose}
          </p>
        ) : null}
        {subtitle && !purpose ? (
          <div className="truncate text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
        {subtitle && purpose && title ? (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Entity hub header: one primary CTA + overflow. */
export function EntityChrome({
  title,
  meta,
  primaryAction,
  overflow,
  viewToggle,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  overflow?: ReactNode;
  viewToggle?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-3 border-b border-border/50 px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[1.5rem] font-bold leading-tight tracking-tight sm:truncate sm:text-[2rem]">
            {title}
          </div>
          {meta ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:mt-2">
              {meta}
            </div>
          ) : null}
          {primaryAction || overflow ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
              {primaryAction}
              {overflow}
            </div>
          ) : null}
        </div>
        {primaryAction || overflow ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {primaryAction}
            {overflow}
          </div>
        ) : null}
      </div>
      {viewToggle ? (
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {viewToggle}
        </div>
      ) : null}
    </div>
  );
}

/** Quiet filter / kind chips — not peer SoftTabs. */
export function FilterChips({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-toolbar className={cn("flex shrink-0 flex-wrap gap-2 px-4 py-2.5 sm:px-6 sm:py-3", className)}>
      {children}
    </div>
  );
}

/** Scrollable hub body under EntityChrome. */
export function HubBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 sm:gap-8 sm:px-6 sm:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HubSection({
  title,
  action,
  children,
  id,
  className,
  variant = "plain",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  /** `panel` wraps the section in a SoftCard so blocks read as distinct units. */
  variant?: "plain" | "panel";
}) {
  if (variant === "panel") {
    return (
      <section id={id} className={cn("scroll-mt-4", className)}>
        <SoftCard className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="text-[12px] font-bold tracking-[0.12em] text-foreground/70 uppercase">
              {title}
            </h2>
            {action ? (
              <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                {action}
              </div>
            ) : null}
          </div>
          <div className="p-0">{children}</div>
        </SoftCard>
      </section>
    );
  }

  return (
    <section id={id} className={cn("scroll-mt-4", className)}>
      <div className="mb-3 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {title}
        </h2>
        {action ? (
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function NextStepCard({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lane-panel px-4 py-3.5 sm:flex-row sm:items-center",
        "border-l-[3px] border-l-primary",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">
          Do next
        </p>
        <p className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">{title}</p>
        {body ? (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
    </div>
  );
}

export function ListRow({
  href,
  active,
  children,
  className,
}: {
  href?: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const styles = cn(
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
    active ? "bg-muted" : "hover:bg-muted/70",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return <div className={styles}>{children}</div>;
}

export const composerControlClassName =
  "h-9 rounded-none border-0 bg-transparent shadow-none ring-0 hover:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-within:bg-transparent focus-within:ring-0";
