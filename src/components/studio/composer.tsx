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
        "flex items-center overflow-hidden rounded-3xl px-2",
        prominent
          ? "min-h-16 gap-1 bg-card py-2 shadow-soft ring-1 ring-border/40"
          : "min-h-12 bg-muted/80 shadow-inner",
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
    <div className={cn("flex min-h-0 flex-1 gap-3 overflow-hidden", className)}>
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
    <div className={cn("min-h-0 flex-1 overflow-auto", className)}>{children}</div>
  );
}
