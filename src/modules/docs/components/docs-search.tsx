"use client";

import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { searchDocs } from "../search";
import type { DocSearchEntry } from "../types";

const KIND_LABEL = { guide: "Guide", "how-to": "How-to", reference: "Reference" } as const;

export function DocsSearch({
  entries,
  size = "md",
  autoFocusShortcut = true,
}: {
  entries: DocSearchEntry[];
  size?: "md" | "lg";
  autoFocusShortcut?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchDocs(entries, query), [entries, query]);

  useEffect(() => {
    if (!autoFocusShortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocusShortcut]);

  const go = (slug: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(`/docs/${slug}`);
  };

  const showResults = open && query.trim().length > 0;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-xl bg-white/[0.05] ring-1 ring-white/10 transition focus-within:bg-white/[0.07] focus-within:ring-violet-300/40",
          size === "lg" ? "h-13 px-4" : "h-10 px-3",
        )}
      >
        <Search
          className={cn("shrink-0 text-white/40", size === "lg" ? "size-5" : "size-4")}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search documentation"
          placeholder="Search the docs…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[active]) {
              event.preventDefault();
              go(results[active].slug);
            } else if (event.key === "Escape") {
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/35 [&::-webkit-search-cancel-button]:hidden",
            size === "lg" ? "text-base" : "text-sm",
          )}
        />
        {autoFocusShortcut ? (
          <kbd className="hidden shrink-0 rounded-md border border-white/12 px-1.5 text-[11px] text-white/40 sm:inline">
            /
          </kbd>
        ) : null}
      </div>
      {showResults ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-[#0B0F1E] shadow-2xl ring-1 ring-white/12"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-white/45">
              No articles match “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto p-1.5">
              {results.map((entry, index) => (
                <li key={entry.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(entry.slug)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      index === active ? "bg-violet-400/12" : "hover:bg-white/5",
                    )}
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-violet-300/70" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {entry.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-white/45">
                        {entry.category} · {KIND_LABEL[entry.kind]} — {entry.summary}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
