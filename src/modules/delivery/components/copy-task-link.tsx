"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { taskSharePath } from "@/shared/short-id";

function useCopyTaskLink(taskId: string) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${taskSharePath(taskId)}`);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }
  return { copied, copy };
}

export function CopyTaskLinkButton({ taskId, className }: { taskId: string; className?: string }) {
  const { copied, copy } = useCopyTaskLink(taskId);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5 rounded-full", className)}
      onClick={copy}
    >
      {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

/** Icon-only variant for board cards; sits outside the card's open button. */
export function CopyTaskLinkIcon({ taskId, className }: { taskId: string; className?: string }) {
  const { copied, copy } = useCopyTaskLink(taskId);
  return (
    <button
      type="button"
      title="Copy link"
      aria-label="Copy link to card"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}
