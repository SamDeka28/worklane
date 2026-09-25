"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Side panel on desktop; below `lg` the same tree becomes a bottom drawer that
 * peeks as a handle bar, so form state survives resizing and nothing renders twice.
 * Pair with `STUDIO_DRAWER_CLEARANCE` on the main column so the peek bar never hides content.
 */
export function StudioDrawer({
  label,
  summary,
  className,
  bodyClassName,
  children,
}: {
  label: string;
  summary?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onResize = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-[1.75rem] bg-card shadow-lift ring-1 ring-border/60",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]",
          "lg:static lg:inset-auto lg:z-auto lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:rounded-none lg:bg-transparent lg:shadow-none lg:ring-0 lg:transition-none",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="relative flex h-14 shrink-0 items-center gap-3 px-5 text-left lg:hidden"
        >
          <span className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-muted-foreground/25" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold tracking-tight">{label}</span>
            {summary ? (
              <span className="block truncate text-xs text-muted-foreground">{summary}</span>
            ) : null}
          </span>
          <ChevronUp
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </button>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/40 lg:border-t-0",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </aside>
    </>
  );
}

/** Bottom padding for the main column so the collapsed drawer doesn't cover it. */
export const STUDIO_DRAWER_CLEARANCE = "pb-16 lg:pb-0";
