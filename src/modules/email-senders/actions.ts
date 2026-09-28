"use server";

import { revalidatePath } from "next/cache";
import { requireOrg, type OrgContext } from "@/modules/identity/org";
import { canUseOwnMailbox } from "@/modules/identity/permissions";
import {
  isSmtpAdmin,
  loadSmtpAccount,
  smtpSecretContext,
  smtpStorageUnavailable,
} from "@/modules/email-senders/server";
import type { SmtpScope, SmtpSenderInput } from "@/modules/email-senders/types";
import { sealSecret } from "@/shared/crypto/secrets";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import { personalEmailHtml, sendEmail, verifySmtpAccount, type SmtpAccount } from "@/shared/email";

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const HOST_PATTERN = /^[a-z0-9.-]+$/i;

type Result = { ok: true } | { error: string };

/**
 * Which row an action targets (user id, or null for the studio's), or why it's not allowed.
 * Owners and admins manage the studio's mailbox and anyone's; members only their own, once allowed.
 */
async function resolveTarget(
  ctx: OrgContext,
  scope: SmtpScope,
  memberId?: string,
): Promise<{ userId: string | null } | { error: string }> {
  const admin = isSmtpAdmin(ctx.role);
  if (scope === "studio") {
    return admin ? { userId: null } : { error: "Only owners and admins can change the studio's mailbox" };
  }
  const userId = memberId ?? ctx.userId;
  if (userId !== ctx.userId) {
    if (!admin) return { error: "Only owners and admins can manage a teammate's mailbox" };
    const { data } = await ctx.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ctx.org.id)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? { userId } : { error: "That person isn't in this studio" };
  }
  if (!ctx.canWrite) return { error: "You can't send email from this studio" };
  if (!canUseOwnMailbox(ctx)) {
    return { error: "Ask an owner or admin to turn on Own mailbox in your Team access" };
  }
  return { userId };
}

function revalidate(orgSlug: string) {
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}/emails`);
}

/** Saves the account after logging in to it, so a typo never replaces a working setup. */
export async function saveSmtpSenderAction(
  orgSlug: string,
  scope: SmtpScope,
  input: SmtpSenderInput,
  memberId?: string,
): Promise<Result> {
  const ctx = await requireOrg(orgSlug);
  const unavailable = smtpStorageUnavailable();
  if (unavailable) return { error: unavailable };
  const target = await resolveTarget(ctx, scope, memberId);
  if ("error" in target) return target;
  const { userId } = target;

  const host = input.host.trim().toLowerCase();
  const port = Math.trunc(Number(input.port));
  const username = input.username.trim();
  const fromEmail = input.fromEmail.trim().toLowerCase();
  const fromName = input.fromName.trim().slice(0, 120) || null;
  if (!host || !HOST_PATTERN.test(host)) return { error: "Enter the SMTP server, like smtp.gmail.com" };
  if (!(port >= 1 && port <= 65535)) return { error: "Enter a port between 1 and 65535" };
  if (!username) return { error: "Enter the username you sign in with" };
  if (!EMAIL_PATTERN.test(fromEmail)) return { error: "Enter the address emails come from" };

  const password =
    input.password.replace(/\s+/g, "") ||
    (await loadSmtpAccount(ctx.org.id, userId))?.pass ||
    null;
  if (!password) return { error: "Enter the password" };

  const smtp: SmtpAccount = {
    host,
    port,
    secure: input.security === "ssl",
    user: username,
    pass: password,
    fromEmail,
    fromName,
  };
  const failed = await verifySmtpAccount(smtp);
  if (failed) return { error: `Couldn't sign in to ${host}: ${failed}` };

  const sealed = sealSecret(password, smtpSecretContext(ctx.org.id, userId));
  const admin = createAdminSupabaseClient()!;
  const now = new Date().toISOString();
  const row = {
    host,
    port,
    secure: smtp.secure,
    username,
    from_email: fromEmail,
    from_name: fromName,
    key_version: sealed.keyVersion,
    iv: sealed.iv,
    auth_tag: sealed.authTag,
    ciphertext: sealed.ciphertext,
    verified_at: now,
    updated_by: ctx.userId,
    updated_at: now,
  };

  let query = admin.from("smtp_senders").select("id").eq("organization_id", ctx.org.id);
  query = userId ? query.eq("user_id", userId) : query.is("user_id", null);
  const { data: existing } = await query.maybeSingle();
  const { error } = existing
    ? await admin.from("smtp_senders").update(row).eq("id", existing.id)
    : await admin
        .from("smtp_senders")
        .insert({ ...row, organization_id: ctx.org.id, user_id: userId });
  if (error) return { error: "Couldn't save the SMTP account" };

  revalidate(orgSlug);
  return { ok: true };
}

export async function deleteSmtpSenderAction(
  orgSlug: string,
  scope: SmtpScope,
  memberId?: string,
): Promise<Result> {
  const ctx = await requireOrg(orgSlug);
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "The Supabase service key isn't configured" };
  const target = isSmtpAdmin(ctx.role) || scope === "studio"
    ? await resolveTarget(ctx, scope, memberId)
    : { userId: ctx.userId };
  if ("error" in target) return target;

  let query = admin.from("smtp_senders").delete().eq("organization_id", ctx.org.id);
  query = target.userId ? query.eq("user_id", target.userId) : query.is("user_id", null);
  const { error } = await query;
  if (error) return { error: "Couldn't remove the SMTP account" };

  revalidate(orgSlug);
  return { ok: true };
}

/** Sends a short test email to the signed-in person through one saved account. */
export async function sendSmtpTestAction(
  orgSlug: string,
  scope: SmtpScope,
  memberId?: string,
): Promise<Result & { via?: string }> {
  const ctx = await requireOrg(orgSlug);
  const to = ctx.user.email;
  if (!to) return { error: "Your account has no email address to send the test to" };
  const target = await resolveTarget(ctx, scope, memberId);
  if ("error" in target) return target;
  const smtp = await loadSmtpAccount(ctx.org.id, target.userId);
  if (!smtp) return { error: "Connect the mailbox first" };

  const body = `This is a test from Worklane.\n\nEmails sent through this mailbox go out as ${smtp.fromEmail}.`;
  const result = await sendEmail({
    to,
    subject: `Worklane test email · ${ctx.org.name}`,
    html: personalEmailHtml({ body, pixelUrl: null }),
    text: body,
    smtp,
  });
  if (!result.ok) return { error: result.error };
  return { ok: true, via: smtp.fromEmail };
}
