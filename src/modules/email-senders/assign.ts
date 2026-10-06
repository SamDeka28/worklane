import type { SmtpModuleId } from "@/modules/email-senders/types";

export type MailboxAssignment = {
  id: string;
  name: string;
  modules: string[];
  memberIds: string[];
};

/** The other mailbox's name when one person would have two for the same module. */
export function assignmentConflict(
  existing: MailboxAssignment[],
  next: { id?: string; modules: string[]; memberIds: string[] },
): string | null {
  for (const row of existing) {
    if (next.id && row.id === next.id) continue;
    const sharedPerson = next.memberIds.some((userId) => row.memberIds.includes(userId));
    const sharedModule = next.modules.some((module) => row.modules.includes(module));
    if (sharedPerson && sharedModule) return row.name;
  }
  return null;
}

export type ChosenSender =
  | { kind: "assigned"; id: string }
  | { kind: "personal" }
  | { kind: "fallback" }
  | null;

/**
 * Assigned mailbox for this module, then a personal lead mailbox, then the studio fallback.
 * The workspace default is whatever the caller uses when this returns null.
 */
export function chooseSender(input: {
  module?: SmtpModuleId;
  userId: string;
  ownMailbox: boolean;
  assigned: MailboxAssignment[];
  hasPersonal: boolean;
  hasFallback: boolean;
}): ChosenSender {
  if (input.module) {
    const assigned = input.assigned.find(
      (row) => row.memberIds.includes(input.userId) && row.modules.includes(input.module as string),
    );
    if (assigned) return { kind: "assigned", id: assigned.id };
  }
  const personalAllowed = input.module ? input.module === "crm" && input.ownMailbox : input.ownMailbox;
  if (personalAllowed && input.hasPersonal) return { kind: "personal" };
  if (input.hasFallback) return { kind: "fallback" };
  return null;
}
