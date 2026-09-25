"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  Mail,
  Phone,
  Signpost,
  UserRound,
} from "lucide-react";
import { TagRow, projectToneClass } from "@/components/studio/project-chip";
import { cn } from "@/lib/utils";
import { formatDay } from "@/modules/finance/presentation";
import type { LeadRecord } from "@/modules/crm/types";
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

/** Value badge — sits where the priority mark sits on task cards. */
function ValueMark({ lead, state }: { lead: LeadRecord; state: LeadCardState }) {
  if (lead.estimatedValueMinor == null) return null;
  return (
    <span
      title="Estimated value"
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-lg px-2.5 text-[13px] font-bold tabular-nums tracking-tight",
        state === "won"
          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
          : state === "lost"
            ? "bg-muted text-muted-foreground line-through"
            : "bg-primary/12 text-primary ring-1 ring-primary/20",
      )}
    >
      {formatMoney({ amountMinor: lead.estimatedValueMinor, currency: lead.currency })}
    </span>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: ReactNode | null;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 text-xs">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 opacity-70" aria-hidden />
        {label}
      </span>
      {value ? (
        <span className="min-w-0 truncate text-right font-medium text-foreground/85">{value}</span>
      ) : (
        <span className="text-muted-foreground/50">N/A</span>
      )}
    </div>
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
}: {
  lead: LeadRecord;
  state?: LeadCardState;
  showMoney?: boolean;
  selected?: boolean;
  draggable?: boolean;
  onOpen?: () => void;
  className?: string;
}) {
  const overdue = state === "open" && isPast(lead.closeOn);
  const visibleTags = lead.tags.slice(0, 2);
  const extraTagCount = Math.max(0, lead.tags.length - visibleTags.length);
  const showValue = showMoney && lead.estimatedValueMinor != null;
  const company = lead.company && !same(lead.company, lead.name) ? lead.company : null;
  const contact = lead.contactName?.trim() || null;
  const phone = lead.phone || lead.whatsapp;
  const convertible = state === "won" && !lead.clientId;

  const title = (
    <p
      className={cn(
        "min-w-0 flex-1 text-sm leading-snug font-semibold tracking-tight text-foreground",
        state === "lost" && "text-muted-foreground",
      )}
    >
      {lead.name}
    </p>
  );

  const details = [
    company ? <DetailRow key="company" icon={Building2} label="Company" value={company} /> : null,
    <DetailRow key="contact" icon={UserRound} label="Contact" value={contact} />,
    <DetailRow
      key="email"
      icon={Mail}
      label="Email"
      value={lead.email ? <span title={lead.email}>{lead.email}</span> : null}
    />,
    phone ? <DetailRow key="phone" icon={Phone} label="Phone" value={phone} /> : null,
    <DetailRow key="source" icon={Signpost} label="Source" value={lead.source} />,
  ].filter(Boolean);

  const body = (
    <>
      {visibleTags.length > 0 ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <TagRow className="min-w-0 flex-1 gap-1.5">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  title={tag}
                  className={cn(
                    "inline-block max-w-32 truncate rounded-lg px-2 py-1 text-[11px] font-bold tracking-tight ring-1",
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
            {showValue ? <ValueMark lead={lead} state={state} /> : null}
          </div>
          <div className="mt-2.5 flex">{title}</div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-2">
          {title}
          {showValue ? <ValueMark lead={lead} state={state} /> : null}
        </div>
      )}

      <div className="mt-3 space-y-2">{details}</div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {convertible ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Become a client
              <ArrowRight className="size-3" />
            </span>
          ) : lead.closeOn ? (
            <span
              title="Expected close"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                overdue
                  ? "rounded-lg bg-status-overdue px-2 py-1 text-status-overdue-fg"
                  : "text-foreground/80",
              )}
            >
              <CalendarDays className="size-3.5 opacity-80" />
              {overdue ? "Overdue · " : null}
              {formatDay(lead.closeOn)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <CalendarDays className="size-3.5 opacity-70" />
              No close date
            </span>
          )}
        </div>
        <span
          title={`Last updated ${new Date(lead.updatedAt).toLocaleString()}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Clock3 className="size-3.5 opacity-70" />
          {relativeTime(lead.updatedAt)}
        </span>
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
        <button type="button" className="block w-full px-3.5 py-3 text-left" onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className="px-3.5 py-3">{body}</div>
      )}
    </div>
  );
}
