"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ConfirmAction({
  label,
  pendingLabel = "Working…",
  confirm = "This cannot be undone from Remaining. Continue?",
  action,
  variant = "ghost",
}: {
  label: string;
  pendingLabel?: string;
  confirm?: string;
  action: () => Promise<{ error?: string } | { ok?: boolean }>;
  variant?: "ghost" | "destructive" | "outline";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const result = await action();
            if ("error" in result && result.error) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            setError(null);
            router.refresh();
          });
        }}
      >
        {pending ? pendingLabel : label}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
