"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useOptimistic, useRef } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type TabNavValue = { target: string | null; go: (href: string) => void };

const TabNavContext = createContext<TabNavValue | null>(null);

/**
 * Shares one pending navigation across a tab strip and its panel, so the clicked tab
 * takes over the active state at once and the panel can show a placeholder meanwhile.
 */
export function TabNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [target, setTarget] = useOptimistic<string | null>(null);

  function go(href: string) {
    start(() => {
      setTarget(href);
      router.push(href, { scroll: false });
    });
  }

  return <TabNavContext.Provider value={{ target, go }}>{children}</TabNavContext.Provider>;
}

/** Tab content; swaps to a skeleton while a `TabNav` navigation is in flight. */
export function TabPanel({ children }: { children: ReactNode }) {
  const nav = useContext(TabNavContext);
  if (!nav?.target) return <>{children}</>;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-4 sm:px-5" aria-busy="true">
      <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-3xl bg-muted/70" />
      <div className="h-16 animate-pulse rounded-3xl bg-muted/60" />
      <div className="h-16 animate-pulse rounded-3xl bg-muted/50" />
    </div>
  );
}

function useTabNavigation(href: string, active: boolean | undefined) {
  const router = useRouter();
  const nav = useContext(TabNavContext);
  const [pending, start] = useTransition();
  const [optimisticActive, setOptimisticActive] = useOptimistic(Boolean(active));
  const isActive = nav?.target ? nav.target === href : optimisticActive;

  function navigate() {
    if (isActive) return;
    if (nav) {
      nav.go(href);
      return;
    }
    start(() => {
      setOptimisticActive(true);
      router.push(href, { scroll: false });
    });
  }

  return {
    isActive,
    pending: pending || Boolean(nav?.target && nav.target === href),
    navigate,
    prefetch: () => router.prefetch(href),
  };
}

/** Peer nav tab — quiet segmented control with optimistic active + hover prefetch. */
export function SoftTab({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { isActive, pending, navigate, prefetch } = useTabNavigation(href, active);

  useEffect(() => {
    if (!isActive) return;
    ref.current?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [isActive]);

  return (
    <button
      ref={ref}
      type="button"
      aria-current={isActive ? "page" : undefined}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onClick={navigate}
      className={cn(
        "shrink-0 rounded-lg px-3 py-2 text-sm font-medium tracking-tight whitespace-nowrap transition-[background-color,color,box-shadow,opacity] duration-150",
        isActive
          ? "bg-nav-active text-nav-active-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        pending && "opacity-80",
      )}
    >
      {children}
    </button>
  );
}

/** Filter chip — quieter than SoftTab, same control height + optimistic transition. */
export function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  const { isActive, pending, navigate, prefetch } = useTabNavigation(href, active);

  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onClick={navigate}
      className={cn(
        "rounded-lg px-3.5 py-2 text-sm font-medium tracking-tight transition-[colors,opacity]",
        isActive
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
        pending && "opacity-80",
      )}
    >
      {children}
    </button>
  );
}
