"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { shareRequest } from "@/lib/share-request";
import { cn } from "@/lib/utils";
import {
  deleteLeadActivityAction,
  listLeadTimelineAction,
  logLeadActivityAction,
} from "@/modules/crm/follow-actions";
import {
  LEAD_ACTIVITY_KINDS,
  LEAD_ACTIVITY_LABEL,
  todayIso,
  type LeadActivityKind,
  type LeadEmailInfo,
  type LeadTimelineItem,
} from "@/modules/crm/types";
import { relativeTime } from "@/modules/notifications/components/notification-item";

const KIND_ICON: Record<LeadActivityKind, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  message: MessageCircle,
  note: StickyNote,
  form: Inbox,
};

const KIND_TONE: Record<LeadActivityKind, string> = {
  call: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  email: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  meeting: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  message: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
  note: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  form: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
};

const PLACEHOLDER: Record<string, string> = {
  call: "What did you talk about? Any decisions?",
  email: "What did you send or hear back?",
  meeting: "Who was there and what was agreed?",
  message: "WhatsApp, LinkedIn, Slack… what was said?",
  note: "Anything worth remembering.",
};

const COLLAPSED = 6;

function when(iso: string) {
  const date = new Date(iso);
  if (Date.now() - date.getTime() < 86_400_000) return relativeTime(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function LeadTimeline({
  orgSlug,
  leadId,
  canWrite,
  canDelete,
  currentUserId,
  refreshKey,
  showTitle = true,
}: {
  orgSlug: string;
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
  currentUserId: string;
  refreshKey: string;
  showTitle?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<string>("call");
  const [body, setBody] = useState("");
  const [day, setDay] = useState(todayIso());
  const [expanded, setExpanded] = useState(false);
  const [reload, setReload] = useState(0);
  const requestKey = `${leadId}:${refreshKey}:${reload}`;
  const [state, setState] = useState<{ key: string; items: LeadTimelineItem[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    shareRequest(`lead-timeline:${orgSlug}:${requestKey}`, () => listLeadTimelineAction(orgSlug, leadId))
      .then((result) => {
        if (!cancelled) setState({ key: requestKey, items: result.items });
      })
      .catch(() => {
        if (!cancelled) setState({ key: requestKey, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, leadId, requestKey]);

  const current = state?.key.startsWith(`${leadId}:`) ? state : null;
  const items = current?.items ?? [];
  const loading = !current;
  const visible = expanded ? items : items.slice(0, COLLAPSED);

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const result = await logLeadActivityAction(orgSlug, leadId, {
        kind,
        body,
        happenedOn: day,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setBody("");
      setDay(todayIso());
      setReload((value) => value + 1);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4" aria-label={showTitle ? undefined : "Timeline"}>
      {showTitle ? (
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Timeline
        </h3>
      ) : null}

      {canWrite ? (
        <div className="rounded-2xl bg-muted/40 p-3 ring-1 ring-foreground/6">
          <div role="radiogroup" aria-label="Activity type" className="flex flex-wrap gap-1.5">
            {LEAD_ACTIVITY_KINDS.map((option) => {
              const Icon = KIND_ICON[option];
              const active = kind === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(option)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
                    active
                      ? "bg-foreground text-background ring-foreground"
                      : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {LEAD_ACTIVITY_LABEL[option]}
                </button>
              );
            })}
          </div>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={PLACEHOLDER[kind]}
            rows={2}
            maxLength={4000}
            className="mt-3 min-h-16 bg-card"
            aria-label="Summary"
          />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <input
              type="date"
              value={day}
              max={todayIso()}
              onChange={(event) => setDay(event.target.value || todayIso())}
              aria-label="When it happened"
              className="h-8 rounded-full bg-card px-3 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 outline-none"
            />
            <Button type="button" size="sm" disabled={pending || !body.trim()} onClick={submit}>
              {pending ? "Logging…" : `Log ${LEAD_ACTIVITY_LABEL[kind as LeadActivityKind].toLowerCase()}`}
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy>
          {[0, 1].map((index) => (
            <div key={index} className="flex gap-3">
              <span className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
              <span className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing logged yet. Log calls, emails, and meetings so anyone can pick this up.
        </p>
      ) : (
        <ol className="space-y-1">
          {visible.map((item, index) => (
            <TimelineRow
              key={item.type === "activity" ? item.activity.id : item.id}
              item={item}
              last={index === visible.length - 1}
              canRemove={
                item.type === "activity" &&
                item.activity.kind !== "form" &&
                !item.activity.email &&
                (canDelete || (canWrite && item.activity.actorId === currentUserId))
              }
              onRemove={() => {
                if (item.type !== "activity") return;
                start(async () => {
                  const result = await deleteLeadActivityAction(orgSlug, item.activity.id);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  setReload((value) => value + 1);
                });
              }}
            />
          ))}
        </ol>
      )}
      {items.length > COLLAPSED ? (
        <button
          type="button"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      ) : null}
    </section>
  );
}

function TimelineRow({
  item,
  last,
  canRemove,
  onRemove,
}: {
  item: LeadTimelineItem;
  last: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  if (item.type === "stage") {
    const actor = item.actorLabel ?? "Worklane";
    return (
      <li className={cn("relative flex gap-3", !last && "pb-3")}>
        {!last ? <span className="absolute top-9 bottom-0 left-4 w-px bg-border/60" aria-hidden /> : null}
        <span className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ArrowRight className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 pt-1.5 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{actor}</span>{" "}
          {item.from ? (
            <>
              moved it from <span className="font-medium text-foreground">{item.from}</span> to{" "}
            </>
          ) : (
            "added it to "
          )}
          <span className="font-medium text-foreground">{item.to}</span>
        </p>
        <time className="shrink-0 pt-1.5 text-xs text-muted-foreground/70" dateTime={item.at}>
          {when(item.at)}
        </time>
      </li>
    );
  }

  const activity = item.activity;
  const Icon = activity.body?.startsWith("Sent “") ? FileText : KIND_ICON[activity.kind];
  const actor = activity.actorLabel ?? (activity.kind === "form" ? "Website form" : "Worklane");
  return (
    <li className={cn("group/row relative flex gap-3", !last && "pb-3")}>
      {!last ? <span className="absolute top-9 bottom-0 left-4 w-px bg-border/60" aria-hidden /> : null}
      <span
        className={cn(
          "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          KIND_TONE[activity.kind],
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{LEAD_ACTIVITY_LABEL[activity.kind]}</span>
            {" · "}
            {actor}
          </p>
          <time className="shrink-0 text-xs text-muted-foreground/70" dateTime={activity.happenedAt}>
            {when(activity.happenedAt)}
          </time>
          {canRemove ? (
            <button
              type="button"
              aria-label="Remove entry"
              onClick={onRemove}
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
        {activity.email ? (
          <SentEmail email={activity.email} body={activity.body} />
        ) : activity.body ? (
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {activity.body}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function SentEmail({ email, body }: { email: LeadEmailInfo; body: string | null }) {
  const [open, setOpen] = useState(false);
  const status = !email.trackOpens
    ? { label: "Opens not tracked", tone: "bg-muted text-muted-foreground" }
    : email.openCount > 0 && email.lastOpenedAt
      ? {
          label: `Opened${email.openCount > 1 ? ` ${email.openCount}×` : ""} · ${when(email.lastOpenedAt)}`,
          tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        }
      : { label: "Not opened yet", tone: "bg-muted text-muted-foreground" };
  return (
    <div className="mt-1.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{email.subject}</p>
        <span
          className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", status.tone)}
          title={email.firstOpenedAt ? `First opened ${new Date(email.firstOpenedAt).toLocaleString()}` : undefined}
          suppressHydrationWarning
        >
          {status.label}
        </span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">To {email.toEmail}</p>
      {body ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "mt-2 block w-full text-left text-sm leading-relaxed whitespace-pre-wrap text-foreground/85",
            !open && "line-clamp-3",
          )}
          aria-expanded={open}
        >
          {body}
        </button>
      ) : null}
    </div>
  );
}
