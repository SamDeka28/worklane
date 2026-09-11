import { cn } from "@/lib/utils";

export function LaneSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("lane-skeleton rounded-lg", className)}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <LaneSkeleton className="h-3 w-24" />
          <LaneSkeleton className="h-8 w-56" />
        </div>
        <LaneSkeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <LaneSkeleton className="h-28" />
        <LaneSkeleton className="h-28" />
        <LaneSkeleton className="h-28" />
      </div>
      <LaneSkeleton className="h-72" />
    </div>
  );
}
