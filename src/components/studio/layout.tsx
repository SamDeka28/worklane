import Link from "next/link";
import { Children, type ReactNode } from "react";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";

/**
 * Internal attention ranks. Never render these names.
 * 1 objective · 2 primary information · 3 current state · 4 primary action
 * 5 supporting information · 6 secondary actions · 7 metadata · 8 system
 */
export const ATTENTION = {
  objective: "1",
  primary: "2",
  state: "3",
  action: "4",
  support: "5",
  secondary: "6",
  meta: "7",
  system: "8",
} as const;

export type AttentionRank = (typeof ATTENTION)[keyof typeof ATTENTION];

/**
 * Spacing rhythm. Use the step that matches the relationship, not a blanket padding.
 * micro 4 · tight 8 · component 12 · group 16 · section 24 · major 32
 */
export const SPACE = {
  micro: "gap-1",
  tight: "gap-2",
  component: "gap-3",
  group: "gap-4",
  section: "gap-6",
  major: "gap-8",
} as const;

export type SpaceStep = keyof typeof SPACE;

/** Marks a region's rank. Adds no surface. */
export function Attention({
  rank,
  children,
  className,
}: {
  rank: AttentionRank;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-attention={rank} className={className}>
      {children}
    </div>
  );
}

/**
 * Page order:
 * context → primary information → attention / action → main → support → metadata.
 * Missing slots are omitted, so a short page does not reserve empty bands.
 */
export function PageRegions({
  context,
  primary,
  attention,
  children,
  support,
  meta,
  className,
}: {
  context?: ReactNode;
  primary?: ReactNode;
  attention?: ReactNode;
  children?: ReactNode;
  support?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <ContentStack space="section" className={className}>
      {context}
      {primary ? (
        <div data-attention={ATTENTION.primary} data-composition="primary">
          {primary}
        </div>
      ) : null}
      {attention}
      {children ? (
        <div data-composition="main" className="min-w-0">
          {children}
        </div>
      ) : null}
      {support ? (
        <div data-attention={ATTENTION.support} data-composition="support">
          {support}
        </div>
      ) : null}
      {meta ? (
        <div data-attention={ATTENTION.meta} data-composition="meta">
          {meta}
        </div>
      ) : null}
    </ContentStack>
  );
}

/** Vertical rhythm. Gap is between children only — nothing grows to fill unused space. */
export function ContentStack({
  children,
  space = "section",
  composition,
  className,
}: {
  children: ReactNode;
  space?: SpaceStep;
  composition?: string;
  className?: string;
}) {
  return (
    <div
      data-composition={composition}
      className={cn("flex min-w-0 flex-col", SPACE[space], className)}
    >
      {children}
    </div>
  );
}

/**
 * Related blocks in a row or wrapping grid.
 * auto-fit drops empty tracks, so one or two items do not leave a blank column.
 */
