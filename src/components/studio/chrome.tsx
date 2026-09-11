import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/modules/finance/presentation";

const AVATAR_TONES = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
] as const;

function avatarTone(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

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
        "rounded-4xl bg-card shadow-soft transition-[transform,box-shadow] duration-300 ease-out ring-1 ring-border/25",
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SoftCard className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {children}
    </SoftCard>
  );
}

export function SoftTab({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-4 py-2 text-sm transition-all duration-200",
        active
          ? "bg-foreground font-medium text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

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
  const well = {
    blue: "bg-sky-100 text-sky-700",
    green: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
  }[tone];
  const bar = {
    blue: "bg-sky-400",
    green: "bg-emerald-400",
    violet: "bg-violet-400",
    amber: "bg-amber-400",
  }[tone];
  const width = `${Math.round(Math.min(1, Math.max(0.08, fill)) * 100)}%`;

  return (
    <SoftCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-2xl", well)}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", bar)} style={{ width }} />
      </div>
    </SoftCard>
  );
}

export function AvatarMark({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        avatarTone(name),
        size === "sm" && "size-7 text-[10px]",
        size === "md" && "size-10 text-xs",
        size === "lg" && "size-12 text-sm",
      )}
    >
      {initials(name)}
    </span>
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
      className={cn(
        "flex shrink-0 items-center gap-4 border-b border-border/30 px-5 py-3.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title ? (
          <div className="truncate text-xl font-semibold tracking-tight">{title}</div>
        ) : null}
        {purpose ? (
          <p
            className={cn(
              "truncate text-sm",
              title ? "mt-0.5 text-muted-foreground" : "font-semibold text-foreground",
            )}
          >
            {purpose}
          </p>
        ) : null}
        {subtitle && !purpose ? (
          <div className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
        {subtitle && purpose && title ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Entity hub header: one primary CTA + overflow. No peer tab bars. */
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
        "flex shrink-0 flex-col gap-3 border-b border-border/30 px-5 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </div>
          {meta ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {primaryAction}
          {overflow}
        </div>
      </div>
      {viewToggle ? (
        <div className="flex items-center gap-2">{viewToggle}</div>
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
    <div className={cn("flex shrink-0 flex-wrap gap-1.5 px-5 py-2", className)}>
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
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4",
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
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
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
        "flex flex-col gap-3 rounded-[1.5rem] bg-linear-to-br from-sky-100/90 via-white to-emerald-50/50 px-4 py-3.5 ring-1 ring-sky-200/60 shadow-soft sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.08em] text-sky-800/80 uppercase">
          Do next
        </p>
        <p className="mt-0.5 font-heading text-base font-semibold tracking-tight">{title}</p>
        {body ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
    </div>
  );
}

export function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1 text-xs transition-colors",
        active
          ? "bg-foreground font-medium text-background"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
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
    "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-colors",
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
