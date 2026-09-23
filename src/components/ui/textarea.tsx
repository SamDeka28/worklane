import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg bg-muted/60 px-3 py-2.5 text-sm font-medium tracking-tight text-foreground outline-none",
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

export { Textarea };
