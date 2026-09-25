"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  FileSignature,
  FileText,
  Handshake,
  LayoutTemplate,
  NotebookPen,
  PenLine,
  Presentation,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DOCUMENT_TEMPLATES, type DocumentTemplate } from "@/modules/documents/templates";
import { DOCUMENT_KIND_SHORT, type DocumentKind } from "@/modules/documents/types";

const TEMPLATE_ICON: Record<string, LucideIcon> = {
  proposal: Presentation,
  sow: ClipboardList,
  msa: Handshake,
  nda: ShieldCheck,
  brief: PenLine,
  change_order: Repeat,
  status_report: FileSignature,
  meeting_notes: NotebookPen,
  blank: FileText,
};

export function TemplateGallery({
  open,
  onOpenChange,
  currentKind,
  pending,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentKind: DocumentKind;
  pending?: boolean;
  onApply: (template: DocumentTemplate) => void;
}) {
  const ordered = useMemo(
    () => [
      ...DOCUMENT_TEMPLATES.filter((t) => t.kind === currentKind),
      ...DOCUMENT_TEMPLATES.filter((t) => t.kind !== currentKind),
    ],
    [currentKind],
  );
  const [selectedId, setSelectedId] = useState<string>(ordered[0]?.id ?? "blank");
  const selected = ordered.find((t) => t.id === selectedId) ?? ordered[0];
  const changesKind = selected && selected.kind !== currentKind;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/50 px-6 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="size-4 text-muted-foreground" />
            Template library
          </DialogTitle>
          <DialogDescription>
            Industry-standard layouts with numbered sections, tables and signature blocks.
            Highlighted fields are placeholders to fill in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-0 md:grid-cols-[1fr_280px]">
          <div className="grid max-h-[56vh] grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
            {ordered.map((template) => {
              const Icon = TEMPLATE_ICON[template.id] ?? FileText;
              const active = template.id === selected?.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedId(template.id)}
                  onDoubleClick={() => onApply(template)}
                  className={cn(
                    "group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors",
                    active
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border/60 hover:border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex items-center gap-1.5">
                      {template.kind === currentKind ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          Suggested
                        </span>
                      ) : null}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {DOCUMENT_KIND_SHORT[template.kind]}
                      </span>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="hidden border-l border-border/50 bg-muted/30 p-5 md:block">
            {selected ? (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Contents
                </p>
                <p className="text-sm font-semibold">{selected.name}</p>
                {selected.outline.length > 0 ? (
                  <ol className="space-y-1.5">
                    {selected.outline.map((item, index) => (
                      <li key={item} className="flex gap-2 text-xs text-foreground/80">
                        <span className="w-5 shrink-0 font-mono text-[11px] text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted-foreground">An empty page with the title.</p>
                )}
              </div>
            ) : null}
          </aside>
        </div>

        <DialogFooter className="mx-0 mb-0 items-center border-t border-border/50 px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {changesKind
              ? `Replaces the current content and changes the type to ${DOCUMENT_KIND_SHORT[selected.kind]}.`
              : "Replaces the current content. Nothing is saved until you click Save."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected || pending}
              onClick={() => selected && onApply(selected)}
            >
              Use template
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
