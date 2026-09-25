"use client";

import { Check, Monitor } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useThemeChoice } from "@/modules/identity/components/use-theme-choice";
import {
  SYSTEM_THEME,
  THEMES,
  type ThemeDefinition,
  type ThemeMode,
} from "@/shared/theme/themes";

type Filter = "all" | ThemeMode;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const s = theme.swatches;
  return (
    <div
      className="flex size-full gap-1.5 p-1.5"
      style={{ backgroundColor: s.canvas }}
    >
      <div
        className="flex w-[28%] flex-col gap-1 rounded-md p-1.5"
        style={{ backgroundColor: s.shell }}
      >
        <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: s.primary }} />
        <span className="h-1 w-2/3 rounded-full opacity-60" style={{ backgroundColor: s.muted }} />
        <span className="h-1 w-1/2 rounded-full opacity-60" style={{ backgroundColor: s.muted }} />
        <span className="h-1 w-3/5 rounded-full opacity-60" style={{ backgroundColor: s.muted }} />
      </div>
      <div
        className="flex flex-1 flex-col gap-1 rounded-md p-1.5"
        style={{ backgroundColor: s.card }}
      >
        <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: s.foreground }} />
        <span className="h-1 w-4/5 rounded-full opacity-50" style={{ backgroundColor: s.muted }} />
        <span className="h-1 w-3/5 rounded-full opacity-50" style={{ backgroundColor: s.muted }} />
        <div className="mt-auto flex items-center gap-1">
          {s.accents.map((color) => (
            <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          ))}
          <span
            className="ml-auto h-2 w-5 rounded-full"
            style={{ backgroundColor: s.primary }}
          />
        </div>
      </div>
    </div>
  );
}

function SystemPreview() {
  const light = THEMES.find((t) => t.id === "light")!;
  const dark = THEMES.find((t) => t.id === "dark")!;
  return (
    <div className="relative size-full">
      <div className="absolute inset-0">
        <ThemePreview theme={light} />
      </div>
      <div
        className="absolute inset-0"
        style={{ clipPath: "polygon(62% 0, 100% 0, 100% 100%, 38% 100%)" }}
      >
        <ThemePreview theme={dark} />
      </div>
      <span className="absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-md bg-black/55 text-white">
        <Monitor className="size-3" />
      </span>
    </div>
  );
}

type Option = {
  id: string;
  label: string;
  description: string;
  mode: ThemeMode | "system";
  theme?: ThemeDefinition;
};

export function AppearancePicker({ saved }: { saved: string | null }) {
  const { active, select } = useThemeChoice(saved);
  const [filter, setFilter] = useState<Filter>("all");
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  const options = useMemo<Option[]>(() => {
    const all: Option[] = [
      {
        id: SYSTEM_THEME,
        label: "System",
        description: "Match your device, light or dark",
        mode: "system",
      },
      ...THEMES.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        mode: t.mode,
        theme: t,
      })),
    ];
    if (filter === "all") return all;
    return all.filter((o) => o.mode === filter);
  }, [filter]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const ids = options.map((o) => o.id);
    const current = Math.max(0, ids.indexOf(active));
    let next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (current + 1) % ids.length;
    else next = (current - 1 + ids.length) % ids.length;
    const id = ids[next];
    select(id);
    optionRefs.current.get(id)?.focus();
  }

  const focusable = options.some((o) => o.id === active) ? active : options[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter themes">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-muted/60 text-muted-foreground ring-border hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        role="radiogroup"
        aria-label="Theme"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
      >
        {options.map((option) => {
          const checked = option.id === active;
          return (
            <button
              key={option.id}
              ref={(el) => {
                if (el) optionRefs.current.set(option.id, el);
                else optionRefs.current.delete(option.id);
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={option.id === focusable ? 0 : -1}
              onClick={() => select(option.id)}
              className={cn(
                "group flex flex-col gap-2 rounded-xl p-1.5 text-left outline-none transition-[box-shadow,background-color]",
                "focus-visible:ring-2 focus-visible:ring-ring",
                checked
                  ? "bg-primary/[0.08] ring-2 ring-primary"
                  : "ring-1 ring-border hover:bg-muted/50 hover:ring-foreground/20",
              )}
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-lg ring-1 ring-black/10">
                {option.theme ? <ThemePreview theme={option.theme} /> : <SystemPreview />}
                {checked ? (
                  <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              <div className="px-1 pb-0.5">
                <p className="truncate text-sm font-semibold text-foreground">{option.label}</p>
                <p className="truncate text-xs text-muted-foreground">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
