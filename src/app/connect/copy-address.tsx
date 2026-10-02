"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-5 flex items-center gap-2 rounded-xl bg-inset px-3 py-2 ring-1 ring-border/70">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
