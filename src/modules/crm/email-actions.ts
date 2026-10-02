"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import { canUseOwnMailbox } from "@/modules/identity/permissions";
import { notifyOwners } from "@/modules/notifications/service";
import { generateShareToken, hashShareToken } from "@/modules/portal/token";
import { companyFromEmail, unfilledFields } from "@/modules/crm/presentation";
import { resolveSender, type ResolvedSender } from "@/modules/email-senders/server";
import { senderSignature } from "@/modules/email-signatures/server";
import type { RenderedSignature } from "@/modules/email-signatures/types";
import { personalEmailHtml, personalEmailText, sendEmail } from "@/shared/email";
import { mailPixelUrl } from "@/shared/email/pixel";
import { parseEmailAttachments } from "@/shared/email/attachments";
import type { EmailAttachmentPayload } from "@/modules/emails/types";
import { removeEmailAttachments, storeEmailAttachments } from "@/modules/emails/storage";

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const MAX_CC = 5;
const SEND_LIMIT = 40;
const SEND_WINDOW_MS = 10 * 60_000;
const OUTBOUND_SOURCE = "Outbound email";

export type SendLeadEmailInput = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  trackOpens: boolean;
  /** Adds the sender's signature (theirs or the studio's) below the message. */
  includeSignature: boolean;
  templateId: string | null;
  /** A previous email to this lead; the new one is sent as a reply in that thread. */
  replyToId: string | null;
  followUp: { text: string; on: string } | null;
  moveToStage: string | null;
  attachments?: EmailAttachmentPayload[];
};

export type StartLeadEmailInput = Omit<SendLeadEmailInput, "replyToId"> & {
  contactName: string;
  company: string;
};

type Ctx = Awaited<ReturnType<typeof requireWritableOrg>>;
type ParsedEmail = { to: string; cc: string[]; subject: string; body: string };
type LeadTarget = { id: string; email: string | null; contactName: string | null; stage: string };

function parseEmail(input: Pick<SendLeadEmailInput, "to" | "cc" | "subject" | "body">) {
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
  return { email: { to, cc, subject, body } satisfies ParsedEmail };
}

async function sendAllowed(
  ctx: Ctx,
): Promise<{ error: string } | { sender: ResolvedSender; signature: RenderedSignature | null }> {
  if (!ctx.org.modules.crm) return { error: "CRM is disabled for this studio" };
  const [sender, { count }, signature] = await Promise.all([
    resolveSender(ctx.org.id, ctx.userId, { ownMailbox: canUseOwnMailbox(ctx) }),
    ctx.supabase
      .from("lead_emails")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.org.id)
      .eq("sent_by", ctx.userId)
      .gt("sent_at", new Date(Date.now() - SEND_WINDOW_MS).toISOString()),
    senderSignature(ctx, "leads"),
  ]);
  if (!sender.via) {
    return { error: "Email sending isn't set up. Connect a mailbox in CRM settings → Mailbox, or ask an admin to set the studio's in Settings." };
  }
  if ((count ?? 0) >= SEND_LIMIT) {
    return { error: "You've sent a lot of emails in the last few minutes. Try again shortly." };
  }
  return { sender, signature };
}

async function openStageSlug(ctx: Ctx, slug: string | null) {
  if (!slug) return null;
  const { data } = await ctx.supabase
    .from("lead_stages")
    .select("slug, system_key")
    .eq("organization_id", ctx.org.id)
    .eq("slug", slug)
    .maybeSingle();
  return data && data.system_key == null ? String(data.slug) : null;
}

function parseFollowUp(followUp: SendLeadEmailInput["followUp"], subject: string) {
  if (!followUp || !/^\d{4}-\d{2}-\d{2}$/.test(followUp.on)) return null;
  return {
    text: followUp.text.trim().slice(0, 200) || `Follow up on “${subject}”`.slice(0, 200),
    on: followUp.on,
  };
}

/**
 * Sends the email over SMTP and does the bookkeeping around it: logs it on the timeline,
 * tracks opens, schedules the follow-up, and advances the stage.
 */
