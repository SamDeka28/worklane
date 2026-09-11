import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SoftField({
  label,
  htmlFor,
  children,
  hint,
  error,
  required,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold tracking-tight text-foreground"
      >
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer SoftField — kept as alias for existing imports. */
export function Field(props: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return <SoftField {...props} />;
}

export function SoftControl({
  children,
  leading,
  trailing,
  className,
}: {
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-12 w-full min-w-0 items-center gap-2 rounded-2xl bg-muted/70 px-4 ring-1 ring-border/50 transition-[box-shadow,background-color,ring-color]",
        "hover:bg-muted",
        "focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/30",
        "has-[[aria-invalid=true]]:ring-destructive/40",
        className,
      )}
    >
      {leading ? (
        <span className="shrink-0 text-sm text-muted-foreground">{leading}</span>
      ) : null}
      <div className="min-w-0 flex-1 [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:rounded-none [&_[data-slot=input]]:bg-transparent [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:ring-0 [&_[data-slot=input]]:focus-visible:bg-transparent [&_[data-slot=input]]:focus-visible:ring-0">
        {children}
      </div>
      {trailing ? (
        <span className="shrink-0 text-sm text-muted-foreground">{trailing}</span>
      ) : null}
    </div>
  );
}
