"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  type CollisionDetection,
  closestCorners,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/**
 * Prefer whatever is under the pointer (full column hit area), then fall back.
 * Avoids closestCorners treating only the cluster of cards as the drop target.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const cards = pointerHits.filter((hit) => {
      const container = hit.data?.droppableContainer as
        | { data?: { current?: { type?: string } } }
        | undefined;
      const type = container?.data?.current?.type;
      return type === "task" || type === "lead";
    });
    if (cards.length > 0) return cards;
    return pointerHits;
  }

  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) return rectHits;
  return closestCorners(args);
};

/** Mouse: short drag. Touch: long-press so board scroll is not captured. */
export function useBoardDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 280, tolerance: 10 },
    }),
  );
}

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
        "flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden px-4 pt-3 pb-4 sm:gap-4 sm:px-6 sm:pt-4",
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
  bodyClassName,
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
  /** Overrides the card stack spacing. */
  bodyClassName?: string;
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
        "flex h-full min-h-0 w-[min(100vw-2.5rem,20rem)] shrink-0 flex-col overflow-hidden lane-inset transition-[box-shadow,background-color] duration-150 sm:w-80",
        isOver &&
          "bg-primary/12 ring-2 ring-primary dark:bg-primary/18",
        className,
      )}
    >
      {header ?? (
        <header className="flex shrink-0 items-center justify-between gap-2 px-3.5 pt-3.5 pb-2.5">
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {title}
          </p>
          {count != null ? (
            <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
              {count}
            </span>
          ) : null}
        </header>
      )}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-3 pt-1 pb-3",
          bodyClassName,
        )}
      >
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
          "w-full rounded-xl bg-card px-3.5 py-3 text-left shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md",
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
        "w-full rounded-xl bg-card px-3.5 py-3 text-left shadow-sm ring-1 ring-foreground/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
