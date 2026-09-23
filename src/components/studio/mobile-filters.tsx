"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ListFilter, X } from "lucide-react";
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

/** Compact filter trigger + sheet for narrow viewports. */
export function MobileFilters({
  title = "Filters",
  description,
  activeCount = 0,
  children,
  className,
  triggerClassName,
}: {
  title?: string;
  description?: string;
  activeCount?: number;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("md:hidden", className)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("gap-1.5", triggerClassName)}
              aria-label={title}
            >
              <ListFilter className="size-3.5" />
              Filters
              {activeCount > 0 ? (
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          }
        />
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:max-h-[min(85vh,36rem)] data-[side=bottom]:rounded-[1.5rem] data-[side=bottom]:border-0 data-[side=bottom]:p-0 data-[side=bottom]:shadow-soft"
        >
          <SheetHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border/40 px-5 py-4 text-left">
            <div className="min-w-0 space-y-1">
              <SheetTitle>{title}</SheetTitle>
              {description ? (
                <SheetDescription>{description}</SheetDescription>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close filters"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-5 py-4">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Desktop-only filter controls (hidden on small screens). */
export function DesktopFilters({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hidden min-w-0 flex-1 md:flex md:flex-wrap md:items-center md:gap-2", className)}>
      {children}
    </div>
  );
}
