import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg bg-muted/60 px-3 text-sm font-medium tracking-tight text-foreground outline-none",
        "ring-1 ring-border/40 transition-[box-shadow,background-color,ring-color]",
        "placeholder:font-normal placeholder:text-muted-foreground/80",
        "hover:bg-muted/80",
        "focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:ring-destructive/40 aria-invalid:focus-visible:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
