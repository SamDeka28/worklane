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

/** Editor-style page: toolbar, paper canvas, and a side panel (a peek bar on mobile). */
export function StudioSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lane-panel">
      <div className="flex items-center justify-between gap-4 border-b border-border/40 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2">
          <LaneSkeleton className="h-3 w-24" />
          <LaneSkeleton className="h-7 w-44" />
        </div>
        <div className="flex gap-2">
          <LaneSkeleton className="h-8 w-20" />
          <LaneSkeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 justify-center bg-muted/30 px-3 py-6 sm:px-8 sm:py-10">
          <LaneSkeleton className="h-full max-h-[60rem] w-full max-w-[52rem] rounded-xl" />
        </div>
        <div className="hidden w-[22rem] shrink-0 flex-col gap-4 border-l border-border/40 p-5 lg:flex xl:w-[24rem]">
          <LaneSkeleton className="h-24" />
          <LaneSkeleton className="h-12" />
          <LaneSkeleton className="h-12" />
          <LaneSkeleton className="h-12" />
          <LaneSkeleton className="h-12" />
        </div>
      </div>
    </div>
  );
}
