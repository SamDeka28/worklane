"use client";

import { Plus } from "lucide-react";
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

type TriggerSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

export function ActionSheet({
  title,
  description,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  triggerIcon,
  triggerIconOnly = false,
  triggerAriaLabel,
  triggerDisabled = false,
  hideTrigger = false,
  open,
  onOpenChange,
  side = "right",
  width = "default",
  footer,
  headerAction,
  tabs,
  narrow = false,
  children,
}: {
  title: string;
  headerAction?: ReactNode;
  /** Tab strip pinned under the header (see `SheetTabs`). */
  tabs?: ReactNode;
  /** Temporarily shrinks a `wide` sheet (animated), e.g. for a single-column view. */
  narrow?: boolean;
  description?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "destructive";
  triggerSize?: TriggerSize;
  triggerIcon?: ReactNode;
  /** When true, renders an icon button (requires triggerIcon). */
  triggerIconOnly?: boolean;
  triggerAriaLabel?: string;
  triggerDisabled?: boolean;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "right" | "bottom";
  /** `wide` fits two-column forms on desktop; collapses to one column on small screens. */
  width?: "default" | "wide";
  footer?: ReactNode;
  children: ReactNode;
}) {
  const label = triggerLabel ?? title;
  const icon =
    triggerIcon !== undefined ? triggerIcon : /^(new|add)\b/i.test(label) ? <Plus /> : null;
  const size = triggerIconOnly
    ? triggerSize.startsWith("icon")
      ? triggerSize
      : "icon-sm"
    : triggerSize;
  const ariaLabel = triggerAriaLabel ?? (triggerIconOnly ? label : undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {hideTrigger ? null : (
        <SheetTrigger
          render={
            <Button
              variant={triggerVariant}
              size={size}
              disabled={triggerDisabled}
              aria-label={ariaLabel}
              title={triggerIconOnly ? label : undefined}
            />
          }
        >
          {icon}
          {triggerIconOnly ? null : label}
        </SheetTrigger>
      )}
      <SheetContent
        side={side}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-lift",
          side === "right" &&
            "data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-auto data-[side=right]:max-w-none data-[side=right]:rounded-[2rem]",
          side === "right" &&
            "[transition-property:opacity,transform,translate,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          side === "right" &&
            (width === "wide"
              ? cn(
                  "data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:sm:max-w-none",
                  narrow
                    ? "data-[side=right]:sm:w-[min(100%-1rem,40rem)]"
                    : "data-[side=right]:sm:w-[calc(100%-1rem)] data-[side=right]:lg:w-[min(100%-1rem,64rem)]",
                )
              : "data-[side=right]:w-[min(100%,42rem)] sm:data-[side=right]:w-[min(100%-1rem,42rem)]"),
          side === "bottom" &&
            "data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:h-[min(92vh,56rem)] data-[side=bottom]:max-h-[min(92vh,56rem)] data-[side=bottom]:rounded-[2rem] data-[side=bottom]:border-0",
        )}
      >
        <SheetHeader
          className={cn(
            "shrink-0 flex-row items-center gap-4 px-6 py-5",
            tabs ? "pb-3" : "border-b border-border/50",
            headerAction ? "pr-20" : "pr-14",
          )}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <SheetTitle className="truncate font-heading text-2xl font-semibold tracking-tight">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </SheetHeader>
        {tabs ? <div className="shrink-0 border-b border-border/50 px-6">{tabs}</div> : null}
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
