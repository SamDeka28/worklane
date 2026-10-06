import { chooseSender, type MailboxAssignment } from "@/modules/email-senders/assign";
import type { SenderVia, SmtpModuleId, SmtpScope, SmtpSecurity, SmtpSenderSummary } from "@/modules/email-senders/types";
import { openSecret, secretsKeyProblem, type SealedSecret } from "@/shared/crypto/secrets";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import { defaultFromAddress, isEmailConfigured, type SmtpAccount } from "@/shared/email";

const COLUMNS =
  "id, name, user_id, is_fallback, modules, host, port, secure, username, from_email, from_name, key_version, iv, auth_tag, ciphertext, verified_at, updated_at";

type Row = {
  id: string;
  name: string;
  user_id: string | null;
  is_fallback: boolean;
  modules: string[] | null;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_email: string;
  from_name: string | null;
  key_version: number;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  verified_at: string | null;
  updated_at: string;
};

export type CustomMailbox = {
  id: string;
  name: string;
  modules: string[];
  memberIds: string[];
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromEmail: string;
  fromName: string | null;
  verifiedAt: string | null;
  updatedAt: string;
};

export type AssignedLeadMailbox = {
  name: string;
  fromEmail: string;
  host: string;
  security: SmtpSecurity;
};

export function smtpSecretContext(orgId: string, userId: string | null) {
  return `smtp_sender:${orgId}:${userId ?? "studio"}`;
}

export function smtpStorageUnavailable(): string | null {
  const keyProblem = secretsKeyProblem();
  if (keyProblem === "invalid") {
    return "CREDENTIALS_ENCRYPTION_KEY isn't a valid key. It must be 32 random bytes, base64-encoded (44 characters), e.g. from openssl rand -base64 32. Restart the server after changing it.";
  }
  if (keyProblem === "missing") {
    return "Saving SMTP passwords needs CREDENTIALS_ENCRYPTION_KEY on the server.";
  }
  if (!createAdminSupabaseClient()) return "Saving SMTP passwords needs the Supabase service key.";
  return null;
}

async function loadRows(orgId: string, userId: string): Promise<Row[]> {
  const admin = createAdminSupabaseClient();
  if (!admin) return [];
  const { data } = await admin
    .from("smtp_senders")
    .select(COLUMNS)
    .eq("organization_id", orgId)
    .or(`user_id.is.null,user_id.eq.${userId}`);
  return (data ?? []) as Row[];
}

function summary(row: Row, scope: SmtpScope): SmtpSenderSummary {
  return {
    scope,
    host: row.host,
    port: row.port,
    security: row.secure ? "ssl" : "starttls",
    username: row.username,
    fromEmail: row.from_email,
    fromName: row.from_name,
    verifiedAt: row.verified_at,
    updatedAt: row.updated_at,
  };
}

function account(orgId: string, row: Row): SmtpAccount | null {
  if (secretsKeyProblem()) return null;
  const sealed: SealedSecret = {
    keyVersion: row.key_version,
    iv: row.iv,
    authTag: row.auth_tag,
    ciphertext: row.ciphertext,
  };
  const contexts = [`smtp_sender:${orgId}:${row.id}`, smtpSecretContext(orgId, row.user_id)];
  for (const context of contexts) {
    try {
      return {
        host: row.host,
        port: row.port,
        secure: row.secure,
        user: row.username,
        pass: openSecret(sealed, context),
        fromEmail: row.from_email,
        fromName: row.from_name,
      };
    } catch {
      continue;
    }
  }
  console.error("smtp sender decrypt failed");
  return null;
}

/** The studio's and the member's own SMTP accounts, without passwords. */
export async function getSmtpSenders(orgId: string, userId: string) {
  const rows = await loadRows(orgId, userId);
  const studio = rows.find((row) => row.is_fallback);
  const personal = rows.find((row) => row.user_id === userId);
  return {
    studio: studio ? summary(studio, "studio") : null,
    personal: personal ? summary(personal, "personal") : null,
  };
}

/** One saved account (studio when `userId` is null), with its password. */
export async function loadSmtpAccount(orgId: string, userId: string | null) {
  const admin = createAdminSupabaseClient();
  if (!admin) return null;
  let query = admin.from("smtp_senders").select(COLUMNS).eq("organization_id", orgId);
  query = userId ? query.eq("user_id", userId) : query.eq("is_fallback", true);
  const { data } = await query.maybeSingle();
  return data ? account(orgId, data as Row) : null;
}

/** One custom mailbox, with its password. Not the studio fallback or a personal row. */
export async function loadCustomSmtpAccount(orgId: string, id: string) {
  const admin = createAdminSupabaseClient();
  if (!admin) return null;
  const { data } = await admin
    .from("smtp_senders")
    .select(COLUMNS)
    .eq("organization_id", orgId)
    .eq("id", id)
    .eq("is_fallback", false)
    .is("user_id", null)
    .maybeSingle();
  return data ? account(orgId, data as Row) : null;
}

export function isSmtpAdmin(role: string) {
  return role === "owner" || role === "admin";
}

/** Where lead emails go when a member has no mailbox of their own. */
export function leadFallbackLabel(studio: SmtpSenderSummary | null) {
  if (studio) return `the studio mailbox (${studio.fromEmail})`;
  if (isEmailConfigured()) return `Worklane's default address (${defaultFromAddress()})`;
  return "nowhere yet, so sending is off";
}

