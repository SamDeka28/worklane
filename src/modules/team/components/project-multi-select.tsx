"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ProjectOption = { id: string; name: string };

export function ProjectMultiSelect({
  id,
  projects,
  selectedIds,
  onChange,
  emptyLabel = "Studio only",
}: {
  id?: string;
  projects: ProjectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedIds.includes(project.id)),
    [projects, selectedIds],
  );

  function toggle(projectId: string) {
    onChange(
      selectedIds.includes(projectId)
        ? selectedIds.filter((id) => id !== projectId)
        : [...selectedIds, projectId],
    );
  }

  if (projects.length === 0) return null;

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              className={cn(
                "relative inline-flex h-10 w-full min-w-0 items-center rounded-lg bg-muted/60 px-3 text-left text-sm font-medium tracking-tight ring-1 ring-border/40",
                "transition-[box-shadow,background-color,ring-color] hover:bg-muted/80",
                "focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none",
              )}
            />
          }
        >
          <span className="min-w-0 flex-1 truncate pr-8 text-foreground">
            {selectedIds.length === 0
              ? emptyLabel
              : `${selectedIds.length} project${selectedIds.length === 1 ? "" : "s"} selected`}
          </span>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-72 p-1.5">
          <ul className="max-h-56 overflow-y-auto">
            <li>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  selectedIds.length === 0
                    ? "bg-primary/12 font-semibold text-primary"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => onChange([])}
              >
                <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
                {selectedIds.length === 0 ? (
                  <Check className="size-3.5 shrink-0" aria-hidden />
                ) : null}
              </button>
            </li>
            {projects.map((project) => {
              const active = selectedIds.includes(project.id);
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                      active
                        ? "bg-primary/12 font-semibold text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                    onClick={() => toggle(project.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {active ? (
                      <Check className="size-3.5 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      {selectedProjects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedProjects.map((project) => (
            <Badge
              key={project.id}
              variant="secondary"
              className="h-7 gap-1 rounded-full pr-1 pl-2.5"
            >
              <span className="max-w-40 truncate">{project.name}</span>
              <button
                type="button"
                aria-label={`Remove ${project.name}`}
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                onClick={() => onChange(selectedIds.filter((id) => id !== project.id))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
