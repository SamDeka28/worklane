"use client";

import { useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SheetTab<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Small count or status shown after the label. */
  badge?: string | number | null;
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
          <button
            key={tab.id}
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
              "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium whitespace-nowrap shadow-none! transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            {tab.label}
            {tab.badge != null && tab.badge !== "" ? (
              <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-semibold text-muted-foreground tabular-nums">
                {tab.badge}
              </span>
            ) : null}
          </button>
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
