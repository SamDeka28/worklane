"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { openLead, setCrmUrl } from "@/modules/crm/components/crm-url";
import { LeadDetailSheet } from "@/modules/crm/components/lead-forms";
import type { LeadEmailSender } from "@/modules/crm/queries";
import type { CrmSettings } from "@/modules/crm/settings";
import type { CrmMember, LeadRecord, LeadStageRecord } from "@/modules/crm/types";

export function CrmLeadSheet({
  orgSlug,
  leads,
  initialLead,
  stages,
  canWrite,
  canDelete = false,
  showMoney = true,
  settings,
  members,
  currentUserId,
  sender,
}: {
  orgSlug: string;
  leads: LeadRecord[];
  /** Server-fetched deep-link lead (may be outside the filtered list). */
  initialLead: LeadRecord | null;
  stages: LeadStageRecord[];
  canWrite: boolean;
  canDelete?: boolean;
  showMoney?: boolean;
  settings: CrmSettings;
  members: CrmMember[];
  currentUserId: string;
  sender: LeadEmailSender;
}) {
  const leadId = useSearchParams().get("lead");
  const selected = leadId
    ? (leads.find((lead) => lead.id === leadId) ??
      (initialLead?.id === leadId ? initialLead : null))
    : null;

  // Keep the last lead mounted so the sheet can animate closed.
  const [shown, setShown] = useState<LeadRecord | null>(selected);
  if (selected && selected !== shown) setShown(selected);

  return (
    <LeadDetailSheet
      orgSlug={orgSlug}
      lead={selected ?? shown}
      stages={stages}
      open={Boolean(selected)}
      onOpenChange={(next) => {
        if (!next) setCrmUrl({ lead: null });
      }}
      canWrite={canWrite}
      canDelete={canDelete}
      showMoney={showMoney}
      settings={settings}
      members={members}
      currentUserId={currentUserId}
      sender={sender}
    />
  );
}

/** List-row link that opens the lead sheet without a server navigation. */
export function LeadOpenLink({
  leadId,
  href,
  className,
  children,
}: {
  leadId: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        openLead(leadId);
      }}
    >
      {children}
    </Link>
  );
}
