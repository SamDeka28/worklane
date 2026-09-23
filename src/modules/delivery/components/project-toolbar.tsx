"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Columns3, LayoutGrid, List } from "lucide-react";
import {
  DesktopFilters,
  MobileFilters,
} from "@/components/studio/mobile-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function ProjectToolbar({
  orgSlug,
  clients,
  q,
  status,
  clientId,
  view,
  page,
  pageCount,
  total,
}: {
  orgSlug: string;
  clients: { id: string; name: string }[];
  q: string;
  status: string;
  clientId: string;
  view: "cards" | "list" | "board";
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const base = `/${orgSlug}/projects`;
  const activeCount = [q, status, clientId].filter(Boolean).length;

  function href(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      q: next.q ?? q,
      status: next.status ?? status,
      client: next.client ?? clientId,
      view: next.view ?? view,
      page: String(next.page ?? page),
    };
    if (merged.q) params.set("q", String(merged.q));
    if (merged.status) params.set("status", String(merged.status));
    if (merged.client) params.set("client", String(merged.client));
    if (merged.view && merged.view !== "list") params.set("view", String(merged.view));
    if (merged.page && String(merged.page) !== "1") params.set("page", String(merged.page));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  function applyFilters(form: HTMLFormElement) {
    const data = new FormData(form);
    router.push(
      href({
        q: String(data.get("q") ?? ""),
        status: String(data.get("status") ?? ""),
        client: String(data.get("client") ?? ""),
        page: 1,
      }),
    );
  }

  const filterFields = (
    <>
      <Input
        name="q"
        defaultValue={q}
        placeholder="Search projects"
        className="h-9 w-full rounded-xl border-0 bg-muted md:w-44 md:rounded-full"
      />
      <NativeSelect
        name="status"
        defaultValue={status}
        className="h-9 w-full rounded-xl border-0 bg-muted md:w-36 md:rounded-full"
      >
        {STATUSES.map((item) => (
          <option key={item.value || "all"} value={item.value}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        name="client"
        defaultValue={clientId}
        className="h-9 w-full rounded-xl border-0 bg-muted md:w-36 md:rounded-full"
      >
        <option value="">All clients</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </NativeSelect>
    </>
  );

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2.5 sm:px-5">
      <MobileFilters
        title="Filter projects"
        description="Search and narrow by status or client."
        activeCount={activeCount}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters(event.currentTarget);
          }}
        >
          {filterFields}
          <Button type="submit" className="w-full">
            Apply filters
          </Button>
        </form>
      </MobileFilters>

      <DesktopFilters>
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters(event.currentTarget);
          }}
        >
          {filterFields}
          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>
        </form>
      </DesktopFilters>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
          <ViewLink href={href({ view: "list", page: 1 })} active={view === "list"} label="List">
            <List className="size-3.5" />
          </ViewLink>
          <ViewLink href={href({ view: "board", page: 1 })} active={view === "board"} label="Board">
            <Columns3 className="size-3.5" />
          </ViewLink>
          <ViewLink href={href({ view: "cards", page: 1 })} active={view === "cards"} label="Cards">
            <LayoutGrid className="size-3.5" />
          </ViewLink>
        </div>
        {view !== "board" && pageCount > 1 ? (
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span>
              {total} project{total === 1 ? "" : "s"}
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
            {total}
          </p>
        )}
      </div>
    </div>
  );
}

function ViewLink({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
      )}
      aria-label={label}
    >
      {children}
    </Link>
  );
}
