"use client";

import { useEffect, useId, useState } from "react";
import { Check, Pipette, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const TEXT_COLOR_SWATCHES = [
  "#0f172a",
  "#1e3a5f",
  "#334155",
  "#64748b",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
] as const;

export const HIGHLIGHT_COLOR_SWATCHES = [
  "#fef08a",
  "#bbf7d0",
  "#a5f3fc",
  "#bfdbfe",
  "#e9d5ff",
  "#fecdd3",
  "#fed7aa",
  "#e2e8f0",
] as const;

function normalizeHex(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null;
  return withHash.toLowerCase();
}

export function EditorColorPicker({
  label,
  value,
  swatches,
  onChange,
  onClear,
  mode = "text",
  disabled,
}: {
  label: string;
  value?: string | null;
  swatches: readonly string[];
  onChange: (color: string) => void;
  onClear?: () => void;
  mode?: "text" | "highlight";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(value?.replace(/^#/, "") ?? "");
  const inputId = useId();
  const active = Boolean(value);

  useEffect(() => {
    if (!open) return;
    setHexDraft((value ?? "").replace(/^#/, ""));
  }, [open, value]);

  function applyHex(raw: string) {
    const next = normalizeHex(raw);
    if (!next) return;
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "inline-flex h-8 min-w-8 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
              disabled && "cursor-not-allowed opacity-50",
            )}
          />
        }
      >
        {mode === "highlight" ? (
          <span className="relative inline-flex size-4 items-center justify-center">
            <span className="text-[11px] font-bold leading-none">A</span>
            <span
              className="absolute inset-x-0 bottom-0 h-1.5 rounded-sm ring-1 ring-foreground/15"
              style={{ backgroundColor: value || "#bbf7d0" }}
            />
          </span>
        ) : (
          <span className="relative inline-flex size-4 items-center justify-center">
            <span className="text-[12px] font-bold leading-none">A</span>
            <span
              className="absolute inset-x-0 bottom-0 h-1 rounded-sm ring-1 ring-foreground/15"
              style={{ backgroundColor: value || "currentColor" }}
            />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[15.5rem] gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            {label}
          </p>
          {onClear ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <X className="size-3" />
              Clear
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {swatches.map((swatch) => {
            const selected = (value ?? "").toLowerCase() === swatch.toLowerCase();
            return (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                title={swatch}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(swatch);
                  setOpen(false);
                }}
                className={cn(
                  "relative size-7 rounded-lg ring-1 ring-foreground/10 transition-[transform,box-shadow] hover:scale-105 hover:ring-foreground/25",
                  selected && "ring-2 ring-primary",
                )}
                style={{ backgroundColor: swatch }}
              >
                {selected ? (
                  <Check
                    className={cn(
                      "absolute inset-0 m-auto size-3.5",
                      mode === "highlight" ? "text-slate-800" : "text-white drop-shadow",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/25"
            title="Pick any color"
          >
            <span className="sr-only">Spectrum</span>
            <span
              className="flex size-full items-center justify-center"
              style={{ backgroundColor: value || swatches[0] }}
            >
              <Pipette className="size-3.5 text-white drop-shadow" />
            </span>
            <input
              id={inputId}
              type="color"
              className="sr-only"
              value={normalizeHex(value ?? "") ?? swatches[0]}
              onMouseDown={(event) => event.preventDefault()}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-muted/70 px-2 ring-1 ring-foreground/8">
            <span className="text-xs text-muted-foreground">#</span>
            <input
              value={hexDraft}
              onChange={(event) => setHexDraft(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyHex(hexDraft);
                  setOpen(false);
                }
              }}
              onBlur={() => applyHex(hexDraft)}
              onMouseDown={(event) => event.stopPropagation()}
              placeholder="1c1917"
              className="h-9 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
