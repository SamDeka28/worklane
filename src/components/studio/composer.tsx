import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Composer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 p-4 pt-2", className)}>
      {children}
    </div>
  );
}

export function ComposerBar({
  children,
  className,
  prominent = false,
}: {
  children: ReactNode;
  className?: string;
  prominent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center overflow-hidden rounded-3xl px-2",
        prominent
          ? "min-h-12 gap-1 bg-card py-2 shadow-soft ring-1 ring-border/40 sm:min-h-16"
          : "min-h-11 bg-muted/80 shadow-inner sm:min-h-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Workbench({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row md:gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
