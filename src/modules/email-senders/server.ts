import type { SenderVia, SmtpScope, SmtpSenderSummary } from "@/modules/email-senders/types";
import { openSecret, secretsKeyProblem, type SealedSecret } from "@/shared/crypto/secrets";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import { defaultFromAddress, isEmailConfigured, type SmtpAccount } from "@/shared/email";

const COLUMNS =
  "user_id, host, port, secure, username, from_email, from_name, key_version, iv, auth_tag, ciphertext, verified_at, updated_at";

type Row = {
  user_id: string | null;
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
  try {
    const sealed: SealedSecret = {
      keyVersion: row.key_version,
      iv: row.iv,
      authTag: row.auth_tag,
      ciphertext: row.ciphertext,
    };
    return {
      host: row.host,
      port: row.port,
      secure: row.secure,
      user: row.username,
      pass: openSecret(sealed, smtpSecretContext(orgId, row.user_id)),
      fromEmail: row.from_email,
      fromName: row.from_name,
    };
  } catch (error) {
    console.error("smtp sender decrypt failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** The studio's and the member's own SMTP accounts, without passwords. */
export async function getSmtpSenders(orgId: string, userId: string) {
  const rows = await loadRows(orgId, userId);
  const studio = rows.find((row) => row.user_id === null);
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
  query = userId ? query.eq("user_id", userId) : query.is("user_id", null);
  const { data } = await query.maybeSingle();
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
  const senders = await getSmtpSenders(orgId, userId);
  return {
    allowed,
    isAdmin: isSmtpAdmin(role),
    saved: senders.personal,
    fallback: leadFallbackLabel(senders.studio),
    unavailable: smtpStorageUnavailable(),
  };
}

/** The studio's mailbox and every member's lead mailbox, keyed by user id. */
export async function listOrgSmtp(orgId: string) {
  const members = new Map<string, SmtpSenderSummary>();
  let studio: SmtpSenderSummary | null = null;
  const admin = createAdminSupabaseClient();
  if (!admin) return { studio, members };
  const { data } = await admin.from("smtp_senders").select(COLUMNS).eq("organization_id", orgId);
  for (const row of (data ?? []) as Row[]) {
    if (row.user_id) members.set(row.user_id, summary(row, "personal"));
    else studio = summary(row, "studio");
  }
  return { studio, members };
}

export type ResolvedSender = {
  smtp: SmtpAccount | null;
  via: SenderVia | null;
  fromAddress: string | null;
};

/**
 * Who a member's emails go out as. Pass `ownMailbox` (lead emails from a member allowed by
 * `canUseOwnMailbox`) to try their own first; otherwise the studio's, then the workspace default.
 */
export async function resolveSender(
  orgId: string,
  userId: string,
  options: { ownMailbox: boolean } = { ownMailbox: false },
): Promise<ResolvedSender> {
  const rows = await loadRows(orgId, userId);
  for (const [row, via] of [
    [options.ownMailbox ? rows.find((item) => item.user_id === userId) : undefined, "personal"],
    [rows.find((item) => item.user_id === null), "studio"],
  ] as const) {
    if (!row) continue;
    const smtp = account(orgId, row);
    if (smtp) return { smtp, via, fromAddress: smtp.fromEmail };
  }
  if (isEmailConfigured()) return { smtp: null, via: "default", fromAddress: defaultFromAddress() };
  return { smtp: null, via: null, fromAddress: null };
}
