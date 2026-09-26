"use server";

import { revalidatePath } from "next/cache";
import { requireOrg, requireWritableOrg } from "@/modules/identity/org";
import { generateShareToken } from "@/modules/portal/token";
import { TRACKED_EMAIL_COLUMNS, mapTrackedEmail } from "@/modules/emails/queries";
import type { ComposeEmailInput, TrackedEmail, TrackedEmailOpen } from "@/modules/emails/types";
import { isEmailConfigured, personalEmailHtml, sendEmail } from "@/shared/email";
import { mailPixelUrl } from "@/shared/email/pixel";

const CREATE_LIMIT = 200;
const CREATE_WINDOW_MS = 60 * 60_000;
const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

type Details = { subject?: string; recipient?: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function clean(details: Details) {
  const subject = details.subject?.trim().replace(/\s+/g, " ").slice(0, 200) || null;
  const recipient = details.recipient?.trim().slice(0, 320) || null;
  return { subject, recipient };
}

async function matchLead(ctx: Awaited<ReturnType<typeof requireOrg>>, recipient: string | null) {
  if (!recipient || !EMAIL_PATTERN.test(recipient) || !ctx.org.modules.crm) return null;
  const { data } = await ctx.supabase
    .from("leads")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .ilike("email", recipient.replace(/[%_\\]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function createTrackedEmailAction(
  orgSlug: string,
  details: Details & { token?: string } = {},
): Promise<{ email: TrackedEmail } | { error: string }> {
  const ctx = await requireOrg(orgSlug);
  const { subject, recipient } = clean(details);

  const [{ count }, leadId] = await Promise.all([
    ctx.supabase
      .from("mail_pixels")
      .select("id", { count: "exact", head: true })
      .eq("created_by", ctx.userId)
      .gt("created_at", new Date(Date.now() - CREATE_WINDOW_MS).toISOString()),
    matchLead(ctx, recipient),
  ]);
  if ((count ?? 0) >= CREATE_LIMIT) {
    return { error: "You’ve created a lot of tracking pixels this hour. Try again later." };
  }

  const { data, error } = await ctx.supabase
    .from("mail_pixels")
    .insert({
      organization_id: ctx.org.id,
      created_by: ctx.userId,
      token: details.token && TOKEN_PATTERN.test(details.token) ? details.token : generateShareToken(),
      claim: generateShareToken(),
      subject,
      recipient,
      lead_id: leadId,
    })
    .select(TRACKED_EMAIL_COLUMNS)
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn’t create the pixel" };

  revalidatePath(`/${orgSlug}/emails`);
  return { email: mapTrackedEmail(data as never, ctx.userId) };
}

export async function updateTrackedEmailAction(orgSlug: string, id: string, details: Details) {
  const ctx = await requireOrg(orgSlug);
  const { subject, recipient } = clean(details);
  const leadId = await matchLead(ctx, recipient);
  const { error } = await ctx.supabase
    .from("mail_pixels")
    .update({ subject, recipient, lead_id: leadId })
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .eq("created_by", ctx.userId)
    .is("sent_at", null);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/emails`);
  return { ok: true as const };
}

export async function deleteTrackedEmailAction(orgSlug: string, id: string) {
  const ctx = await requireOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("mail_pixels")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/emails`);
  return { ok: true as const };
}

export async function listTrackedEmailOpensAction(
  orgSlug: string,
  id: string,
): Promise<TrackedEmailOpen[]> {
  const ctx = await requireOrg(orgSlug);
  const { data } = await ctx.supabase
    .from("mail_pixel_opens")
    .select("id, opened_at, client")
    .eq("organization_id", ctx.org.id)
    .eq("pixel_id", id)
    .order("opened_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    at: String(row.opened_at),
    client: (row.client as string | null) ?? null,
  }));
}

const MAX_CC = 5;
const SEND_LIMIT = 40;
const SEND_WINDOW_MS = 10 * 60_000;

/** Sends a one-to-one email over the studio's SMTP with the pixel built in. */
export async function sendTrackedEmailAction(
  orgSlug: string,
  input: ComposeEmailInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const ctx = await requireWritableOrg(orgSlug);
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

  const [{ count: recent }, leadId] = await Promise.all([
    ctx.supabase
      .from("mail_pixels")
      .select("id", { count: "exact", head: true })
      .eq("created_by", ctx.userId)
      .gt("sent_at", new Date(Date.now() - SEND_WINDOW_MS).toISOString()),
    matchLead(ctx, to),
  ]);
  if ((recent ?? 0) >= SEND_LIMIT) {
    return { error: "You've sent a lot of emails in the last few minutes. Try again shortly." };
  }

  const id = crypto.randomUUID();
  const token = generateShareToken();
  const { error: insertError } = await ctx.supabase.from("mail_pixels").insert({
    id,
    organization_id: ctx.org.id,
    created_by: ctx.userId,
    token,
    claim: generateShareToken(),
    subject,
    recipient: to,
    lead_id: leadId,
    body,
    cc,
    sent_at: new Date().toISOString(),
  });
  if (insertError) return { error: insertError.message };

  const senderName = ctx.user.displayName?.trim();
  const result = await sendEmail({
    to,
    cc,
    subject,
    fromName: senderName ? `${senderName} · ${ctx.org.name}` : ctx.org.name,
    replyTo: ctx.user.email ?? undefined,
    html: personalEmailHtml({ body, pixelUrl: mailPixelUrl(token) }),
    text: body,
  });
  if (!result.ok) {
    await ctx.supabase.from("mail_pixels").delete().eq("id", id);
    return { error: result.error };
  }

  await Promise.all([
    ctx.supabase
      .from("mail_pixels")
      .update({ sent_at: new Date().toISOString(), message_id: result.messageId ?? null })
      .eq("id", id),
    leadId
      ? ctx.supabase.from("lead_activities").insert({
          organization_id: ctx.org.id,
          lead_id: leadId,
          kind: "email",
          body: `${subject}\n\n${body}`.slice(0, 4000),
          actor_id: ctx.userId,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/${orgSlug}/emails`);
  if (leadId) revalidatePath(`/${orgSlug}/crm`);
  return { ok: true, id };
}

/** Restarts the window in which hits count as the sender pasting the pixel. */
export async function markTrackedEmailCopiedAction(orgSlug: string, id: string) {
  const ctx = await requireOrg(orgSlug);
  await ctx.supabase
    .from("mail_pixels")
    .update({ copied_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .eq("created_by", ctx.userId);
}

/** Image proxies share their addresses across every user, so they can't be marked as the sender. */
const SHARED_PROXY_CLIENTS = new Set(["Gmail", "Yahoo Mail", "Apple Mail"]);

export async function dismissTrackedEmailOpenAction(orgSlug: string, pixelId: string, openId: number) {
  const ctx = await requireOrg(orgSlug);
  const [{ data: pixel }, { data: open }] = await Promise.all([
    ctx.supabase
      .from("mail_pixels")
      .select("id, self_ip_hashes")
      .eq("id", pixelId)
      .eq("organization_id", ctx.org.id)
      .eq("created_by", ctx.userId)
      .maybeSingle(),
    ctx.supabase
      .from("mail_pixel_opens")
      .select("id, client, ip_hash")
      .eq("id", openId)
      .eq("pixel_id", pixelId)
      .maybeSingle(),
  ]);
  if (!pixel || !open) return { error: "Only the person who tracked this email can do that" };

  const { error } = await ctx.supabase.from("mail_pixel_opens").delete().eq("id", openId);
  if (error) return { error: error.message };

  const { data: rest } = await ctx.supabase
    .from("mail_pixel_opens")
    .select("opened_at")
    .eq("pixel_id", pixelId)
    .order("opened_at", { ascending: true });
  const remaining = (rest ?? []).map((row) => String(row.opened_at));
  const selfHashes = (pixel.self_ip_hashes as string[] | null) ?? [];
  const ipHash = open.ip_hash as string | null;
  const addSelf =
    ipHash && !SHARED_PROXY_CLIENTS.has(String(open.client)) && !selfHashes.includes(ipHash);

  const { error: updateError } = await ctx.supabase
    .from("mail_pixels")
    .update({
      open_count: remaining.length,
      first_opened_at: remaining[0] ?? null,
      last_opened_at: remaining.at(-1) ?? null,
      ...(addSelf ? { self_ip_hashes: [ipHash, ...selfHashes].slice(0, 8) } : {}),
    })
    .eq("id", pixelId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/${orgSlug}/emails`);
  return { ok: true as const };
}
