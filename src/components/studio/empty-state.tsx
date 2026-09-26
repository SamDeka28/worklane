import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Inbox, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  action,
  icon = Inbox,
  fill = false,
  className,
}: {
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  /** Prefer over actionHref when the CTA opens a sheet/dialog. */
  action?: ReactNode;
  /** Module icon shown in the illustration. */
  icon?: LucideIcon;
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
      <EmptyIllustration icon={icon} centered={fill} />
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
          {/^(new|add)\b/i.test(actionLabel) ? <Plus /> : null}
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function SketchCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute flex h-[4.25rem] w-[7.5rem] flex-col gap-2 rounded-xl bg-card p-3 lane-ring",
        className,
      )}
    >
      <span className="h-1.5 w-2/3 rounded-full bg-muted-foreground/25" />
      <span className="h-1.5 w-full rounded-full bg-muted-foreground/15" />
      <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/15" />
    </div>
  );
}

function EmptyIllustration({
  icon: Icon,
  centered,
}: {
  icon: LucideIcon;
  centered: boolean;
}) {
  return (
    <div
      className={cn("relative mb-6 h-28 w-48", centered && "mx-auto")}
      aria-hidden
    >
      <div className="absolute inset-x-8 top-6 h-16 rounded-full bg-primary/25 blur-2xl" />
      <SketchCard className="top-7 left-0 -rotate-[8deg] opacity-80" />
      <SketchCard className="top-3 right-0 rotate-[6deg]" />
      <div className="lane-gradient absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl text-primary-foreground shadow-lg ring-4 ring-[color:var(--inset)]">
        <Icon className="size-6" strokeWidth={2} />
      </div>
      <span className="absolute top-1 left-10 size-1.5 rounded-full bg-primary/70" />
      <span className="absolute right-8 bottom-1 size-2 rounded-full bg-[color:var(--lane-magenta)] opacity-70" />
      <span className="absolute bottom-5 left-3 size-1 rounded-full bg-[color:var(--lane-violet)] opacity-80" />
    </div>
  );
}
