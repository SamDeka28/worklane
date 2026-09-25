"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DocsNav, type DocsNavSection } from "./docs-nav";

export function DocsMobileNav({
  sections,
  current,
}: {
  sections: DocsNavSection[];
  current: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-left text-sm ring-1 ring-white/10 lg:hidden"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <BookOpen className="size-4 shrink-0 text-violet-300/70" aria-hidden />
              <span className="truncate text-white/80">{current}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-white/40" aria-hidden />
          </button>
        }
      />
      <SheetContent
        side="left"
        className="border-white/10 bg-[#0A0E1C] text-white data-[side=left]:w-[min(100%,20rem)] data-[side=left]:sm:max-w-none"
      >
        <SheetHeader className="border-b border-white/8 px-4 pb-4">
          <SheetTitle className="text-white">Documentation</SheetTitle>
        </SheetHeader>
        <div data-docs-scroll className="flex-1 overflow-y-auto px-2 pb-8">
          <DocsNav sections={sections} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
