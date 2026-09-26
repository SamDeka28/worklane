"use client";

import { ArrowRight, Building2, CalendarClock, CalendarDays, Hourglass, Signpost } from "lucide-react";
import { AvatarMark } from "@/components/studio/avatar-mark";
import { TagRow, projectToneClass } from "@/components/studio/project-chip";
import { cn } from "@/lib/utils";
import { formatDay } from "@/modules/finance/presentation";
import { dueLabel } from "@/modules/crm/presentation";
import {
  daysSince,
  followState,
  isStale,
  type CrmMember,
  type LeadRecord,
} from "@/modules/crm/types";
import { relativeTime } from "@/modules/notifications/components/notification-item";
import { formatMoney } from "@/shared/money";

export type LeadCardState = "open" | "won" | "lost";

function isPast(day: string | null) {
  if (!day) return false;
  return day < new Date().toISOString().slice(0, 10);
}

function same(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

/** Estimated value — plain figure like totals elsewhere; colour only for won / lost. */
function ValueMark({ lead, state }: { lead: LeadRecord; state: LeadCardState }) {
  if (lead.estimatedValueMinor == null) return null;
  return (
    <span
      title="Estimated value"
      className={cn(
        "shrink-0 text-[13px] font-semibold tabular-nums tracking-tight",
        state === "won"
          ? "text-emerald-600 dark:text-emerald-400"
          : state === "lost"
            ? "text-muted-foreground line-through"
            : "text-foreground",
      )}
    >
      {formatMoney({ amountMinor: lead.estimatedValueMinor, currency: lead.currency })}
    </span>
  );
}

export function LeadBoardCard({
  lead,
  state = "open",
  showMoney = true,
  selected = false,
  draggable = false,
  onOpen,
  className,
  owner,
  staleDays = 0,
}: {
  lead: LeadRecord;
  state?: LeadCardState;
  showMoney?: boolean;
  selected?: boolean;
  draggable?: boolean;
  onOpen?: () => void;
  className?: string;
  owner?: CrmMember | null;
  staleDays?: number;
}) {
  const overdue = state === "open" && isPast(lead.closeOn);
  const follow = state === "open" ? followState(lead) : "none";
  const stale = state === "open" && isStale(lead, staleDays);
  const visibleTags = lead.tags.slice(0, 2);
  const extraTagCount = Math.max(0, lead.tags.length - visibleTags.length);
  const showValue = showMoney && lead.estimatedValueMinor != null;
  const company = lead.company && !same(lead.company, lead.name) ? lead.company : null;
  const reach = lead.email || lead.phone || lead.whatsapp || null;
  const convertible = state === "won" && !lead.clientId;

  const body = (
    <>
      {visibleTags.length > 0 ? (
        <TagRow className="mb-2 gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              title={tag}
              className={cn(
                "inline-block max-w-32 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tracking-tight ring-1",
                projectToneClass(tag),
              )}
            >
              {tag}
            </span>
          ))}
          {extraTagCount > 0 ? (
            <span className="text-[11px] font-semibold text-muted-foreground">
              +{extraTagCount}
            </span>
          ) : null}
        </TagRow>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-snug font-medium tracking-tight text-foreground",
            state === "lost" && "text-muted-foreground",
          )}
        >
          {lead.name}
        </p>
        {showValue ? <ValueMark lead={lead} state={state} /> : null}
      </div>

      {company || reach ? (
        <p
          className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
          title={[company, reach].filter(Boolean).join(" · ")}
        >
          {company ? <Building2 className="size-3 shrink-0 opacity-70" aria-hidden /> : null}
          <span className="truncate">{[company, reach].filter(Boolean).join(" · ")}</span>
        </p>
      ) : null}

      {state === "open" && (lead.nextAction || stale) ? (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
          {lead.nextAction ? (
            <span
              title={`Next step: ${lead.nextAction}`}
              className={cn(
                "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                follow === "overdue"
                  ? "bg-status-overdue text-status-overdue-fg"
                  : follow === "today"
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <CalendarClock className="size-3 shrink-0" aria-hidden />
              <span className="truncate">
                {lead.nextActionOn ? `${dueLabel(lead.nextActionOn)} · ` : ""}
                {lead.nextAction}
              </span>
            </span>
          ) : null}
          {stale ? (
            <span
              title="No calls, emails, or stage moves logged recently"
              className="inline-flex items-center gap-1 rounded-md bg-orange-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300"
            >
              <Hourglass className="size-3" aria-hidden />
              {daysSince(lead.lastTouchedAt)}d quiet
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {convertible ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Become a client
              <ArrowRight className="size-3" />
            </span>
          ) : lead.closeOn ? (
            <span
              title="Expected close"
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-[11px] font-medium",
                overdue
                  ? "rounded-md bg-status-overdue px-1.5 py-0.5 text-status-overdue-fg"
                  : "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3 opacity-80" />
              {formatDay(lead.closeOn)}
            </span>
          ) : null}
          {lead.source ? (
            <span
              title="Source"
              className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
            >
              <Signpost className="size-3 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{lead.source}</span>
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            title={`Last touched ${new Date(lead.lastTouchedAt).toLocaleString()}`}
            className="text-[11px] text-muted-foreground/80 tabular-nums"
            suppressHydrationWarning
          >
            {relativeTime(lead.lastTouchedAt)}
          </span>
          {owner ? (
            <span title={`Owner: ${owner.name}`}>
              <AvatarMark name={owner.name} src={owner.avatarUrl} size="sm" />
            </span>
          ) : state === "open" ? (
            <span
              title="Unassigned"
              className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-border text-[10px] font-semibold text-muted-foreground"
            >
              ?
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "group/card relative w-full rounded-xl bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color,background-color] duration-150",
        onOpen &&
          !selected &&
          "hover:-translate-y-px hover:shadow-md hover:ring-foreground/16",
        selected &&
          "bg-primary/10 ring-2 ring-primary/60 dark:bg-primary/15 dark:ring-primary",
        state === "lost" && !selected && "opacity-75",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      {onOpen ? (
        <button type="button" className="block w-full px-3 py-2.5 text-left" onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className="px-3 py-2.5">{body}</div>
      )}
    </div>
  );
}
