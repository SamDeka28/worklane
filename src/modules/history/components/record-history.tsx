"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AvatarMark } from "@/components/studio/avatar-mark";
import { cn } from "@/lib/utils";
import { formatDay } from "@/modules/finance/presentation";
import { listRecordEventsAction } from "@/modules/history/actions";
import type { RecordChange, RecordEntityType, RecordEvent } from "@/modules/history/types";
import { relativeTime } from "@/modules/notifications/components/notification-item";
import { formatMoney, type IsoCurrency } from "@/shared/money";

const COLLAPSED_COUNT = 30;

const STATUS_LABEL: Record<string, string> = { todo: "To do", doing: "Doing", done: "Done" };
const PRIORITY_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const KIND_LABEL: Record<string, string> = {
  task: "Task",
  bug: "Bug",
  feature: "Feature",
  chore: "Chore",
};

const FIELD_LABEL: Record<string, string> = {
  company: "company",
  contact_name: "contact",
  email: "email",
  phone: "phone",
  whatsapp: "WhatsApp",
  source: "source",
  currency: "currency",
};

function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}

function text(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function diffLists(change: RecordChange) {
  const before = list(change.from);
  const after = list(change.to);
  return {
    added: after.filter((item) => !before.includes(item)),
    removed: before.filter((item) => !after.includes(item)),
  };
}

function joinNames(names: string[]) {
  return names.map((name, index) => (
    <span key={`${name}-${index}`}>
      {index > 0 ? (index === names.length - 1 ? " and " : ", ") : null}
      <B>{name}</B>
    </span>
  ));
}

function fromTo(label: string, change: RecordChange, format: (value: unknown) => string | null) {
  const from = format(change.from);
  const to = format(change.to);
  if (!to) return <>cleared the {label}{from ? <> (was <B>{from}</B>)</> : null}</>;
  if (!from) return <>set the {label} to <B>{to}</B></>;
  return (
    <>
      changed the {label} from <B>{from}</B> to <B>{to}</B>
    </>
  );
}

function describeChange(
  key: string,
  change: RecordChange,
  entityType: RecordEntityType,
  currency: IsoCurrency,
): ReactNode[] {
  const noun = entityType === "lead" ? "lead" : "card";
  switch (key) {
    case "stage":
    case "column": {
      const from = text(change.from);
      const to = text(change.to);
      if (!to) return [];
      return [
        from ? (
          <>
            moved this {noun} from <B>{from}</B> to <B>{to}</B>
          </>
        ) : (
          <>
            moved this {noun} to <B>{to}</B>
          </>
        ),
      ];
    }
    case "status":
      return [fromTo("status", change, (value) => STATUS_LABEL[String(value)] ?? text(value))];
    case "priority":
      return [fromTo("priority", change, (value) => PRIORITY_LABEL[String(value)] ?? text(value))];
    case "kind":
      return [fromTo("type", change, (value) => KIND_LABEL[String(value)] ?? text(value))];
    case "name":
    case "title":
      return [
        <>
          renamed it from <B>“{text(change.from)}”</B> to <B>“{text(change.to)}”</B>
        </>,
      ];
    case "due_on":
      return [fromTo("due date", change, (value) => (text(value) ? formatDay(String(value)) : null))];
    case "close_on":
      return [
        fromTo("expected close", change, (value) => (text(value) ? formatDay(String(value)) : null)),
      ];
    case "estimated_value_minor":
      return [
        fromTo("estimated value", change, (value) =>
          value == null ? null : formatMoney({ amountMinor: BigInt(String(value)), currency }),
        ),
      ];
    case "labels":
    case "tags": {
      const { added, removed } = diffLists(change);
      const word = key === "labels" ? "label" : "tag";
      const lines: ReactNode[] = [];
      if (added.length) lines.push(<>added {word}{added.length > 1 ? "s" : ""} {joinNames(added)}</>);
      if (removed.length) {
        lines.push(<>removed {word}{removed.length > 1 ? "s" : ""} {joinNames(removed)}</>);
      }
      return lines;
    }
    case "assignees":
    case "owner": {
      const { added, removed } = diffLists(change);
      const lines: ReactNode[] = [];
      if (key === "owner") {
        if (added.length) lines.push(<>made {joinNames(added)} the owner</>);
        else if (removed.length) lines.push(<>removed {joinNames(removed)} as owner</>);
        return lines;
      }
      if (added.length) lines.push(<>assigned {joinNames(added)}</>);
      if (removed.length) lines.push(<>unassigned {joinNames(removed)}</>);
      return lines;
    }
    case "description":
      return ["edited the description"];
    case "notes":
      return ["edited the notes"];
    case "deal_share_bps":
      return ["updated the deal split"];
    case "client":
      return [
        <>
          converted this lead into client <B>{text(change.to) ?? "a client"}</B>
        </>,
      ];
    case "project":
      return [
        <>
          moved this {noun} to project <B>{text(change.to) ?? "another project"}</B>
        </>,
      ];
    case "milestone":
      return [fromTo("milestone", change, text)];
    default:
      return [fromTo(FIELD_LABEL[key] ?? key.replaceAll("_", " "), change, text)];
  }
}

const FIELD_ORDER = [
  "stage",
  "column",
  "project",
  "client",
  "name",
  "title",
  "status",
  "assignees",
  "owner",
  "priority",
  "kind",
  "milestone",
];

function eventLines(event: RecordEvent, entityType: RecordEntityType, currency: IsoCurrency) {
  const keys = Object.keys(event.changes).sort((a, b) => {
    const ai = FIELD_ORDER.indexOf(a);
    const bi = FIELD_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  // A column move already implies the status change.
  const skipStatus = keys.includes("column");
  return keys
    .filter((key) => !(skipStatus && key === "status"))
    .flatMap((key) => describeChange(key, event.changes[key], entityType, currency));
}

function EventRow({
  event,
  entityType,
  currency,
  last,
}: {
  event: RecordEvent;
  entityType: RecordEntityType;
  currency: IsoCurrency;
  last: boolean;
}) {
  const actor = event.actorLabel ?? (event.actorId ? "A teammate" : "Worklane");
  const noun = entityType === "lead" ? "lead" : "card";
  let lines: ReactNode[];
  if (event.action === "created") {
    const place = text(event.changes.stage?.to) ?? text(event.changes.column?.to);
    lines = [
      place ? (
        <>
          created this {noun} in <B>{place}</B>
        </>
      ) : (
        <>created this {noun}</>
      ),
    ];
  } else if (event.action === "deleted") {
    lines = [<>deleted this {noun}</>];
  } else {
    lines = eventLines(event, entityType, currency);
  }
  if (lines.length === 0) return null;
  const [headline, ...rest] = lines;

  return (
    <li className={cn("relative flex gap-3.5", !last && "pb-5")}>
      {!last ? (
        <span className="absolute top-10 bottom-1 left-4 w-px bg-border/70" aria-hidden />
      ) : null}
      <AvatarMark
        name={actor}
        src={event.actorAvatarUrl}
        size="sm"
        className="relative size-8 shrink-0"
      />
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">
            <B>{actor}</B> {headline}
          </p>
          <time
            dateTime={event.createdAt}
            title={new Date(event.createdAt).toLocaleString()}
            className="shrink-0 text-xs tabular-nums text-muted-foreground/70"
          >
            {eventTime(event.createdAt)}
          </time>
        </div>
        {rest.length > 0 ? (
          <ul className="mt-2 space-y-1.5 rounded-xl bg-muted/40 px-3 py-2.5">
            {rest.map((line, index) => (
              <li key={index} className="text-[13px] leading-snug text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function eventTime(iso: string) {
  if (dayKey(iso) === dayKey(new Date().toISOString())) return relativeTime(iso);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function groupByDay(events: RecordEvent[]) {
  const groups: { key: string; label: string; events: RecordEvent[] }[] = [];
  for (const event of events) {
    const key = dayKey(event.createdAt);
    const current = groups[groups.length - 1];
    if (current?.key === key) current.events.push(event);
    else groups.push({ key, label: dayLabel(event.createdAt), events: [event] });
  }
  return groups;
}

export function RecordHistory({
  orgSlug,
  entityType,
  entityId,
  currency = "USD",
  refreshKey,
  className,
}: {
  orgSlug: string;
  entityType: RecordEntityType;
  entityId: string;
  currency?: IsoCurrency;
  /** Change to reload, e.g. the record's `updatedAt`. */
  refreshKey?: string;
  className?: string;
}) {
  const [state, setState] = useState<{
    key: string;
    events: RecordEvent[];
    error?: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const requestKey = `${entityType}:${entityId}:${refreshKey ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    listRecordEventsAction(orgSlug, entityType, entityId)
      .then((result) => {
        if (!cancelled) setState({ key: requestKey, events: result.events, error: result.error });
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, events: [], error: "Could not load history" });
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, entityType, entityId, requestKey]);

  const loading = !state || state.key !== requestKey;
  const events = state?.events ?? [];
  const visible = expanded ? events : events.slice(0, COLLAPSED_COUNT);

  if (loading && events.length === 0) {
    return (
      <div className={cn("space-y-5", className)} aria-busy>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex gap-3.5">
            <span className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5 pt-1">
              <span className="block h-3 w-4/5 animate-pulse rounded bg-muted" />
              <span className="block h-2.5 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (state?.error) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{state.error}</p>;
  }

  if (events.length === 0) {
    return (
      <p
        className={cn(
          "rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No activity yet. Changes will show up here.
      </p>
    );
  }

  return (
    <div className={cn("space-y-7", className)}>
      {groupByDay(visible).map((group) => (
        <section key={group.key}>
          <h4 className="mb-4 flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {group.label}
            <span className="h-px flex-1 bg-border/60" aria-hidden />
          </h4>
          <ol>
            {group.events.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                entityType={entityType}
                currency={currency}
                last={index === group.events.length - 1}
              />
            ))}
          </ol>
        </section>
      ))}
      {events.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : `Show all ${events.length} events`}
        </button>
      ) : null}
    </div>
  );
}
