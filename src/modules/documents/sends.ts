import { createHmac } from "node:crypto";
import type { JSONContent } from "@tiptap/core";
import { hashShareToken } from "@/modules/portal/token";
import { notify } from "@/modules/notifications/service";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

export type DocumentSend = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  cc: string[];
  subject: string;
  sentAt: string;
  sentByName: string | null;
  trackOpens: boolean;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  revokedAt: string | null;
};

export type FeedbackKind = "comment" | "suggestion" | "changes_requested" | "reply" | "signed";

export type DocumentFeedback = {
  id: string;
  kind: FeedbackKind;
  authorType: "client" | "studio";
  authorName: string | null;
  authorEmail: string | null;
  quote: string | null;
  suggestion: string | null;
  body: string;
  createdAt: string;
  resolvedAt: string | null;
  sendId: string | null;
  versionNumber: number | null;
};

export type SharedSignature = {
  signerName: string;
  signerEmail: string;
  signatureText: string | null;
  signedAt: string;
  contentHash: string | null;
};

export type SharedDocument = {
  id: string;
  organizationId: string;
  documentId: string;
  versionId: string | null;
  title: string;
  recipientName: string | null;
  recipientEmail: string;
  sentBy: string | null;
  sentAt: string;
  content: JSONContent;
  orgName: string;
  orgSlug: string;
  /** A newer copy of this document was sent after this one; only the newest can be signed. */
  supersededAt: string | null;
  /** The version is locked (signed or accepted), from this link or another. */
  locked: boolean;
  signature: SharedSignature | null;
  feedback: DocumentFeedback[];
};

export const FEEDBACK_COLUMNS =
  "id, kind, author_type, author_name, author_email, quote, suggestion, body, created_at, resolved_at, send_id, document_versions(version_number)";

export function mapFeedback(row: Record<string, unknown>): DocumentFeedback {
  const version = (
    Array.isArray(row.document_versions) ? row.document_versions[0] : row.document_versions
  ) as { version_number: number } | null;
  return {
    id: row.id as string,
    kind: row.kind as FeedbackKind,
    authorType: row.author_type as "client" | "studio",
    authorName: (row.author_name as string | null) ?? null,
    authorEmail: (row.author_email as string | null) ?? null,
    quote: (row.quote as string | null) ?? null,
    suggestion: (row.suggestion as string | null) ?? null,
    body: (row.body as string | null) ?? "",
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    sendId: (row.send_id as string | null) ?? null,
    versionNumber: version?.version_number ?? null,
  };
}


function linkSecret() {
  const secret = process.env.DOCUMENT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("DOCUMENT_LINK_SECRET is not configured");
  return secret;
}

/** Private link token for a send; derived so replies and reminders can link back to it. */
export function documentSendToken(sendId: string) {
  return createHmac("sha256", linkSecret()).update(`document-send:${sendId}`).digest("base64url");
}

export function documentViewPath(token: string) {
  return `/portal/d/${token}`;
}

export function documentPixelPath(token: string) {
  return `/portal/t/${token}`;
}

export async function loadSharedDocument(token: string): Promise<SharedDocument | null> {
  const admin = createAdminSupabaseClient();
  if (!admin || !token || token.length > 128) return null;
  const { data } = await admin
    .from("document_sends")
    .select(
      "id, organization_id, document_id, document_version_id, title, recipient_name, recipient_email, sent_by, sent_at, content_doc, revoked_at, organizations(name, slug)",
    )
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  const org = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as
    | { name: string; slug: string }
    | null;
  const documentId = data.document_id as string;
  const versionId = (data.document_version_id as string | null) ?? null;
  const recipientEmail = data.recipient_email as string;

  const [{ data: newer }, { data: version }, { data: signatures }, { data: related }] =
    await Promise.all([
      admin
        .from("document_sends")
        .select("sent_at")
        .eq("document_id", documentId)
        .is("revoked_at", null)
        .gt("sent_at", data.sent_at as string)
        .order("sent_at", { ascending: false })
        .limit(1),
      versionId
        ? admin
            .from("document_versions")
            .select("status, locked_at")
            .eq("id", versionId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      versionId
        ? admin
            .from("document_signatures")
            .select("signer_name, signer_email, signature_text, signed_at, content_hash")
            .eq("document_version_id", versionId)
            .order("signed_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] }),
      admin
        .from("document_sends")
        .select("id")
        .eq("document_id", documentId)
        .eq("recipient_email", recipientEmail),
    ]);

  const sendIds = (related ?? []).map((row) => row.id as string);
  const { data: feedbackRows } = sendIds.length
    ? await admin
        .from("document_feedback")
        .select(FEEDBACK_COLUMNS)
        .eq("document_id", documentId)
        .in("send_id", sendIds)
        .order("created_at", { ascending: true })
        .limit(300)
    : { data: [] };

  const signature = (signatures ?? [])[0] as Record<string, unknown> | undefined;
  const locked =
    Boolean(version?.locked_at) || version?.status === "signed" || version?.status === "accepted";

  return {
    id: data.id as string,
    organizationId: data.organization_id as string,
    documentId,
    versionId,
    title: data.title as string,
    recipientName: (data.recipient_name as string | null) ?? null,
    recipientEmail,
    sentBy: (data.sent_by as string | null) ?? null,
    sentAt: data.sent_at as string,
    content: data.content_doc as JSONContent,
    orgName: org?.name ?? "",
    orgSlug: org?.slug ?? "",
    supersededAt: (newer?.[0]?.sent_at as string | undefined) ?? null,
    locked,
    signature: signature
      ? {
          signerName: signature.signer_name as string,
          signerEmail: signature.signer_email as string,
          signatureText: (signature.signature_text as string | null) ?? null,
          signedAt: signature.signed_at as string,
          contentHash: (signature.content_hash as string | null) ?? null,
        }
      : null,
    feedback: (feedbackRows ?? []).map((row) => mapFeedback(row as Record<string, unknown>)),
  };
}

type TrackRow = {
  id: string;
  organization_id: string;
  document_id: string;
  title: string;
  recipient_email: string;
  recipient_name: string | null;
  sent_by: string | null;
  first_time: boolean;
};

/**
 * Counts an email open (pixel) or a link view. The first of each kind notifies the
 * sender and studio owners. Never throws: tracking must not break the client's page.
 */
export async function trackDocumentSend(token: string, kind: "open" | "view"): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    if (!admin || !token || token.length > 128) return;
    const { data } = await admin.rpc("track_document_send", {
      p_token_hash: hashShareToken(token),
      p_kind: kind,
    });
    const row = (data as TrackRow[] | null)?.[0];
    if (!row?.first_time) return;

    const { data: org } = await admin
      .from("organizations")
      .select("name, slug")
      .eq("id", row.organization_id)
      .maybeSingle();
    const who = row.recipient_name || row.recipient_email;
    const verb = kind === "open" ? "opened the email for" : "viewed";
    await notify({
      recipients: [row.sent_by],
      organizationId: row.organization_id,
      orgName: (org?.name as string | undefined) ?? null,
      category: "clients",
      title: `${who} ${verb} ${row.title}`,
      body:
        kind === "open"
          ? `${row.recipient_email} opened the email you sent.`
          : `${row.recipient_email} opened the document link.`,
      href: org?.slug ? `/${org.slug}/documents/${row.document_id}` : null,
      entity: { type: "document", id: row.document_id },
      actionLabel: "Open document",
    });
  } catch {
    // ignore
  }
}
