"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  type CollisionDetection,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/**
 * Prefer whatever is under the pointer (full column hit area), then fall back.
 * Avoids closestCorners treating only the cluster of cards as the drop target.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const tasks = pointerHits.filter((hit) => {
      const container = hit.data?.droppableContainer as
        | { data?: { current?: { type?: string } } }
        | undefined;
      return container?.data?.current?.type === "task";
    });
    if (tasks.length > 0) return tasks;
    return pointerHits;
  }

  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) return rectHits;
  return closestCorners(args);
};

export function BoardCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 items-start gap-2.5 overflow-x-auto overflow-y-auto px-3 pb-3 sm:gap-3 sm:px-4 sm:pb-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BoardColumn({
  id,
  title,
  count,
  header,
  children,
  footer,
  className,
  style,
  setNodeRef: externalRef,
  isOver: externalIsOver,
}: {
  id: string;
  title?: string;
  count?: number;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  isOver?: boolean;
}) {
  const droppable = useDroppable({
    id,
    data: { type: "column" as const },
    disabled: Boolean(externalRef),
  });
  const setNodeRef = externalRef ?? droppable.setNodeRef;
  const isOver = externalIsOver ?? droppable.isOver;

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex max-h-full w-[min(100vw-2.5rem,20rem)] shrink-0 flex-col self-start overflow-hidden lane-inset transition-[box-shadow,background-color] duration-150 sm:w-80",
        isOver &&
          "bg-primary/12 ring-2 ring-primary dark:bg-primary/18",
        className,
      )}
    >
      {header ?? (
        <header className="flex shrink-0 items-center justify-between gap-2 px-3.5 pt-3.5 pb-2.5">
          <p className="truncate text-[12px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            {title}
          </p>
          {count != null ? (
            <span className="rounded-lg bg-card px-2.5 py-1 text-xs font-bold tabular-nums text-muted-foreground shadow-sm lane-ring">
              {count}
            </span>
          ) : null}
        </header>
      )}
      <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5">
        {children}
      </div>
      {footer ? <div className="shrink-0 p-2.5">{footer}</div> : null}
    </section>
  );
}

export function BoardCardShell({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full rounded-xl bg-card px-3.5 py-3 text-left shadow-sm ring-1 ring-white/10 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md",
          className,
        )}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "w-full rounded-xl bg-card px-3.5 py-3 text-left shadow-sm ring-1 ring-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
