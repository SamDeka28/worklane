"use client";

import type { CSSProperties, ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

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
        "flex h-full min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4",
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
  /** Override default title/count header (e.g. editable column name). */
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When provided (e.g. sortable column), skips the built-in droppable. */
  setNodeRef?: (node: HTMLElement | null) => void;
  isOver?: boolean;
}) {
  const droppable = useDroppable({ id, disabled: Boolean(externalRef) });
  const setNodeRef = externalRef ?? droppable.setNodeRef;
  const isOver = externalIsOver ?? droppable.isOver;

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-3xl bg-muted/55",
        isOver && "ring-2 ring-sky-300/80",
        className,
      )}
    >
      {header ?? (
        <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
          <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
          {count != null ? (
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {count}
            </span>
          ) : null}
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border/30 p-2">{footer}</div>
      ) : null}
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
          "w-full rounded-2xl bg-card px-3 py-2.5 text-left shadow-sm ring-1 ring-border/40 transition-colors hover:ring-border",
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
        "w-full rounded-2xl bg-card px-3 py-2.5 text-left shadow-sm ring-1 ring-border/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
