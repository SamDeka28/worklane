"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function ActionSheet({
  title,
  description,
  triggerLabel,
  triggerVariant = "default",
  triggerDisabled = false,
  hideTrigger = false,
  open,
  onOpenChange,
  side = "right",
  footer,
  children,
}: {
  title: string;
  description?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerDisabled?: boolean;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "right" | "bottom";
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {hideTrigger ? null : (
        <SheetTrigger
          render={<Button variant={triggerVariant} disabled={triggerDisabled} />}
        >
          {triggerLabel ?? title}
        </SheetTrigger>
      )}
      <SheetContent
        side={side}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-lift",
          side === "right" &&
            "data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-auto data-[side=right]:w-[min(100%,42rem)] data-[side=right]:max-w-none data-[side=right]:rounded-[2rem] sm:data-[side=right]:w-[min(100%-1rem,42rem)]",
          side === "bottom" &&
            "data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:h-[min(92vh,56rem)] data-[side=bottom]:max-h-[min(92vh,56rem)] data-[side=bottom]:rounded-[2rem] data-[side=bottom]:border-0",
        )}
      >
        <SheetHeader className="shrink-0 gap-1.5 border-b border-border/50 px-6 py-5 pr-14">
          <SheetTitle className="font-heading text-2xl font-semibold tracking-tight">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border/50 bg-background/95 px-6 py-4 backdrop-blur-sm">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
