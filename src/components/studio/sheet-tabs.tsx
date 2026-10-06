"use client";

import { useRef, type KeyboardEvent } from "react";
import { CircleHelp, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SheetTab<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Small count or status shown after the label. */
  badge?: string | number | null;
  /** Explains the tab. Shown on a help icon so the label stays short. */
  hint?: string;
};

/** Underline tabs for sheet and dialog headers. Panels are the caller's job. */
export function SheetTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: SheetTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-mb-px flex gap-1 overflow-x-auto bg-transparent! shadow-none! [scrollbar-width:none]"
    >
      {tabs.map((tab, index) => {
        const active = tab.id === value;
        const Icon = tab.icon;
        return (
          <span key={tab.id} className="inline-flex shrink-0 items-center">
            <button
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap shadow-none! transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon ? <Icon className="size-3.5" /> : null}
              {tab.label}
              {tab.badge != null && tab.badge !== "" ? (
                <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </button>
            {tab.hint ? (
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label={`About ${tab.label}`}
                  closeOnClick={false}
                  className="-ml-1 inline-flex pb-2.5 text-muted-foreground hover:text-foreground"
                >
                  <CircleHelp className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64 text-left leading-5">
                  {tab.hint}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function tabPanelProps(idPrefix: string, id: string, active: boolean) {
  return {
    role: "tabpanel" as const,
    id: `${idPrefix}-panel-${id}`,
    "aria-labelledby": `${idPrefix}-tab-${id}`,
    hidden: !active,
  };
}
