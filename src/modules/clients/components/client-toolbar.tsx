"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "", label: "All clients" },
  { value: "owing", label: "Owing" },
  { value: "settled", label: "Settled" },
];

const KINDS = [
  { value: "", label: "All kinds" },
  { value: "company", label: "Company" },
  { value: "person", label: "Person" },
];

export function ClientToolbar({
  orgSlug,
  q,
  filter,
  kind,
  view,
  page,
  pageCount,
  total,
}: {
  orgSlug: string;
  q: string;
  filter: string;
  kind: string;
  view: "cards" | "list";
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const base = `/${orgSlug}/clients`;

  function href(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      q: next.q ?? q,
      filter: next.filter ?? filter,
      kind: next.kind ?? kind,
      view: next.view ?? view,
      page: String(next.page ?? page),
    };
    if (merged.q) params.set("q", String(merged.q));
    if (merged.filter) params.set("filter", String(merged.filter));
    if (merged.kind) params.set("kind", String(merged.kind));
    if (merged.view && merged.view !== "list") params.set("view", String(merged.view));
    if (merged.page && String(merged.page) !== "1") params.set("page", String(merged.page));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  return (
    <SoftToolbar>
      <form
        className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          router.push(
            href({
              q: String(data.get("q") ?? ""),
              filter: String(data.get("filter") ?? ""),
              kind: String(data.get("kind") ?? ""),
              page: 1,
            }),
          );
        }}
      >
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search clients"
          className="h-9 w-44 rounded-full bg-muted/80"
        />
        <NativeSelect name="filter" defaultValue={filter} className="h-9 w-32 rounded-full bg-muted/80">
          {FILTERS.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="kind" defaultValue={kind} className="h-9 w-32 rounded-full bg-muted/80">
          {KINDS.map((item) => (
            <option key={item.value || "all-kinds"} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>
      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        <Link
          href={href({ view: "cards", page: 1 })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full",
            view === "cards" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
          aria-label="Card view"
        >
          <LayoutGrid className="size-3.5" />
        </Link>
        <Link
          href={href({ view: "list", page: 1 })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full",
            view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
          aria-label="List view"
        >
          <List className="size-3.5" />
        </Link>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {total} client{total === 1 ? "" : "s"}
          </span>
          <Link
            href={href({ page: Math.max(1, page - 1) })}
            className={page <= 1 ? "pointer-events-none opacity-40" : "hover:text-foreground"}
          >
            Prev
          </Link>
          <span>
            {page} / {pageCount}
          </span>
          <Link
            href={href({ page: Math.min(pageCount, page + 1) })}
            className={page >= pageCount ? "pointer-events-none opacity-40" : "hover:text-foreground"}
          >
            Next
          </Link>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {total} client{total === 1 ? "" : "s"}
        </p>
      )}
    </SoftToolbar>
  );
}

function SoftToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-5 py-2.5">
      {children}
    </div>
  );
}
