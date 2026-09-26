"use client";

import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bug,
  CalendarDays,
  CheckSquare,
  Equal,
  GripVertical,
  MessageSquare,
  Sparkles,
  Wrench,
} from "lucide-react";
import { AvatarStack } from "@/components/studio/avatar-mark";
import { ProjectChip, TagRow, projectToneClass } from "@/components/studio/project-chip";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { CopyTaskLinkIcon } from "@/modules/delivery/components/copy-task-link";
import { formatDay } from "@/modules/finance/presentation";
import type { TaskKind, TaskPriority } from "@/modules/delivery/types";

/** Color lives only on the badge — cards stay neutral. */
export const PRIORITY_MARK: Record<
  TaskPriority,
  { letter: string; label: string; badge: string; Icon: typeof ArrowUp }
> = {
  high: {
    letter: "H",
    label: "High",
    badge: "bg-rose-600 text-white shadow-sm shadow-rose-600/20",
    Icon: ArrowUp,
  },
  medium: {
    letter: "M",
    label: "Medium",
    badge: "bg-amber-500 text-amber-950 shadow-sm shadow-amber-500/25 dark:text-amber-950",
    Icon: Equal,
  },
  low: {
    letter: "L",
    label: "Low",
    badge: "bg-sky-600 text-white shadow-sm shadow-sky-600/20",
    Icon: ArrowDown,
  },
};

export const KIND_MARK: Record<
  TaskKind,
  { label: string; Icon: typeof CheckSquare; tone: string }
> = {
  task: {
    label: "Task",
    Icon: CheckSquare,
    tone: "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:bg-sky-400/20 dark:text-sky-200 dark:ring-sky-400/30",
  },
  bug: {
    label: "Bug",
    Icon: Bug,
    tone: "bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:bg-rose-400/20 dark:text-rose-200 dark:ring-rose-400/30",
  },
  feature: {
    label: "Feature",
    Icon: Sparkles,
    tone: "bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:bg-violet-400/20 dark:text-violet-200 dark:ring-violet-400/30",
  },
  chore: {
    label: "Chore",
    Icon: Wrench,
    tone: "bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:bg-amber-400/20 dark:text-amber-100 dark:ring-amber-400/30",
  },
};

export function KindMark({
  kind,
  className,
  showLabel = false,
}: {
  kind: TaskKind;
  className?: string;
  showLabel?: boolean;
}) {
  const mark = KIND_MARK[kind];
  const Icon = mark.Icon;
  return (
    <span
      title={mark.label}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold tracking-tight ring-1",
        mark.tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {showLabel ? mark.label : null}
    </span>
  );
}

function isOverdue(dueOn: string | null | undefined) {
  if (!dueOn) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueOn < today;
}

export type CardPerson = {
  name: string;
  src?: string | null;
};

export function PriorityMark({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const mark = PRIORITY_MARK[priority];
  const Icon = mark.Icon;
  return (
    <span
      title={mark.label}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold tracking-wide",
        mark.badge,
        className,
      )}
    >
      {/* <Icon className="size-3.5 strokimage.pnge-[2.5]" aria-hidden /> */}
      {mark.letter}
    </span>
  );
}

export function TaskBoardCard({
  title,
  priority,
  kind = "task",
  labels = [],
  dueOn,
  milestoneLabel,
  projectLabel,
  people = [],
  commentCount = 0,
  selected = false,
  dragHandle,
  onOpen,
  shareId,
  className,
}: {
  title: string;
  /** Task id; shows a copy-link icon on hover. */
  shareId?: string;
  /** Kept for callers; intentionally not shown on the card face. */
  description?: string | null;
  priority: TaskPriority;
  kind?: TaskKind;
  labels?: string[];
  dueOn?: string | null;
  milestoneLabel?: string | null;
  projectLabel?: string | null;
  clientLabel?: string | null;
  people?: CardPerson[];
  commentCount?: number;
  selected?: boolean;
  dragHandle?: ReactNode;
  onOpen?: () => void;
  className?: string;
}) {
  const overdue = isOverdue(dueOn);
  const visibleLabels = labels.slice(0, 2);
  const extraLabelCount = Math.max(0, labels.length - visibleLabels.length);
  const hasTags = Boolean(projectLabel || milestoneLabel || kind !== "task");
  const hasMeta = Boolean(dueOn) || commentCount > 0 || people.length > 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {hasTags ? (
          <TagRow className="min-w-0 flex-1">
            {kind !== "task" ? <KindMark kind={kind} /> : null}
            {projectLabel ? <ProjectChip label={projectLabel} /> : null}
            {milestoneLabel ? <StatusChip tone="planning">{milestoneLabel}</StatusChip> : null}
          </TagRow>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <PriorityMark priority={priority} />
      </div>

      <p className="mt-1.5 text-[13px] leading-snug font-medium tracking-tight text-foreground">
        {title}
      </p>

      {visibleLabels.length > 0 ? (
        <TagRow className="mt-2">
          {visibleLabels.map((label) => (
            <span
              key={label}
              className={cn(
                "inline-flex max-w-28 truncate rounded-lg px-2 py-1 text-[11px] font-bold tracking-tight ring-1",
                projectToneClass(label),
              )}
            >
              {label}
            </span>
          ))}
          {extraLabelCount > 0 ? (
            <span className="text-[11px] font-semibold text-muted-foreground">
              +{extraLabelCount}
            </span>
          ) : null}
        </TagRow>
      ) : null}

      {hasMeta ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {dueOn ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  overdue
                    ? "rounded-lg bg-status-overdue px-2 py-1 text-status-overdue-fg"
                    : "text-muted-foreground",
                )}
              >
                <CalendarDays className="size-3 opacity-80" />
                {formatDay(dueOn)}
              </span>
            ) : null}
            {commentCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <MessageSquare className="size-3" />
                {commentCount}
              </span>
            ) : null}
          </div>
          {people.length > 0 ? <AvatarStack people={people} size="sm" max={3} /> : null}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "group/card relative w-full rounded-xl bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color,background-color,color] duration-150",
        onOpen &&
          !selected &&
          "hover:-translate-y-px hover:shadow-md hover:ring-foreground/16",
        selected &&
          "bg-primary/10 ring-2 ring-primary/60 dark:bg-primary/15 dark:ring-primary",
        className,
      )}
    >
      <div className="flex items-start gap-0.5 px-2.5 py-2.5">
        {dragHandle}
        <div className="min-w-0 flex-1">
          {onOpen ? (
            <button type="button" className="w-full text-left" onClick={onOpen}>
              {body}
            </button>
          ) : (
            body
          )}
        </div>
      </div>
      {shareId ? (
        <CopyTaskLinkIcon
          taskId={shareId}
          className="absolute top-2.5 right-10 bg-card opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        />
      ) : null}
    </div>
  );
}

export function TaskDragHandle({
  listeners,
  attributes,
  setActivatorRef,
  disabled,
}: {
  listeners?: object;
  attributes?: object;
  setActivatorRef?: (element: HTMLElement | null) => void;
  disabled?: boolean;
}) {
  if (disabled) return null;
  const interactive = Boolean(listeners);
  return (
    <button
      type="button"
      ref={setActivatorRef}
      className={cn(
        "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50",
        interactive
          ? "cursor-grab opacity-0 transition-all group-hover/card:opacity-100 hover:bg-muted hover:text-foreground active:cursor-grabbing focus-visible:opacity-100"
          : "cursor-grab opacity-40",
      )}
      aria-label="Drag card"
      tabIndex={interactive ? undefined : -1}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}
