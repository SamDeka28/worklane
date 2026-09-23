"use client";

import type { ReactNode } from "react";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  const [optimisticActive, setOptimisticActive] = useOptimistic(Boolean(active));

  useEffect(() => {
    if (!optimisticActive) return;
    ref.current?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [optimisticActive]);

  return (
    <button
      ref={ref}
      type="button"
      aria-current={optimisticActive ? "page" : undefined}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onClick={() => {
        if (optimisticActive) return;
        start(() => {
          setOptimisticActive(true);
          router.push(href, { scroll: false });
        });
      }}
      className={cn(
        "shrink-0 rounded-lg px-3 py-2 text-sm font-medium tracking-tight whitespace-nowrap transition-[background-color,color,box-shadow,opacity] duration-150",
        optimisticActive
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimisticActive, setOptimisticActive] = useOptimistic(Boolean(active));

  return (
    <button
      type="button"
      aria-current={optimisticActive ? "page" : undefined}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onClick={() => {
        if (optimisticActive) return;
        start(() => {
          setOptimisticActive(true);
          router.push(href, { scroll: false });
        });
      }}
      className={cn(
        "rounded-lg px-3.5 py-2 text-sm font-medium tracking-tight transition-[colors,opacity]",
        optimisticActive
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground",
        pending && "opacity-80",
      )}
    >
      {children}
    </button>
  );
}
