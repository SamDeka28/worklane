"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import { generateShareToken, hashShareToken } from "@/modules/portal/token";
import { unfilledFields } from "@/modules/crm/presentation";
import { isEmailConfigured, personalEmailHtml, sendEmail } from "@/shared/email";
import { mailPixelUrl } from "@/shared/email/pixel";

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const MAX_CC = 5;
const SEND_LIMIT = 40;
const SEND_WINDOW_MS = 10 * 60_000;

export type SendLeadEmailInput = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  trackOpens: boolean;
  templateId: string | null;
  /** A previous email to this lead; the new one is sent as a reply in that thread. */
  replyToId: string | null;
  followUp: { text: string; on: string } | null;
  moveToStage: string | null;
};

/**
 * Sends a one-to-one email to a lead over SMTP and does the bookkeeping around it: logs it
 * on the timeline, tracks opens, schedules the follow-up, and advances the stage.
 */
export async function sendLeadEmailAction(
  orgSlug: string,
  leadId: string,
  input: SendLeadEmailInput,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  if (!isEmailConfigured()) {
    return { error: "Email isn't set up on this workspace yet (SMTP_USER and SMTP_PASS)." };
  }

  const to = input.to.trim().toLowerCase();
  const cc = [
    ...new Set(
      input.cc
        .split(/[,;\s]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].filter((value) => value !== to);
  const subject = input.subject.trim().replace(/\s+/g, " ").slice(0, 200);
  const body = input.body.trim().slice(0, 20_000);

  if (!EMAIL_PATTERN.test(to)) return { error: "Enter a valid recipient email" };
  if (cc.length > MAX_CC) return { error: `Add at most ${MAX_CC} CC addresses` };
  const badCc = cc.find((value) => !EMAIL_PATTERN.test(value));
  if (badCc) return { error: `"${badCc}" isn't a valid email` };
  if (!subject) return { error: "Add a subject" };
  if (!body) return { error: "Write the email first" };
  const leftover = unfilledFields(`${subject}\n${body}`);
  if (leftover.length > 0) {
    return { error: `Fill in or remove {{${leftover[0]}}} before sending` };
  }

  const [{ data: lead }, { count: recent }, { data: parentRow }, { data: stage }] = await Promise.all([
    ctx.supabase
      .from("leads")
      .select("id, name, email, contact_name, stage")
      .eq("id", leadId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
    ctx.supabase
      .from("lead_emails")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.org.id)
      .eq("sent_by", ctx.userId)
      .gt("sent_at", new Date(Date.now() - SEND_WINDOW_MS).toISOString()),
    input.replyToId
      ? ctx.supabase
          .from("lead_emails")
          .select("id, message_id")
          .eq("id", input.replyToId)
          .eq("lead_id", leadId)
          .eq("organization_id", ctx.org.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.moveToStage
      ? ctx.supabase
          .from("lead_stages")
          .select("slug, system_key")
          .eq("organization_id", ctx.org.id)
          .eq("slug", input.moveToStage)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!lead) return { error: "Lead not found" };
  if ((recent ?? 0) >= SEND_LIMIT) {
    return { error: "You've sent a lot of emails in the last few minutes. Try again shortly." };
  }

  const parent = parentRow
    ? { id: String(parentRow.id), message_id: (parentRow.message_id as string | null) ?? null }
    : null;
  const stageTo =
    stage && stage.system_key == null && stage.slug !== lead.stage ? String(stage.slug) : null;

  const followUp =
    input.followUp && /^\d{4}-\d{2}-\d{2}$/.test(input.followUp.on)
      ? {
          text: input.followUp.text.trim().slice(0, 200) || `Follow up on “${subject}”`.slice(0, 200),
          on: input.followUp.on,
        }
      : null;

  const token = generateShareToken();
  const emailId = crypto.randomUUID();
  const { error: insertError } = await ctx.supabase.from("lead_emails").insert({
    id: emailId,
    organization_id: ctx.org.id,
    lead_id: leadId,
    sent_by: ctx.userId,
    to_email: to,
    to_name: (lead.contact_name as string | null) ?? null,
    cc,
    subject,
    body,
    template_id: input.templateId?.slice(0, 40) || null,
    in_reply_to: parent?.id ?? null,
    token_hash: hashShareToken(token),
    track_opens: input.trackOpens,
  });
  if (insertError) return { error: insertError.message };

  const senderName = ctx.user.displayName?.trim();
  const result = await sendEmail({
    to,
    cc,
    subject,
    fromName: senderName ? `${senderName} · ${ctx.org.name}` : ctx.org.name,
    replyTo: ctx.user.email ?? undefined,
    html: personalEmailHtml({ body, pixelUrl: input.trackOpens ? mailPixelUrl(token) : null }),
    text: body,
    inReplyTo: parent?.message_id ?? undefined,
    references: parent?.message_id ? [parent.message_id] : undefined,
  });
  if (!result.ok) {
    await ctx.supabase.from("lead_emails").delete().eq("id", emailId);
    return { error: result.error };
  }

  const activityId = crypto.randomUUID();
  const leadUpdate: Record<string, unknown> = {};
  if (followUp) {
    leadUpdate.next_action = followUp.text;
    leadUpdate.next_action_on = followUp.on;
  }
  if (stageTo) leadUpdate.stage = stageTo;
  if (!lead.email) leadUpdate.email = to;

  const { error: activityError } = await ctx.supabase.from("lead_activities").insert({
    id: activityId,
    organization_id: ctx.org.id,
    lead_id: leadId,
    kind: "email",
    body: body.slice(0, 4000),
    actor_id: ctx.userId,
  });
  await Promise.all([
    ctx.supabase
      .from("lead_emails")
      .update({ activity_id: activityError ? null : activityId, message_id: result.messageId ?? null })
      .eq("id", emailId),
    Object.keys(leadUpdate).length > 0
      ? ctx.supabase.from("leads").update(leadUpdate).eq("id", leadId).eq("organization_id", ctx.org.id)
      : Promise.resolve(),
  ]);

  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const, tracked: input.trackOpens };
}
