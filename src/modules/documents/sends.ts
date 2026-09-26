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
  delivery: "email" | "link";
  versionNumber: number | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  revokedAt: string | null;
};

export type FeedbackKind =
  | "comment"
  | "suggestion"
  | "changes_requested"
  | "reply"
  | "signed"
  | "revision";

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
  party: "client" | "studio";
  signerName: string;
  signerEmail: string;
  signatureText: string | null;
  signedAt: string;
  contentHash: string | null;
};

export type SharedRevision = {
  sendId: string;
  versionNumber: number | null;
  sentAt: string;
};

export type SharedDocument = {
  /** The newest send in this recipient's chain; comments and signing always target it. */
  id: string;
  organizationId: string;
  documentId: string;
  versionId: string | null;
  title: string;
  recipientName: string | null;
  recipientEmail: string;
  sentBy: string | null;
  orgName: string;
  orgSlug: string;
  /** The revision being shown (the latest unless an older one was picked). */
  displayedSendId: string;
  isLatest: boolean;
  sentAt: string;
  content: JSONContent;
  versionNumber: number | null;
  previousContent: JSONContent | null;
  previousVersionNumber: number | null;
  revisions: SharedRevision[];
  /** Someone else at the client was sent a newer revision; only that one can be signed. */
  supersededAt: string | null;
  /** The latest version is locked (signed or accepted). */
  locked: boolean;
  /** Oldest first; either party may sign first, the other then signs the same locked version. */
  signatures: SharedSignature[];
  /** This link's recipient side has signed; the client can no longer sign here. */
  clientSigned: boolean;
  /** The latest version was accepted without signatures, so nothing is left to sign. */
  accepted: boolean;
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

type ChainRow = {
  id: string;
  document_version_id: string | null;
  sent_at: string;
  title: string;
  recipient_name: string | null;
  sent_by: string | null;
  content_doc: JSONContent;
  document_versions: { version_number: number; status: string; locked_at: string | null } | null;
};

/**
 * Resolves any link in a recipient's chain of sends to the newest revision, so old emails
 * always open the current copy. `revisionSendId` shows an older revision read-only.
 */
export async function loadSharedDocument(
  token: string,
  revisionSendId?: string | null,
): Promise<SharedDocument | null> {
  const admin = createAdminSupabaseClient();
  if (!admin || !token || token.length > 128) return null;
  const { data: entry } = await admin
    .from("document_sends")
    .select("id, organization_id, document_id, recipient_email, revoked_at, organizations(name, slug)")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (!entry || entry.revoked_at) return null;
  const org = (Array.isArray(entry.organizations) ? entry.organizations[0] : entry.organizations) as
    | { name: string; slug: string }
    | null;
  const documentId = entry.document_id as string;
  const recipientEmail = entry.recipient_email as string;

  const { data: chainRows } = await admin
    .from("document_sends")
    .select(
      "id, document_version_id, sent_at, title, recipient_name, sent_by, content_doc, document_versions(version_number, status, locked_at)",
    )
    .eq("document_id", documentId)
    .eq("recipient_email", recipientEmail)
    .is("revoked_at", null)
    .order("sent_at", { ascending: true });
  const chain = ((chainRows ?? []) as unknown[]).map((raw) => {
    const row = raw as ChainRow & { document_versions: unknown };
    const version = Array.isArray(row.document_versions)
      ? row.document_versions[0]
      : row.document_versions;
    return { ...row, document_versions: (version ?? null) as ChainRow["document_versions"] };
  });
  if (chain.length === 0) return null;

  // One entry per version: re-sending the same version to the same person isn't a revision.
  const byVersion = new Map<string, ChainRow>();
  for (const row of chain) byVersion.set(row.document_version_id ?? row.id, row);
  const revisions = [...byVersion.values()].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  const latest = revisions[revisions.length - 1];
  const displayed =
    (revisionSendId && chain.find((row) => row.id === revisionSendId)) || latest;
  const displayedKey = displayed.document_version_id ?? displayed.id;
  const displayedIndex = revisions.findIndex(
    (row) => (row.document_version_id ?? row.id) === displayedKey,
  );
  const previous = displayedIndex > 0 ? revisions[displayedIndex - 1] : null;
  const versionId = latest.document_version_id;
  const latestVersion = latest.document_versions;

  const [{ data: newer }, { data: signatures }, { data: feedbackRows }] = await Promise.all([
    admin
      .from("document_sends")
      .select("sent_at")
      .eq("document_id", documentId)
      .neq("recipient_email", recipientEmail)
      .is("revoked_at", null)
      .gt("sent_at", latest.sent_at)
      .order("sent_at", { ascending: false })
      .limit(1),
    versionId
      ? admin
          .from("document_signatures")
          .select("signer_name, signer_email, signature_text, signed_at, content_hash, method")
          .eq("document_version_id", versionId)
          .order("signed_at", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),
    admin
      .from("document_feedback")
      .select(FEEDBACK_COLUMNS)
      .eq("document_id", documentId)
      .in(
        "send_id",
        chain.map((row) => row.id),
      )
      .order("created_at", { ascending: true })
      .limit(300),
  ]);

  const signatureList = ((signatures ?? []) as Record<string, unknown>[]).map(
    (row): SharedSignature => ({
      party: row.method === "portal" ? "client" : "studio",
      signerName: row.signer_name as string,
      signerEmail: row.signer_email as string,
      signatureText: (row.signature_text as string | null) ?? null,
      signedAt: row.signed_at as string,
      contentHash: (row.content_hash as string | null) ?? null,
    }),
  );
  const locked =
    Boolean(latestVersion?.locked_at) ||
    latestVersion?.status === "signed" ||
    latestVersion?.status === "accepted";

  return {
    id: latest.id,
    organizationId: entry.organization_id as string,
    documentId,
    versionId,
    title: latest.title,
    recipientName: latest.recipient_name ?? null,
    recipientEmail,
    sentBy: latest.sent_by ?? null,
    orgName: org?.name ?? "",
    orgSlug: org?.slug ?? "",
    displayedSendId: displayed.id,
    isLatest: (displayed.document_version_id ?? displayed.id) === (latest.document_version_id ?? latest.id),
    sentAt: displayed.sent_at,
    content: displayed.content_doc,
    versionNumber: displayed.document_versions?.version_number ?? null,
    previousContent: previous?.content_doc ?? null,
    previousVersionNumber: previous?.document_versions?.version_number ?? null,
    revisions: revisions.map((row) => ({
      sendId: row.id,
      versionNumber: row.document_versions?.version_number ?? null,
      sentAt: row.sent_at,
    })),
    supersededAt: (newer?.[0]?.sent_at as string | undefined) ?? null,
    locked,
    signatures: signatureList,
    clientSigned: signatureList.some((sig) => sig.party === "client"),
    accepted: latestVersion?.status === "accepted",
    feedback: (feedbackRows ?? []).map((row) => mapFeedback(row as Record<string, unknown>)),
  };
}

/**
 * Counts a link view against a specific send (the revision the client is actually looking
 * at). The first view notifies the sender and studio owners. Email opens are counted by
 * the `mail-open` edge function instead. Never throws: tracking must not break the page.
 */
export async function trackDocumentSendById(sendId: string, kind: "view") {
  const admin = createAdminSupabaseClient();
  if (!admin) return;
  const { data } = await admin.from("document_sends").select("token_hash").eq("id", sendId).maybeSingle();
  if (!data) return;
  await trackHash(data.token_hash as string, kind);
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

async function trackHash(tokenHash: string, kind: "view"): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    if (!admin) return;
    const { data } = await admin.rpc("track_document_send", {
      p_token_hash: tokenHash,
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
    await notify({
      recipients: [row.sent_by],
      organizationId: row.organization_id,
      orgName: (org?.name as string | undefined) ?? null,
      category: "clients",
      title: `${who} viewed ${row.title}`,
      body: `${row.recipient_email} opened the document link.`,
      href: org?.slug ? `/${org.slug}/documents/${row.document_id}` : null,
      entity: { type: "document", id: row.document_id },
      actionLabel: "Open document",
    });
  } catch {
    // ignore
  }
}
