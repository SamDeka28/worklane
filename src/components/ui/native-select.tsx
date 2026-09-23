import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "relative inline-flex h-10 w-full min-w-0 items-center rounded-lg bg-muted/60 ring-1 ring-border/40",
        "transition-[box-shadow,background-color,ring-color] hover:bg-muted/80",
        "focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/25",
        className,
      )}
    >
      <select
        data-slot="select"
        className="h-full w-full min-w-0 appearance-none bg-transparent py-0 pr-10 pl-3 text-sm font-medium tracking-tight text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
