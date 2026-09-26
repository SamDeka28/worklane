"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, LayoutGrid, List, X } from "lucide-react";
import { DesktopFilters, MobileFilters } from "@/components/studio/mobile-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { CrmMember } from "@/modules/crm/types";

export type CrmView = "board" | "list" | "reports";

export type CrmFilters = {
  q: string;
  owner: string;
  due: string;
  source: string;
  tag: string;
};

const DUE_OPTIONS = [
  { value: "", label: "Any follow-up" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "stale", label: "Gone quiet" },
  { value: "none", label: "No next step" },
];

const selectClass = "h-9 w-full rounded-xl border-0 bg-muted md:w-36 md:rounded-full";

export function CrmToolbar({
  orgSlug,
  view,
  filters,
  members,
  sources,
  tags,
  count,
}: {
  orgSlug: string;
  view: CrmView;
  filters: CrmFilters;
  members: CrmMember[];
  sources: string[];
  tags: string[];
  count: number;
}) {
  const router = useRouter();
  const base = `/${orgSlug}/crm`;
  const activeCount = Object.values(filters).filter(Boolean).length;

  function href(next: Partial<CrmFilters> & { view?: CrmView }) {
    const merged = { ...filters, view, ...next };
    const params = new URLSearchParams();
    if (merged.view !== "board") params.set("view", merged.view);
    for (const key of ["q", "owner", "due", "source", "tag"] as const) {
      if (merged[key]) params.set(key, merged[key]);
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    router.push(
      href({
        q: read("q"),
        owner: read("owner"),
        due: read("due"),
        source: read("source"),
        tag: read("tag"),
      }),
    );
  }

  const fields = (autoSubmit: boolean) => {
    const onChange = autoSubmit
      ? (event: { currentTarget: HTMLSelectElement }) => event.currentTarget.form?.requestSubmit()
      : undefined;
    return (
      <>
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Search leads"
          className="h-9 w-full rounded-xl border-0 bg-muted md:w-44 md:rounded-full"
        />
        <NativeSelect
          name="owner"
          defaultValue={filters.owner}
          onChange={onChange}
          className={selectClass}
          aria-label="Owner"
        >
          <option value="">Everyone</option>
          <option value="me">My leads</option>
          <option value="none">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="due"
          defaultValue={filters.due}
          onChange={onChange}
          className={selectClass}
          aria-label="Follow-up"
        >
          {DUE_OPTIONS.map((option) => (
            <option key={option.value || "any"} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        {sources.length > 0 ? (
          <NativeSelect
            name="source"
            defaultValue={filters.source}
            onChange={onChange}
            className={selectClass}
            aria-label="Source"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        {tags.length > 0 ? (
          <NativeSelect
            name="tag"
            defaultValue={filters.tag}
            onChange={onChange}
            className={selectClass}
            aria-label="Tag"
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </>
    );
  };

  const formKey = JSON.stringify(filters);

  return (
    <div
      data-toolbar
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2.5 sm:px-6"
    >
      <MobileFilters
        title="Filter leads"
        description="Search and narrow by owner, follow-up, source, or tag."
        activeCount={activeCount}
      >
        <form
          key={formKey}
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            apply(event.currentTarget);
          }}
        >
          {fields(false)}
          <Button type="submit" className="w-full">
            Apply filters
          </Button>
        </form>
      </MobileFilters>

      <DesktopFilters>
        <form
          key={formKey}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply(event.currentTarget);
          }}
        >
          {fields(true)}
          {activeCount > 0 ? (
            <Link
              href={href({ q: "", owner: "", due: "", source: "", tag: "" })}
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
              Clear
            </Link>
          ) : null}
        </form>
      </DesktopFilters>

      <div className="ml-auto flex items-center gap-2">
        <p className="hidden text-xs text-muted-foreground tabular-nums sm:block">
          {count} lead{count === 1 ? "" : "s"}
        </p>
        <div data-slot="segmented" className="flex items-center gap-1 rounded-full bg-muted p-1">
          <ViewLink href={href({ view: "board" })} active={view === "board"} label="Board view">
            <LayoutGrid className="size-3.5" />
          </ViewLink>
          <ViewLink href={href({ view: "list" })} active={view === "list"} label="List view">
            <List className="size-3.5" />
          </ViewLink>
          <ViewLink href={href({ view: "reports" })} active={view === "reports"} label="Reports">
            <BarChart3 className="size-3.5" />
          </ViewLink>
        </div>
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
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
    >
      {children}
    </Link>
  );
}