/** What the Mailbox tab in CRM settings needs; `allowed` comes from `canUseOwnMailbox`. */
export async function getLeadMailbox(orgId: string, userId: string, role: string, allowed: boolean) {
  const [senders, assigned] = await Promise.all([
    getSmtpSenders(orgId, userId),
    assignedLeadMailbox(orgId, userId),
  ]);
  return {
    allowed,
    isAdmin: isSmtpAdmin(role),
    saved: senders.personal,
    assigned,
    fallback: leadFallbackLabel(senders.studio),
    unavailable: smtpStorageUnavailable(),
  };
}

/** The Leads mailbox assigned to this person, without its password. */
export async function assignedLeadMailbox(orgId: string, userId: string): Promise<AssignedLeadMailbox | null> {
  const { rows, assignments } = await loadOrgMailboxes(orgId);
  const chosen = chooseSender({
    module: "crm",
    userId,
    ownMailbox: false,
    assigned: assignments,
    hasPersonal: false,
    hasFallback: false,
  });
  if (chosen?.kind !== "assigned") return null;
  const row = rows.find((item) => item.id === chosen.id);
  if (!row) return null;
  return {
    name: row.name,
    fromEmail: row.from_email,
    host: row.host,
    security: row.secure ? "ssl" : "starttls",
  };
}

/** Custom mailboxes (not the studio fallback and not a personal lead mailbox). */
export async function listCustomMailboxes(orgId: string): Promise<CustomMailbox[]> {
  const { rows, assignments } = await loadOrgMailboxes(orgId);
  const membersBySender = new Map(assignments.map((row) => [row.id, row.memberIds]));
  return rows
    .filter((row) => !row.is_fallback && row.user_id == null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      modules: row.modules ?? [],
      memberIds: membersBySender.get(row.id) ?? [],
      host: row.host,
      port: row.port,
      security: row.secure ? "ssl" : "starttls",
      username: row.username,
      fromEmail: row.from_email,
      fromName: row.from_name,
      verifiedAt: row.verified_at,
      updatedAt: row.updated_at,
    }));
}

/** The studio's mailbox and every member's lead mailbox, keyed by user id. */
export async function listOrgSmtp(orgId: string) {
  const members = new Map<string, SmtpSenderSummary>();
  let studio: SmtpSenderSummary | null = null;
  const admin = createAdminSupabaseClient();
  if (!admin) return { studio, members };
  const { data } = await admin.from("smtp_senders").select(COLUMNS).eq("organization_id", orgId);
  for (const row of (data ?? []) as Row[]) {
    if (row.is_fallback) studio = summary(row, "studio");
    else if (row.user_id) members.set(row.user_id, summary(row, "personal"));
  }
  return { studio, members };
}

export type ResolvedSender = {
  smtp: SmtpAccount | null;
  via: SenderVia | null;
  fromAddress: string | null;
};

/**
 * Who a member's emails go out as for one module.
 * An assigned mailbox wins, then a personal lead mailbox, then the studio fallback,
 * then the workspace default.
 */
export async function resolveSender(
  orgId: string,
  userId: string,
  options: { ownMailbox?: boolean; module?: SmtpModuleId } = {},
): Promise<ResolvedSender> {
  const { rows, assignments } = await loadOrgMailboxes(orgId);
  let remaining = assignments;
  let hasPersonal = rows.some((row) => row.user_id === userId);
  let hasFallback = rows.some((row) => row.is_fallback);
  for (let attempt = 0; attempt < 3; attempt++) {
    const chosen = chooseSender({
      module: options.module,
      userId,
      ownMailbox: options.ownMailbox === true,
      assigned: remaining,
      hasPersonal,
      hasFallback,
    });
    if (!chosen) break;
    const row =
      chosen.kind === "assigned"
        ? rows.find((item) => item.id === chosen.id)
        : chosen.kind === "personal"
          ? rows.find((item) => item.user_id === userId)
          : rows.find((item) => item.is_fallback);
    if (row) {
      const smtp = account(orgId, row);
      if (smtp) {
        const via: SenderVia = chosen.kind === "personal" ? "personal" : "studio";
        return { smtp, via, fromAddress: smtp.fromEmail };
      }
    }
    if (chosen.kind === "assigned") remaining = remaining.filter((item) => item.id !== chosen.id);
    else if (chosen.kind === "personal") hasPersonal = false;
    else hasFallback = false;
  }
  if (isEmailConfigured()) return { smtp: null, via: "default", fromAddress: defaultFromAddress() };
  return { smtp: null, via: null, fromAddress: null };
}

async function loadOrgMailboxes(orgId: string): Promise<{ rows: Row[]; assignments: MailboxAssignment[] }> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { rows: [], assignments: [] };
  const [{ data: senderRows }, { data: memberRows }] = await Promise.all([
    admin.from("smtp_senders").select(COLUMNS).eq("organization_id", orgId),
    admin.from("smtp_sender_members").select("smtp_sender_id, user_id").eq("organization_id", orgId),
  ]);
  const rows = (senderRows ?? []) as Row[];
  const members = new Map<string, string[]>();
  for (const member of memberRows ?? []) {
    const id = member.smtp_sender_id as string;
    const list = members.get(id) ?? [];
    list.push(member.user_id as string);
    members.set(id, list);
  }
  const assignments = rows
    .filter((row) => !row.is_fallback && row.user_id == null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      modules: row.modules ?? [],
      memberIds: members.get(row.id) ?? [],
    }));
  return { rows, assignments };
}
