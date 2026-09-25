"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { buildLiveSnapshot } from "@/modules/documents/lock";
import { documentViewPath, loadSharedDocument } from "@/modules/documents/sends";
import { notify } from "@/modules/notifications/service";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import {
  documentUpdateEmailHtml,
  documentUpdateEmailText,
  getAppUrl,
  isEmailConfigured,
  sendEmail,
} from "@/shared/email";

const CLIENT_KINDS = ["comment", "suggestion", "changes_requested"] as const;
type ClientKind = (typeof CLIENT_KINDS)[number];
const MAX_FEEDBACK_PER_HOUR = 40;

const KIND_VERB: Record<ClientKind, string> = {
  comment: "commented on",
  suggestion: "suggested an edit to",
  changes_requested: "requested changes to",
};

export async function postPortalFeedbackAction(token: string, formData: FormData) {
  const shared = await loadSharedDocument(token);
  const admin = createAdminSupabaseClient();
  if (!shared || !admin) return { error: "This link is no longer available" };
  if (shared.locked) return { error: "This document has already been signed" };

  const kindRaw = String(formData.get("kind") ?? "comment");
  const kind = (CLIENT_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as ClientKind)
    : "comment";
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const quote = String(formData.get("quote") ?? "").trim().slice(0, 600) || null;
  const suggestion =
    kind === "suggestion" ? String(formData.get("suggestion") ?? "").trim().slice(0, 4000) : "";
  const authorName =
    String(formData.get("author_name") ?? "").trim().slice(0, 120) || shared.recipientName;

  if (kind === "suggestion" && (!quote || !suggestion)) {
    return { error: "Select the text you want changed and write your suggested wording" };
  }
  if (kind !== "suggestion" && !body) return { error: "Write a message first" };

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("document_feedback")
    .select("id", { count: "exact", head: true })
    .eq("send_id", shared.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_FEEDBACK_PER_HOUR) {
    return { error: "That's a lot of comments in a short time. Please try again later." };
  }

  const { error } = await admin.from("document_feedback").insert({
    organization_id: shared.organizationId,
    document_id: shared.documentId,
    document_version_id: shared.versionId,
    send_id: shared.id,
    kind,
    author_type: "client",
    author_name: authorName,
    author_email: shared.recipientEmail,
    quote,
    suggestion: suggestion || null,
    body,
  });
  if (error) return { error: "Couldn't save your feedback. Please try again." };

  const who = authorName || shared.recipientEmail;
  await notify({
    recipients: [shared.sentBy],
    organizationId: shared.organizationId,
    orgName: shared.orgName,
    category: "clients",
    title: `${who} ${KIND_VERB[kind]} ${shared.title}`,
    body: (kind === "suggestion" ? suggestion : body).slice(0, 280),
    href: shared.orgSlug ? `/${shared.orgSlug}/documents/${shared.documentId}` : null,
    entity: { type: "document", id: shared.documentId },
    actionLabel: "Review feedback",
    email: kind === "changes_requested" ? true : undefined,
  });

  revalidatePath(documentViewPath(token));
  return { ok: true as const };
}