export function ContentGrid({
  children,
  min = "16rem",
  className,
}: {
  children: ReactNode;
  /** Minimum track size. The track never exceeds the container. */
  min?: string;
  className?: string;
}) {
  return (
    <div
      data-composition="grid"
      className={cn("grid", SPACE.group, className)}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

/** Facts that belong together. Tighter than the gap between sections. */
export function InformationGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex min-w-0 flex-col", SPACE.tight, className)}>{children}</div>;
}

/**
 * Page context under the app title: where this screen is for, then its one verb.
 * Purpose stays supporting copy. This is not a second page title.
 */
export function PageHeader({
  title,
  purpose,
  subtitle,
  actions,
  primary,
  className,
}: {
  title?: ReactNode;
  purpose?: ReactNode;
  subtitle?: ReactNode;
  /** Quieter actions. A lone cluster is the primary when `primary` is omitted. */
  actions?: ReactNode;
  primary?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-toolbar
      data-composition="intent"
      className={cn(
        "flex shrink-0 flex-col border-b border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-3.5",
        SPACE.component,
        "sm:gap-4",
        className,
      )}
    >
      <InformationGroup className="min-w-0 flex-1 gap-1">
        {title ? (
          <div
            data-attention={ATTENTION.primary}
            className="truncate text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {title}
          </div>
        ) : null}
        {purpose ? (
          <p
            data-attention={ATTENTION.support}
            className="line-clamp-2 text-sm text-muted-foreground sm:truncate"
          >
            {purpose}
          </p>
        ) : null}
        {subtitle && !purpose ? (
          <div data-attention={ATTENTION.support} className="truncate text-sm text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
        {subtitle && purpose && title ? (
          <div data-attention={ATTENTION.meta} className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </InformationGroup>
      <ActionGroup primary={primary}>{actions}</ActionGroup>
    </div>
  );
}

/** Controls for the work below. No surface of its own. */
export function PageToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-toolbar
      data-composition="controls"
      className={cn(
        "flex shrink-0 flex-wrap px-4 py-2.5 sm:px-6 sm:py-3",
        SPACE.tight,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The dominant verb. Does not style the control passed in. */
export function PrimaryAction({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div data-attention={ATTENTION.action} className={cn("flex flex-wrap items-center", SPACE.tight, className)}>
      {children}
    </div>
  );
}

/** Quieter verbs that serve the primary. Packed tight so they read as one group. */
export function SecondaryActions({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div data-attention={ATTENTION.secondary} className={cn("flex flex-wrap items-center", SPACE.micro, className)}>
      {children}
    </div>
  );
}

/**
 * Supporting actions, then the one primary, with a step of space between the two groups.
 * When only one cluster is passed, it is the primary.
 */
export function ActionGroup({
  primary,
  children,
  className,
}: {
  primary?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  if (!primary && !children) return null;
  const support = primary ? children : null;
  const lead = primary ?? children;
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center", SPACE.component, className)}>
      {support ? <SecondaryActions>{support}</SecondaryActions> : null}
      {lead ? <PrimaryAction>{lead}</PrimaryAction> : null}
    </div>
  );
}

export const ActionCluster = ActionGroup;

/** Actions that belong to a section or object, not the page verb. */
export function QuickActions({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div data-attention={ATTENTION.secondary} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  surface = false,
}: {
  title: string;
  action?: ReactNode;
  /** Matches the header treatment inside a surfaced section. */
  surface?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between",
        SPACE.tight,
        surface ? "border-b border-border/50 bg-muted/25 px-4 py-3 sm:gap-3" : "mb-3 sm:gap-3",
      )}
    >
      <h2
        data-attention={ATTENTION.support}
        className={
          surface
            ? "text-[12px] font-bold tracking-[0.12em] text-foreground/70 uppercase"
            : "text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
        }
      >
        {title}
      </h2>
      {action ? (
        <QuickActions className="w-full sm:w-auto sm:justify-end">{action}</QuickActions>
      ) : null}
    </div>
  );
}

/**
 * A named block of the page. Plain by default.
 * `surface` uses the existing panel token when the block must separate from the flow.
 */
export function Section({
  title,
  action,
  children,
  id,
  surface = false,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  surface?: boolean;
  className?: string;
}) {
  return (
    <section id={id} data-composition="section" className={cn("scroll-mt-4", className)}>
      {surface ? (
        <div className="lane-panel overflow-hidden transition-[transform,box-shadow] duration-200 ease-out">
          <SectionHeader title={title} action={action} surface />
          {children}
        </div>
      ) : (
        <>
          <SectionHeader title={title} action={action} />
          {children}
        </>
      )}
    </section>
  );
}

/**
 * What needs attention now. Surface is the existing panel plus the primary edge,
 * used only so this band separates from the work under it.
 */
export function AttentionSection({
  kicker,
  title,
  body,
  action,
  surface = true,
  className,
}: {
  kicker?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  surface?: boolean;
  className?: string;
}) {
  return (
    <div
      data-attention={ATTENTION.action}
      data-composition="attention"
      className={cn(
        "flex flex-col px-4 py-3.5 sm:flex-row sm:items-center",
        SPACE.component,
        surface && "lane-panel border-l-[3px] border-l-primary",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {kicker ? (
          <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{kicker}</p>
        ) : null}
        <p className={cn("text-[15px] font-semibold tracking-tight text-foreground", kicker && "mt-1")}>
          {title}
        </p>
        {body ? (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{body}</p>
        ) : null}
      </div>
      {action ? <PrimaryAction className="shrink-0 self-start sm:self-center">{action}</PrimaryAction> : null}
    </div>
  );
}

function metricColumns(count: number) {
  switch (count) {
    case 1:
      return "grid-cols-1 max-w-xs";
    case 2:
      return "grid-cols-2";
    case 3:
      return "grid-cols-1 sm:grid-cols-3";
    case 5:
      return "grid-cols-2 xl:grid-cols-5";
    default:
      return "grid-cols-2 lg:grid-cols-4";
  }
}

/**
 * Figures for one screen, each on its own surface.
 * One figure can be marked stronger. The others stay full metric cards.
 */
export function MetricGroup({
  children,
  columns,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5;
  className?: string;
}) {
  const count = columns ?? Math.min(5, Math.max(1, Children.count(children)));
  return (
    <div
      data-composition="state"
      className={cn("lane-stagger grid shrink-0 gap-2 sm:gap-3", metricColumns(count), className)}
    >
      {children}
    </div>
  );
}

/** Ancestors of the object, parent nearest the title. */
export function ContextHeader({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <nav
      data-attention={ATTENTION.support}
      aria-label="Where this sits"
      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground"
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? (
            <span aria-hidden className="text-border">
              /
            </span>
          ) : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export const ObjectContext = ContextHeader;

/** Metadata that sits with the object, quieter than the name. */
export function ObjectMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-attention={ATTENTION.meta}
      className={cn(
        "mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:mt-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The object on screen: where it sits, its name, its state, then what to do.
 * Actions stay with the name so the eye does not cross the page.
 */
export function ObjectHeader({
  context,
  title,
  status,
  meta,
  primary,
  secondary,
  className,
}: {
  context?: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  const renderActions = () => (
    <>
      <PrimaryAction>{primary}</PrimaryAction>
      <SecondaryActions>{secondary}</SecondaryActions>
    </>
  );

  return (
    <div className={cn("flex items-start", SPACE.component, "sm:gap-4", className)}>
      <div className="min-w-0 flex-1">
        {context ? <div className="mb-1.5">{context}</div> : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            data-attention={ATTENTION.primary}
            className="min-w-0 text-[1.5rem] font-bold leading-tight tracking-tight sm:truncate sm:text-[2rem]"
          >
            {title}
          </div>
          {status}
        </div>
        {meta ? <ObjectMeta>{meta}</ObjectMeta> : null}
        {primary || secondary ? (
          <div className={cn("mt-3 flex flex-wrap items-center sm:hidden", SPACE.tight)}>
            {renderActions()}
          </div>
        ) : null}
      </div>
      {primary || secondary ? (
        <div className={cn("hidden shrink-0 items-center sm:flex", SPACE.tight)}>{renderActions()}</div>
      ) : null}
    </div>
  );
}

/** Important state, using the existing status chip. Rank only — no new badge style. */
export function StatusIndicator({
  tone = "due",
  children,
  className,
}: {
  tone?: Parameters<typeof StatusChip>[0]["tone"];
  children: ReactNode;
  className?: string;
}) {
  return (
    <span data-attention={ATTENTION.state} className={cn("inline-flex", className)}>
      <StatusChip tone={tone}>{children}</StatusChip>
    </span>
  );
}

/**
 * One list record, scanned in columns.
 * Identity and context take the flexible left. State, owner, value, and action
 * keep fixed tracks so rows line up.
 * Pass `null` to keep an empty track. Omit the prop when the list has no such column.
 */
export function EntityRow({
  identity,
  context,
  meta,
  state,
  owner,
  value,
  action,
  className,
}: {
  identity: ReactNode;
  context?: ReactNode;
  /** Quiet badges and compact metadata under the context line. */
  meta?: ReactNode;
  state?: ReactNode;
  owner?: ReactNode;
  value?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div data-attention={ATTENTION.primary} className="text-sm font-semibold tracking-tight text-foreground">
          {identity}
        </div>
        {context ? (
          <div data-attention={ATTENTION.support} className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground">
            {context}
          </div>
        ) : null}
        {meta ? (
          <div data-attention={ATTENTION.meta} className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {meta}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 sm:contents">
        {state !== undefined ? (
          <div data-attention={ATTENTION.state} className="flex w-36 shrink-0 justify-end">
            {state}
          </div>
        ) : null}
        {owner !== undefined ? (
          <div
            data-attention={ATTENTION.support}
            className="hidden w-40 shrink-0 items-center gap-2 truncate text-xs text-muted-foreground lg:flex"
          >
            {owner}
          </div>
        ) : null}
        {value !== undefined ? (
          <div
            data-attention={ATTENTION.state}
            className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
          >
            {value}
          </div>
        ) : null}
        {action !== undefined ? (
          <PrimaryAction className="w-24 shrink-0 justify-end">{action}</PrimaryAction>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A wide record: identity, a context column, a signal column, then actions.
 * Columns collapse under the name on narrower screens. Omit a column by leaving it out.
 */
export function DetailedRow({
  identity,
  contextLabel,
  context,
  signalLabel,
  signal,
  action,
  className,
}: {
  identity: ReactNode;
  contextLabel?: string;
  context?: ReactNode;
  signalLabel?: string;
  signal?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-center gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.8fr)_max-content_auto]",
        className,
      )}
    >
      <div data-attention={ATTENTION.primary} className="min-w-0 sm:col-span-2 lg:col-span-1">
        {identity}
      </div>
      {context !== undefined ? (
        <div data-attention={ATTENTION.support} className="min-w-0">
          {contextLabel ? <ColumnLabel>{contextLabel}</ColumnLabel> : null}
          <div className="text-xs leading-5 text-muted-foreground">{context}</div>
        </div>
      ) : null}
      {signal !== undefined ? (
        <div data-attention={ATTENTION.state} className="min-w-0">
          {signalLabel ? <ColumnLabel>{signalLabel}</ColumnLabel> : null}
          {signal}
        </div>
      ) : null}
      {action ? (
        <div
          data-attention={ATTENTION.action}
          className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:col-span-2 lg:col-span-1 lg:col-start-4 lg:justify-self-end"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * One record, read in place: the fact, the state that changes what you do, then metadata.
 */
export function RecordStory({
  children,
  state,
  meta,
  action,
  className,
}: {
  children: ReactNode;
  state?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start justify-between", SPACE.component, className)}>
      <InformationGroup className="gap-1">
        <div data-attention={ATTENTION.primary}>{children}</div>
        {state ? <div data-attention={ATTENTION.state}>{state}</div> : null}
        {meta ? (
          <div data-attention={ATTENTION.meta} className="text-xs text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </InformationGroup>
      {action ? <PrimaryAction className="shrink-0">{action}</PrimaryAction> : null}
    </div>
  );
}
