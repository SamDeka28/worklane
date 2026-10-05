"use server";

import { revalidatePath } from "next/cache";
import { sendProjectTimesheetForContext } from "@/modules/delivery/timesheet-send";
import { requireWritableOrg } from "@/modules/identity/org";
import type { EmailAttachmentPayload } from "@/modules/emails/types";

export async function sendProjectTimesheetEmailAction(
  orgSlug: string,
  projectId: string,
  month: string,
  input: { to: string; cc?: string; subject: string; body: string; attachments?: EmailAttachmentPayload[] },
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireWritableOrg(orgSlug);
  const result = await sendProjectTimesheetForContext(ctx, projectId, month, input);
  if ("error" in result) return result;
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true };
}
