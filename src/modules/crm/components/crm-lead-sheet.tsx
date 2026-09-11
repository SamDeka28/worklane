"use client";

import { useRouter } from "next/navigation";
import { LeadDetailSheet } from "@/modules/crm/components/lead-forms";
import type { LeadRecord } from "@/modules/crm/types";

export function CrmLeadSheet({
  orgSlug,
  lead,
  canWrite,
  view,
}: {
  orgSlug: string;
  lead: LeadRecord | null;
  canWrite: boolean;
  view: "list" | "board";
}) {
  const router = useRouter();
  const base = view === "board" ? `/${orgSlug}/crm?view=board` : `/${orgSlug}/crm`;

  return (
    <LeadDetailSheet
      orgSlug={orgSlug}
      lead={lead}
      open={Boolean(lead)}
      onOpenChange={(next) => {
        if (!next) router.replace(base);
      }}
      canWrite={canWrite}
    />
  );
}