export async function signPortalDocumentAction(token: string, formData: FormData) {
  const shared = await loadSharedDocument(token);
  const admin = createAdminSupabaseClient();
  if (!shared || !admin) return { error: "This link is no longer available" };
  if (shared.locked) return { error: "This document has already been signed" };
  if (shared.supersededAt) {
    return { error: "A newer revision was sent to you. Please sign the latest copy." };
  }
  if (!shared.versionId) return { error: "This copy can't be signed. Ask the sender to resend it." };

  const signerName = String(formData.get("signer_name") ?? "").trim().slice(0, 120);
  const signatureText = String(formData.get("signature_text") ?? "").trim().slice(0, 120);
  const consent = formData.get("consent") === "on";
  if (!signerName) return { error: "Enter your full name" };
  if (!signatureText) return { error: "Type your signature" };
  if (!consent) return { error: "Tick the box to confirm you agree" };

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    null;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null;
  const contentHash = createHash("sha256").update(JSON.stringify(shared.content)).digest("hex");
  const signedAt = new Date().toISOString();

  const { data: document } = await admin
    .from("documents")
    .select("client_id, project_id, clients(name), projects(name)")
    .eq("id", shared.documentId)
    .maybeSingle();
  const pick = (value: unknown) =>
    ((Array.isArray(value) ? value[0] : value) as { name: string } | null)?.name ?? null;

  const { data: lockedVersion } = await admin
    .from("document_versions")
    .update({
      status: "signed",
      locked_at: signedAt,
      snapshot: buildLiveSnapshot({
        clientName: pick(document?.clients),
        projectName: pick(document?.projects),
        contentDoc: shared.content as Record<string, unknown>,
        frozenAt: signedAt,
      }),
    })
    .eq("id", shared.versionId)
    .is("locked_at", null)
    .neq("status", "signed")
    .select("id")
    .maybeSingle();
  if (!lockedVersion) return { error: "This document has already been signed" };

  const intentText = `I, ${signerName}, agree to the terms of "${shared.title}" and adopt "${signatureText}" as my electronic signature.`;
  const { error: signatureError } = await admin.from("document_signatures").insert({
    organization_id: shared.organizationId,
    document_version_id: shared.versionId,
    signer_name: signerName,
    signer_email: shared.recipientEmail,
    intent_text: intentText,
    signed_at: signedAt,
    user_agent: userAgent,
    method: "portal",
    send_id: shared.id,
    signature_text: signatureText,
    ip_address: ip,
    content_hash: contentHash,
  });
  if (signatureError) {
    await admin
      .from("document_versions")
      .update({ status: "draft", locked_at: null, snapshot: null })
      .eq("id", shared.versionId);
    return { error: "Couldn't record your signature. Please try again." };
  }

  await Promise.all([
    admin.from("documents").update({ status: "signed" }).eq("id", shared.documentId),
    admin.from("document_feedback").insert({
      organization_id: shared.organizationId,
      document_id: shared.documentId,
      document_version_id: shared.versionId,
      send_id: shared.id,
      kind: "signed",
      author_type: "client",
      author_name: signerName,
      author_email: shared.recipientEmail,
      body: intentText,
    }),
    admin.from("activities").insert({
      organization_id: shared.organizationId,
      actor_id: null,
      verb: "signed",
      entity_type: "document",
      entity_id: shared.documentId,
      metadata: {
        version_id: shared.versionId,
        send_id: shared.id,
        signer_name: signerName,
        signer_email: shared.recipientEmail,
        method: "portal",
      },
    }),
  ]);

  await notify({
    recipients: [shared.sentBy],
    organizationId: shared.organizationId,
    orgName: shared.orgName,
    category: "clients",
    title: `${signerName} signed ${shared.title}`,
    body: `Signed by ${signerName} (${shared.recipientEmail}). This version is now locked.`,
    href: shared.orgSlug ? `/${shared.orgSlug}/documents/${shared.documentId}` : null,
    entity: { type: "document", id: shared.documentId },
    actionLabel: "Open document",
    email: true,
  });

  if (isEmailConfigured()) {
    const viewUrl = `${getAppUrl()}${documentViewPath(token)}`;
    const input = {
      orgName: shared.orgName,
      heading: `You signed ${shared.title}`,
      message: `Thanks, ${signerName.split(/\s+/)[0]}. Your signature has been recorded and ${shared.orgName} has been notified. You can view or print the signed copy any time from the link below.`,
      viewUrl,
      buttonLabel: "View signed copy",
      rows: [
        { label: "Signed by", value: `${signerName} (${shared.recipientEmail})` },
        { label: "Signed at", value: new Date(signedAt).toUTCString() },
        { label: "Document fingerprint", value: `${contentHash.slice(0, 16)}…` },
      ],
    };
    await sendEmail({
      to: shared.recipientEmail,
      subject: `Signed: ${shared.title}`,
      fromName: shared.orgName,
      html: documentUpdateEmailHtml(input),
      text: documentUpdateEmailText(input),
    });
  }

  revalidatePath(documentViewPath(token));
  if (shared.orgSlug) revalidatePath(`/${shared.orgSlug}/documents/${shared.documentId}`);
  return { ok: true as const };
}
