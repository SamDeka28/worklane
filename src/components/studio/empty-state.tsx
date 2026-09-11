import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  action,
  fill = false,
  className,
}: {
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  /** Prefer over actionHref when the CTA opens a sheet/dialog. */
  action?: ReactNode;
  /** Center in remaining workspace height */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] bg-muted/35 px-6 py-8 ring-1 ring-border/30",
        fill && "flex min-h-0 flex-1 flex-col items-center justify-center text-center",
        className,
      )}
    >
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {body ? (
        <p
          className={cn(
            "mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground",
            fill && "mx-auto",
          )}
        >
          {body}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5">{action}</div>
      ) : actionHref && actionLabel ? (
        <Button
          className="mt-5"
          size="lg"
          nativeButton={false}
          render={<Link href={actionHref} />}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
