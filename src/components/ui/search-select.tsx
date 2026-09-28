"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

export function SearchSelect({
  options,
  value,
  onValueChange,
  id,
  placeholder = "Select…",
  disabled,
  className,
  emptyText = "No matches",
  "aria-label": ariaLabel,
}: {
  options: SearchSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
  "aria-label"?: string;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(next) => {
        if (next && next.value !== value) onValueChange(next.value);
      }}
      isItemEqualToValue={(item, current) => item.value === current.value}
      disabled={disabled}
      autoHighlight
    >
      <Combobox.Trigger
        id={id}
        aria-label={ariaLabel}
        data-slot="native-select"
        className={cn(
          "relative inline-flex h-10 w-full min-w-0 items-center rounded-lg bg-muted/60 py-0 pr-9 pl-3 text-left text-sm font-medium tracking-tight text-foreground ring-1 ring-border/40 outline-none",
          "transition-[box-shadow,background-color,ring-color] hover:bg-muted/80",
          "focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/25 data-popup-open:bg-card data-popup-open:ring-2 data-popup-open:ring-ring/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="start" className="isolate z-[60] outline-none">
          <Combobox.Popup
            data-slot="search-select-popup"
            className={cn(
              "flex max-h-[min(22rem,var(--available-height))] w-(--anchor-width) min-w-56 origin-(--transform-origin) flex-col rounded-xl bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
              "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <div className="relative mb-1 shrink-0">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Combobox.Input
                placeholder="Search…"
                className="h-9 w-full rounded-lg bg-muted/70 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground empty:hidden">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto">
              {(option: SearchSelectOption) => (
                <Combobox.Item
                  key={`${option.group ?? ""}:${option.value}`}
                  value={option}
                  disabled={option.disabled}
                  className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:font-semibold data-selected:text-primary"
                >
                  <span className="min-w-0 flex-1 truncate">{option.label || "\u00a0"}</span>
                  {option.group ? (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {option.group}
                    </span>
                  ) : null}
                  <Combobox.ItemIndicator className="shrink-0">
                    <Check className="size-3.5" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/** Filter box for popover pickers: Enter picks the first match. */
export function PickerSearch({
  value,
  onChange,
  onEnter,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative mb-1 shrink-0">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter?.();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            event.currentTarget
              .closest("[data-slot=popover-content]")
              ?.querySelector<HTMLButtonElement>("ul button")
              ?.focus();
          }
        }}
        className="h-9 w-full rounded-lg bg-muted/70 pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/25"
      />
    </div>
  );
}

export function matchesQuery(label: string, query: string) {
  const q = query.trim().toLowerCase();
  return !q || label.toLowerCase().includes(q);
}
