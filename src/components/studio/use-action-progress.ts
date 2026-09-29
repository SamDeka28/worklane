"use client";

import { useCallback, useTransition as useReactTransition } from "react";
import { toast } from "sonner";

/** A drop-in transition hook that gives longer-running actions a shared loading toast. */
export function useActionProgress() {
  const [pending, startTransition] = useReactTransition();

  const start = useCallback((callback: () => void | Promise<void>) => {
    let toastId: string | number | undefined;
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) toastId = toast.loading("Processing…");
    }, 180);

    startTransition(async () => {
      try {
        await callback();
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        finished = true;
        clearTimeout(timer);
        if (toastId !== undefined) toast.dismiss(toastId);
      }
    });
  }, [startTransition]);

  return [pending, start] as const;
}