async function deliverLeadEmail(
  ctx: Ctx,
  sender: ResolvedSender,
  lead: LeadTarget,
  email: ParsedEmail,
  options: {
    trackOpens: boolean;
    signature: RenderedSignature | null;
    templateId: string | null;
    parent: { id: string; message_id: string | null } | null;
    followUp: { text: string; on: string } | null;
    stageTo: string | null;
    attachments: { filename: string; content: Buffer; contentType: string }[];
  },
) {
  const token = generateShareToken();
  const emailId = crypto.randomUUID();
  const savedAttachments = await storeEmailAttachments(
    ctx.supabase,
    ctx.org.id,
    ctx.userId,
    emailId,
    options.attachments,
  );
  if ("error" in savedAttachments) return { error: savedAttachments.error };
  const { error: insertError } = await ctx.supabase.from("lead_emails").insert({
    id: emailId,
    organization_id: ctx.org.id,
    lead_id: lead.id,
    sent_by: ctx.userId,
    to_email: email.to,
    to_name: lead.contactName,
    cc: email.cc,
    subject: email.subject,
    body: email.body,
    attachments: savedAttachments.attachments,
    template_id: options.templateId?.slice(0, 40) || null,
    in_reply_to: options.parent?.id ?? null,
    token_hash: hashShareToken(token),
    track_opens: options.trackOpens,
  });
  if (insertError) {
    await removeEmailAttachments(ctx.supabase, savedAttachments.attachments);
    return { error: insertError.message };
  }

  const senderName = ctx.user.displayName?.trim();
  const result = await sendEmail({
    to: email.to,
    cc: email.cc,
    subject: email.subject,
    fromName:
      sender.via === "personal" && sender.smtp?.fromName
        ? undefined
        : senderName
          ? `${senderName} · ${ctx.org.name}`
          : ctx.org.name,
    replyTo: sender.via === "personal" ? undefined : (ctx.user.email ?? undefined),
    smtp: sender.smtp,
    html: personalEmailHtml({
      body: email.body,
      signature: options.signature,
      pixelUrl: options.trackOpens ? mailPixelUrl(token) : null,
    }),
    text: personalEmailText({ body: email.body, signature: options.signature }),
    inReplyTo: options.parent?.message_id ?? undefined,
    references: options.parent?.message_id ? [options.parent.message_id] : undefined,
    attachments: options.attachments,
  });
  if (!result.ok) {
    await ctx.supabase.from("lead_emails").delete().eq("id", emailId);
    await removeEmailAttachments(ctx.supabase, savedAttachments.attachments);
    return { error: result.error };
  }

  const activityId = crypto.randomUUID();
  const leadUpdate: Record<string, unknown> = {};
  if (options.followUp) {
    leadUpdate.next_action = options.followUp.text;
    leadUpdate.next_action_on = options.followUp.on;
  }
  if (options.stageTo && options.stageTo !== lead.stage) leadUpdate.stage = options.stageTo;
  if (!lead.email) leadUpdate.email = email.to;

  const { error: activityError } = await ctx.supabase.from("lead_activities").insert({
    id: activityId,
    organization_id: ctx.org.id,
    lead_id: lead.id,
    kind: "email",
    body: email.body.slice(0, 4000),
    actor_id: ctx.userId,
  });
  await Promise.all([
    ctx.supabase
      .from("lead_emails")
      .update({
        activity_id: activityError ? null : activityId,
        message_id: result.messageId ?? null,
      })
      .eq("id", emailId),
    Object.keys(leadUpdate).length > 0
      ? ctx.supabase.from("leads").update(leadUpdate).eq("id", lead.id).eq("organization_id", ctx.org.id)
      : Promise.resolve(),
  ]);
  return { ok: true as const };
}

