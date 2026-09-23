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
        "rounded-2xl bg-inset/80 px-6 py-10 lane-ring",
        fill && "flex min-h-0 flex-1 flex-col items-center justify-center text-center",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 size-12 rounded-2xl bg-card lane-ring",
          fill && "mx-auto",
        )}
        aria-hidden
      >
        <div className="lane-gradient size-full rounded-2xl opacity-90" />
      </div>
      <p className="text-xl font-bold tracking-tight">{title}</p>
      {body ? (
        <p
          className={cn(
            "mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground",
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
