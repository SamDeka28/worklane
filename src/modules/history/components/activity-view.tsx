"use client";

import { ArrowLeft, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RecordHistory } from "@/modules/history/components/record-history";
import type { RecordEntityType } from "@/modules/history/types";
import type { IsoCurrency } from "@/shared/money";

export function ActivityToggle({
  active,
  onToggle,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="sm"
      className={cn("gap-1.5 rounded-full", className)}
      aria-pressed={active}
      onClick={onToggle}
    >
      {active ? <ArrowLeft className="size-3.5" /> : <History className="size-3.5" />}
      {active ? "Back to details" : "Activity"}
    </Button>
  );
}

export function ActivityPanel({
  orgSlug,
  entityType,
  entityId,
  currency,
  refreshKey,
  className,
}: {
  orgSlug: string;
  entityType: RecordEntityType;
  entityId: string;
  currency?: IsoCurrency;
  refreshKey?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full py-1", className)}>
      <div className="mb-7">
        <h3 className="text-base font-semibold tracking-tight">Activity</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change to this {entityType === "lead" ? "lead" : "card"}, newest first.
        </p>
      </div>
      <RecordHistory
        orgSlug={orgSlug}
        entityType={entityType}
        entityId={entityId}
        currency={currency}
        refreshKey={refreshKey}
      />
    </div>
  );
}