/** Sends a one-to-one email to an existing lead. The caller already resolved the studio. */
export async function sendLeadEmailForContext(
  ctx: Ctx,
  leadId: string,
  input: SendLeadEmailInput,
) {
  const allowed = await sendAllowed(ctx);
  if ("error" in allowed) return { error: allowed.error };
  const parsed = parseEmail(input);
  if ("error" in parsed) return { error: parsed.error };
  const attachments = parseEmailAttachments(input.attachments);
  if ("error" in attachments) return attachments;

  const [{ data: lead }, { data: parentRow }, stageTo] = await Promise.all([
    ctx.supabase
      .from("leads")
      .select("id, email, contact_name, stage")
      .eq("id", leadId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
    input.replyToId
      ? ctx.supabase
          .from("lead_emails")
          .select("id, message_id")
          .eq("id", input.replyToId)
          .eq("lead_id", leadId)
          .eq("organization_id", ctx.org.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    openStageSlug(ctx, input.moveToStage),
  ]);
  if (!lead) return { error: "Lead not found" };

  const sent = await deliverLeadEmail(
    ctx,
    allowed.sender,
    {
      id: String(lead.id),
      email: (lead.email as string | null) ?? null,
      contactName: (lead.contact_name as string | null) ?? null,
      stage: String(lead.stage),
    },
    parsed.email,
    {
      trackOpens: input.trackOpens,
      signature: input.includeSignature ? allowed.signature : null,
      templateId: input.templateId,
      parent: parentRow
        ? { id: String(parentRow.id), message_id: (parentRow.message_id as string | null) ?? null }
        : null,
      followUp: parseFollowUp(input.followUp, parsed.email.subject),
      stageTo,
      attachments: attachments.attachments,
    },
  );
  if ("error" in sent) return { error: sent.error };

  return { ok: true as const, tracked: input.trackOpens };
}

/** Sends a one-to-one email to an existing lead. */
export async function sendLeadEmailAction(
  orgSlug: string,
  leadId: string,
  input: SendLeadEmailInput,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const sent = await sendLeadEmailForContext(ctx, leadId, input);
  if (!("error" in sent)) {
    revalidatePath(`/${orgSlug}/crm`);
    revalidatePath(`/${orgSlug}`);
  }
  return sent;
}

/** Starts a lead by emailing them: creates the lead, then sends and logs the first email. */
export async function startLeadWithEmailAction(orgSlug: string, input: StartLeadEmailInput) {
  const ctx = await requireWritableOrg(orgSlug);
  const allowed = await sendAllowed(ctx);
  if ("error" in allowed) return { error: allowed.error };
  const parsed = parseEmail(input);
  if ("error" in parsed) return { error: parsed.error };
  const attachments = parseEmailAttachments(input.attachments);
  if ("error" in attachments) return attachments;

  const contactName = input.contactName.trim().slice(0, 120) || null;
  const company = input.company.trim().slice(0, 120) || companyFromEmail(parsed.email.to) || null;
  const name = company || contactName || parsed.email.to;

  const [{ data: firstStage }, stageTo] = await Promise.all([
    ctx.supabase
      .from("lead_stages")
      .select("slug")
      .eq("organization_id", ctx.org.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle(),
    openStageSlug(ctx, input.moveToStage),
  ]);
  const stage = stageTo ?? (firstStage?.slug ? String(firstStage.slug) : "new");

  const { data: lead, error } = await ctx.supabase
    .from("leads")
    .insert({
      organization_id: ctx.org.id,
      name,
      company,
      contact_name: contactName,
      email: parsed.email.to,
      source: OUTBOUND_SOURCE,
      currency: ctx.org.defaultCurrency,
      owner_user_id: ctx.userId,
      stage,
    })
    .select("id")
    .single();
  if (error || !lead) return { error: error?.message ?? "Could not create the lead" };
  const leadId = String(lead.id);

  const sent = await deliverLeadEmail(
    ctx,
    allowed.sender,
    { id: leadId, email: parsed.email.to, contactName, stage },
    parsed.email,
    {
      trackOpens: input.trackOpens,
      signature: input.includeSignature ? allowed.signature : null,
      templateId: input.templateId,
      parent: null,
      followUp: parseFollowUp(input.followUp, parsed.email.subject),
      stageTo: null,
      attachments: attachments.attachments,
    },
  );
  if ("error" in sent) {
    await ctx.supabase.from("leads").delete().eq("id", leadId).eq("organization_id", ctx.org.id);
    return { error: sent.error };
  }

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "created",
    entity_type: "lead",
    entity_id: leadId,
    metadata: { name, stage, via: "email" },
  });
  await notifyOwners({
    organizationId: ctx.org.id,
    orgName: ctx.org.name,
    actorId: ctx.userId,
    category: "leads",
    title: (actor) => `${actor} emailed a new lead, ${name}`,
    body: parsed.email.subject,
    href: `/${orgSlug}/crm?lead=${leadId}`,
    entity: { type: "lead", id: leadId },
    actionLabel: "Open lead",
  });

  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const, leadId };
}
