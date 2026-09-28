"use client";

import {
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Braces } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { MergeValues } from "@/modules/crm/presentation";
import { EMAIL_MERGE_FIELDS } from "@/modules/crm/settings";

export type FieldElement = HTMLInputElement | HTMLTextAreaElement;
type Variable = { key: string; label: string };
type VariableList = readonly Variable[];

const token = (key: string) => `{{${key}}}`;

/** Inserts text at the caret (replacing `from`..caret when given) and puts the caret after it. */
function insertAt(
  el: FieldElement,
  value: string,
  text: string,
  onChange: (next: string) => void,
  from?: number,
) {
  const start = from ?? el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? start;
  const next = value.slice(0, start) + text + value.slice(end);
  onChange(next);
  const caret = start + text.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

/** Pixel position of the caret inside a field, measured with an offscreen mirror. */
function caretPoint(el: FieldElement, index: number) {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const prop of [
    "boxSizing",
    "width",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "tabSize",
  ] as const) {
    mirror.style[prop] = style[prop];
  }
  const multiline = el instanceof HTMLTextAreaElement;
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = multiline ? "pre-wrap" : "pre";
  mirror.style.overflowWrap = "break-word";
  mirror.textContent = el.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const point = {
    left: marker.offsetLeft - el.scrollLeft,
    top: marker.offsetTop - el.scrollTop + parseFloat(style.lineHeight || "20"),
  };
  mirror.remove();
  return point;
}

type Picker = { from: number; query: string; left: number; top: number };

const MENU_WIDTH = 256;

function shortLabel(label: string) {
  const short = label.replace(/^Contact /, "");
  return short[0].toUpperCase() + short.slice(1);
}

type VariableFieldProps = {
  value: string;
  onValueChange: (next: string) => void;
  values: MergeValues;
  fieldRef?: RefObject<FieldElement | null>;
  onFocusField?: (el: FieldElement) => void;
  wrapperClassName?: string;
  /** Defaults to the lead merge fields. */
  fields?: VariableList;
};

/** A subject or message field where typing @ offers the merge variables. */
export function VariableField({
  multiline = false,
  value,
  onValueChange,
  values,
  fieldRef,
  onFocusField,
  wrapperClassName,
  fields = EMAIL_MERGE_FIELDS,
  onKeyDown,
  ...props
}: VariableFieldProps & { multiline?: boolean } & Omit<
    ComponentProps<"textarea"> & ComponentProps<"input">,
    "value" | "onChange" | "ref"
  >) {
  const localRef = useRef<FieldElement | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [active, setActive] = useState(0);

  const q = picker?.query.toLowerCase() ?? "";
  const matches = picker
    ? fields.filter(
        (field) => field.key.includes(q.replace(/\s+/g, "_")) || field.label.toLowerCase().includes(q),
      )
    : [];

  function setRef(el: FieldElement | null) {
    localRef.current = el;
    if (fieldRef) fieldRef.current = el;
  }

  function sync(el: FieldElement) {
    const caret = el.selectionStart ?? 0;
    const before = el.value.slice(0, caret);
    const match = before.match(/(^|\s)@([a-z_ ]{0,20})$/i);
    if (!match || match[2].endsWith("  ")) {
      setPicker(null);
      return;
    }
    const from = caret - match[2].length - 1;
    const point = caretPoint(el, from);
    const left = Math.max(0, Math.min(point.left, el.clientWidth - MENU_WIDTH));
    setPicker({ from, query: match[2], left, top: point.top });
    setActive(0);
  }

  function choose(field: Variable) {
    const el = localRef.current;
    if (!el || !picker) return;
    const caret = el.selectionStart ?? picker.from;
    el.setSelectionRange(picker.from, caret);
    insertAt(el, value, token(field.key), onValueChange, picker.from);
    setPicker(null);
  }

  function handleKeyDown(event: KeyboardEvent<FieldElement>) {
    if (picker && matches.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((index) => (index + step + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(matches[active] ?? matches[0]);
        return;
      }
    }
    if (picker && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setPicker(null);
      return;
    }
    onKeyDown?.(event as never);
  }

  const shared = {
    ...props,
    value,
    onChange: (event: { currentTarget: FieldElement }) => {
      onValueChange(event.currentTarget.value);
      sync(event.currentTarget);
    },
    onKeyDown: handleKeyDown,
    onClick: (event: { currentTarget: FieldElement }) => sync(event.currentTarget),
    onFocus: (event: { currentTarget: FieldElement }) => onFocusField?.(event.currentTarget),
    onBlur: () => setTimeout(() => setPicker(null), 120),
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      {multiline ? (
        <Textarea {...(shared as ComponentProps<"textarea">)} ref={setRef} />
      ) : (
        <Input {...(shared as ComponentProps<"input">)} ref={setRef} />
      )}
      {picker && matches.length > 0 ? (
        <div
          className="absolute z-50 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          style={{ left: picker.left, top: picker.top + 6, width: MENU_WIDTH }}
        >
          <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Insert variable
          </p>
          <div role="listbox" aria-label="Insert a variable" className="grid gap-0.5 px-1.5 pb-1.5">
            {matches.map((field, index) => {
              const filled = values[field.key];
              return (
                <button
                  key={field.key}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(field);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex h-8 w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition-colors",
                    index === active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{shortLabel(field.label)}</span>
                  {filled ? (
                    <span className="max-w-28 truncate text-xs text-muted-foreground">{filled}</span>
                  ) : (
                    <code className="font-mono text-[11px] text-muted-foreground/70">
                      {field.key}
                    </code>
                  )}
                </button>
              );
            })}
          </div>
          <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
            ↑↓ to move · ↵ to insert · esc to close
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Clickable variables with their current values; inserts into the field last focused. */
export function VariableChips({
  values,
  target,
  fallback,
  onInsert,
  highlightMissing = true,
  fields = EMAIL_MERGE_FIELDS,
}: {
  values: MergeValues;
  target: RefObject<FieldElement | null>;
  fallback: RefObject<FieldElement | null>;
  onInsert: (el: FieldElement, text: string) => void;
  /** Amber for variables with no value; off where there's no lead to fill from. */
  highlightMissing?: boolean;
  fields?: VariableList;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="mr-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Braces className="size-3.5" aria-hidden />
        Insert
      </span>
      {fields.map((field) => {
        const filled = values[field.key] || !highlightMissing;
        return (
          <button
            key={field.key}
            type="button"
            title={
              values[field.key]
                ? `${field.label}: ${values[field.key]}`
                : highlightMissing
                  ? `${field.label} (no value yet)`
                  : `Inserts {{${field.key}}}`
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const el = target.current ?? fallback.current;
              if (el) onInsert(el, token(field.key));
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
              filled
                ? "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground"
                : "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-200",
            )}
          >
            {shortLabel(field.label)}
          </button>
        );
      })}
      <span className="text-xs text-muted-foreground">or type @</span>
    </div>
  );
}

export { insertAt as insertVariableAt };
