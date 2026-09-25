"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BusyContext = { busy: boolean; adjust: (delta: number) => void };

const InvoiceBusy = createContext<BusyContext | null>(null);

/** Lets any action in the invoice studio mark the preview as updating. */
export function InvoiceBusyProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const adjust = useCallback((delta: number) => {
    setCount((current) => Math.max(0, current + delta));
  }, []);
  const value = useMemo(() => ({ busy: count > 0, adjust }), [count, adjust]);
  return <InvoiceBusy.Provider value={value}>{children}</InvoiceBusy.Provider>;
}

/** Report a pending transition. No-op outside the invoice studio. */
export function useReportInvoiceBusy(pending: boolean) {
  const adjust = useContext(InvoiceBusy)?.adjust;
  useEffect(() => {
    if (!pending || !adjust) return;
    adjust(1);
    return () => adjust(-1);
  }, [pending, adjust]);
}

export function InvoiceBusyOverlay({ children, label = "Updating…" }: { children: ReactNode; label?: string }) {
  const busy = useContext(InvoiceBusy)?.busy ?? false;
  return (
    <div className="relative" aria-busy={busy}>
      <div
        className={cn(
          "transition-[opacity,filter] duration-200",
          busy && "pointer-events-none opacity-60 saturate-50",
        )}
      >
        {children}
      </div>
      <div
        className={cn(
          "pointer-events-none sticky bottom-6 z-10 flex h-0 items-end justify-center transition-opacity duration-200",
          busy ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background shadow-lg">
          <Loader2 className="size-3.5 animate-spin" />
          {label}
        </span>
      </div>
    </div>
  );
}
