"use client";

import { useRouter } from "next/navigation";
import { LeadDetailSheet } from "@/modules/crm/components/lead-forms";
import type { LeadRecord, LeadStageRecord } from "@/modules/crm/types";

export function CrmLeadSheet({
  orgSlug,
  lead,
  stages,
  canWrite,
  view,
  showMoney = true,
}: {
  orgSlug: string;
  lead: LeadRecord | null;
  stages: LeadStageRecord[];
  canWrite: boolean;
  view: "list" | "board";
  showMoney?: boolean;
}) {
  const router = useRouter();
  const base = view === "board" ? `/${orgSlug}/crm?view=board` : `/${orgSlug}/crm`;

  return (
    <LeadDetailSheet
      orgSlug={orgSlug}
      lead={lead}
      stages={stages}
      open={Boolean(lead)}
      onOpenChange={(next) => {
        if (!next) router.replace(base);
      }}
      canWrite={canWrite}
      showMoney={showMoney}
    />
  );
}
