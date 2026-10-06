"use server";

import { revalidatePath } from "next/cache";
import { requireOrg, type OrgContext } from "@/modules/identity/org";
import { canManageSmtp, canUseOwnMailbox } from "@/modules/identity/permissions";
import { assignmentConflict } from "@/modules/email-senders/assign";
import {
  isSmtpAdmin,
  listCustomMailboxes,
  loadCustomSmtpAccount,
  loadSmtpAccount,
  smtpStorageUnavailable,
} from "@/modules/email-senders/server";
import { SMTP_MODULES, smtpModuleLabel, type SmtpModuleId, type SmtpScope, type SmtpSenderInput } from "@/modules/email-senders/types";
import { sealSecret } from "@/shared/crypto/secrets";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import { personalEmailHtml, verifySmtpAccount, type SmtpAccount } from "@/shared/email";
import { sendTrackedApplicationEmail } from "@/modules/emails/application-send";

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

  const admin = createAdminSupabaseClient()!;
  const now = new Date().toISOString();
  let lookup = admin.from("smtp_senders").select("id").eq("organization_id", ctx.org.id);
  lookup = userId ? lookup.eq("user_id", userId) : lookup.eq("is_fallback", true);
  const { data: existing } = await lookup.maybeSingle();
  const rowId = (existing?.id as string | undefined) ?? crypto.randomUUID();
  const sealed = sealSecret(password, `smtp_sender:${ctx.org.id}:${rowId}`);
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
    name: userId ? "Personal mailbox" : "Studio mailbox",
    is_fallback: userId == null,
    modules: [] as string[],
  };

  const { error } = existing
    ? await admin.from("smtp_senders").update(row).eq("id", existing.id)
    : await admin
        .from("smtp_senders")
        .insert({ ...row, id: rowId, organization_id: ctx.org.id, user_id: userId });
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
  query = target.userId ? query.eq("user_id", target.userId) : query.eq("is_fallback", true);
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
  const result = await sendTrackedApplicationEmail(ctx.supabase, {
    organizationId: ctx.org.id,
    userId: ctx.userId,
  }, {
    to,
    subject: `Worklane test email · ${ctx.org.name}`,
    html: personalEmailHtml({ body, pixelUrl: null }),
    text: body,
    body,
    smtp,
  });
  if (!result.ok) return { error: result.error };
  return { ok: true, via: smtp.fromEmail };
}

export type CustomSmtpInput = SmtpSenderInput & {
  name: string;
  modules: string[];
  memberIds: string[];
};

async function requireCustomSmtp(
  orgSlug: string,
): Promise<{ error: string } | { ctx: OrgContext }> {
  const ctx = await requireOrg(orgSlug);
  if (!canManageSmtp(ctx)) return { error: "You can't manage custom SMTP mailboxes" };
  return { ctx };
}

/** Saves a custom mailbox after signing in, and assigns it to teammates for the chosen modules. */
export async function saveCustomSmtpAction(
  orgSlug: string,
  input: CustomSmtpInput,
  mailboxId?: string,
): Promise<Result> {
  const gate = await requireCustomSmtp(orgSlug);
  if ("error" in gate) return gate;
  const { ctx } = gate;
  const unavailable = smtpStorageUnavailable();
  if (unavailable) return { error: unavailable };

  const name = input.name.trim().slice(0, 80);
  const modules = [...new Set(input.modules.filter((id): id is SmtpModuleId => SMTP_MODULES.some((module) => module.id === id)))];
  const memberIds = [...new Set(input.memberIds.map((id) => id.trim()).filter(Boolean))];
  if (!name) return { error: "Name this mailbox" };
  if (modules.length === 0) return { error: "Choose at least one module" };
  if (memberIds.length === 0) return { error: "Choose at least one teammate" };

  const { data: members } = await ctx.supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", ctx.org.id)
    .in("user_id", memberIds);
  const allowed = new Set((members ?? []).map((row) => row.user_id as string));
  if (memberIds.some((id) => !allowed.has(id))) return { error: "That person isn't in this studio" };

  const existing = await listCustomMailboxes(ctx.org.id);
  const conflict = assignmentConflict(existing, { id: mailboxId, modules, memberIds });
  if (conflict) {
    return {
      error: `${conflict} is already assigned to that person for ${modules.map(smtpModuleLabel).join(", ")}.`,
    };
  }

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
    (mailboxId ? (await loadCustomSmtpAccount(ctx.org.id, mailboxId))?.pass : null) ||
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

  const admin = createAdminSupabaseClient()!;
  const rowId = mailboxId ?? crypto.randomUUID();
  const sealed = sealSecret(password, `smtp_sender:${ctx.org.id}:${rowId}`);
  const now = new Date().toISOString();
  const row = {
    name,
    modules,
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
    is_fallback: false,
    user_id: null,
  };
  const { error } = mailboxId
    ? await admin
        .from("smtp_senders")
        .update(row)
        .eq("id", mailboxId)
        .eq("organization_id", ctx.org.id)
        .eq("is_fallback", false)
        .is("user_id", null)
    : await admin.from("smtp_senders").insert({ ...row, id: rowId, organization_id: ctx.org.id });
  if (error) return { error: "Couldn't save the SMTP account" };

  await admin.from("smtp_sender_members").delete().eq("smtp_sender_id", rowId).eq("organization_id", ctx.org.id);
  const { error: memberError } = await admin.from("smtp_sender_members").insert(
    memberIds.map((userId) => ({
      smtp_sender_id: rowId,
      user_id: userId,
      organization_id: ctx.org.id,
    })),
  );
  if (memberError) return { error: "The mailbox was saved, but the teammate assignment failed" };

  revalidate(orgSlug);
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true };
}

export async function deleteCustomSmtpAction(orgSlug: string, mailboxId: string): Promise<Result> {
  const gate = await requireCustomSmtp(orgSlug);
  if ("error" in gate) return gate;
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "The Supabase service key isn't configured" };
  const { error } = await admin
    .from("smtp_senders")
    .delete()
    .eq("id", mailboxId)
    .eq("organization_id", gate.ctx.org.id)
    .eq("is_fallback", false)
    .is("user_id", null);
  if (error) return { error: "Couldn't remove the SMTP account" };
  revalidate(orgSlug);
  revalidatePath(`/${orgSlug}/crm`);
  return { ok: true };
}

export async function sendCustomSmtpTestAction(orgSlug: string, mailboxId: string): Promise<Result & { via?: string }> {
  const gate = await requireCustomSmtp(orgSlug);
  if ("error" in gate) return gate;
  const { ctx } = gate;
  const to = ctx.user.email;
  if (!to) return { error: "Your account has no email address to send the test to" };
  const smtp = await loadCustomSmtpAccount(ctx.org.id, mailboxId);
  if (!smtp) return { error: "Connect the mailbox first" };
  const body = `This is a test from Worklane.\n\nEmails sent through this mailbox go out as ${smtp.fromEmail}.`;
  const result = await sendTrackedApplicationEmail(ctx.supabase, {
    organizationId: ctx.org.id,
    userId: ctx.userId,
  }, {
    to,
    subject: `Worklane test email · ${ctx.org.name}`,
    html: personalEmailHtml({ body, pixelUrl: null }),
    text: body,
    body,
    smtp,
  });
  if (!result.ok) return { error: result.error };
  return { ok: true, via: smtp.fromEmail };
}
