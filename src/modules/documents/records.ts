import type { JSONContent } from "@tiptap/core";
import { docToPlainText } from "@/components/editor/doc-text";
import { proseFromDoc, proseToDoc } from "@/modules/documents/prose";
import { buildLiveSnapshot } from "@/modules/documents/lock";
import { documentSendToken, documentViewPath } from "@/modules/documents/sends";
import { buildBasicDocumentTemplate } from "@/modules/documents/templates";
import { asDocumentKind, DOCUMENT_KIND_LABEL } from "@/modules/documents/types";
import { resolveSender } from "@/modules/email-senders/server";
import { sendTrackedApplicationEmail } from "@/modules/emails/application-send";
import type { OrgContext } from "@/modules/identity/org";
import { assertWrite, type WriteResult } from "@/modules/records/mutate";
import { hashShareToken } from "@/modules/portal/token";
import {
  documentEmailHtml,
  documentEmailText,
  getAppUrl,
} from "@/shared/email";
import { mailPixelUrl } from "@/shared/email/pixel";

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

type VersionRow = {
  id: string;
  document_id: string;
  status: string;
  locked_at: string | null;
  content_doc: JSONContent;
  version_number: number;
};

function fillText(text: string, replacements: Map<string, string>) {
  let next = text;
  for (const [label, value] of replacements) {
    next = next.replaceAll(`[${label}]`, value);
  }
  return next;
}

function fillNode(node: JSONContent, replacements: Map<string, string>): JSONContent {
  if (node.type === "text" && typeof node.text === "string") {
    const text = fillText(node.text, replacements);
    if (text === node.text) return node;
    const marks = (node.marks ?? []).filter((mark) => mark.type !== "highlight");
    return marks.length > 0 ? { ...node, text, marks } : { type: "text", text };
  }
  if (!node.content) return node;
  return { ...node, content: node.content.map((child) => fillNode(child, replacements)) };
}

export function parseDocumentFills(body: string) {
  const replacements = new Map<string, string>();
  for (const line of body.split("\n")) {
    const split = line.indexOf(":");
    if (split < 1) continue;
    const label = line.slice(0, split).trim().replace(/^\[/, "").replace(/\]$/, "");
    const value = line.slice(split + 1).trim();
    if (label && value) replacements.set(label, value);
  }
  return replacements;
}

async function latestVersion(ctx: OrgContext, documentId: string) {
  const { data, error } = await ctx.supabase
    .from("document_versions")
    .select("id, document_id, status, locked_at, content_doc, version_number")
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Document has no version" };
  return { version: data as VersionRow };
}

/** Replaces a draft with the supplied text. Returns the text that was stored. */
export async function writeDocumentRecord(
  ctx: OrgContext,
  input: { id: string; body: string; title?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "documents");
  if (blocked) return blocked;
  const supplied = input.body.trim();
  if (!supplied) return { error: "The document text is required." };
  const loaded = await latestVersion(ctx, input.id);
  if ("error" in loaded) return loaded;
  const version = loaded.version;
  if (version.locked_at || version.status === "signed" || version.status === "accepted") {
    return { error: "Signed or accepted versions cannot be edited." };
  }
  if (version.status === "sent") {
    return { error: "This version was already sent. Start a new revision before changing it." };
  }
  const content = proseToDoc(supplied);
  const text = proseFromDoc(content);
  const { error } = await ctx.supabase
    .from("document_versions")
    .update({ content_doc: content })
    .eq("id", version.id)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  if (input.title?.trim()) {
    await ctx.supabase
      .from("documents")
      .update({ title: input.title.trim() })
      .eq("id", input.id)
      .eq("organization_id", ctx.org.id);
  }
  return { id: input.id, versionId: version.id, text };
}

export async function fillDocumentRecord(
  ctx: OrgContext,
  input: { id: string; body: string; title?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "documents");
  if (blocked) return blocked;
  const replacements = parseDocumentFills(input.body);
  if (replacements.size === 0) {
    return { error: "Pass one placeholder per line, such as Client name: Rentique." };
  }
  const loaded = await latestVersion(ctx, input.id);
  if ("error" in loaded) return loaded;
  const version = loaded.version;
  if (version.locked_at || version.status === "signed" || version.status === "accepted") {
    return { error: "Signed or accepted versions cannot be edited." };
  }
  if (version.status === "sent") {
    return { error: "This version was already sent. Start a new revision before changing it." };
  }
  const content = fillNode((version.content_doc ?? { type: "doc" }) as JSONContent, replacements);
  const { error } = await ctx.supabase
    .from("document_versions")
    .update({ content_doc: content })
    .eq("id", version.id)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  if (input.title?.trim()) {
    await ctx.supabase
      .from("documents")
      .update({ title: input.title.trim() })
      .eq("id", input.id)
      .eq("organization_id", ctx.org.id);
  }
  return {
    id: input.id,
    versionId: version.id,
    filled: [...replacements.keys()],
    text: docToPlainText(content),
  };
}

export async function linkDocumentRecord(
  ctx: OrgContext,
  input: { id: string; clientId?: string; projectId?: string },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "documents");
  if (blocked) return blocked;
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, status, client_id, project_id")
    .eq("id", input.id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };
  if (document.status === "accepted" || document.status === "signed") {
    return { error: "Locked documents cannot change links" };
  }

  let clientId = input.clientId?.trim() || document.client_id;
  let projectId = input.projectId?.trim() || null;
  let clientName: string | null = null;
  let projectName: string | null = null;
  if (input.projectId?.trim()) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("id, name, client_id")
      .eq("id", input.projectId.trim())
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!project) return { error: "Project not found" };
    projectId = project.id as string;
    projectName = project.name as string;
    clientId = project.client_id as string;
  }
  if (clientId) {
    const { data: client } = await ctx.supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!client) return { error: "Client not found" };
    clientName = client.name as string;
  }

  const { error } = await ctx.supabase
    .from("documents")
    .update({ client_id: clientId, project_id: projectId })
    .eq("id", input.id)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  const fills = new Map<string, string>();
  if (clientName) fills.set("Client name", clientName);
  if (projectName) fills.set("Project name", projectName);
  if (fills.size > 0) {
    const loaded = await latestVersion(ctx, input.id);
    if (!("error" in loaded) && loaded.version.status === "draft" && !loaded.version.locked_at) {
      const content = fillNode(loaded.version.content_doc, fills);
      await ctx.supabase
        .from("document_versions")
        .update({ content_doc: content })
        .eq("id", loaded.version.id)
        .eq("organization_id", ctx.org.id);
    }
  }
  return { id: input.id, clientId, projectId, clientName, projectName };
}

export async function createSowRecord(ctx: OrgContext, documentId: string): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "documents");
  if (blocked) return blocked;
  const { data: source } = await ctx.supabase
    .from("documents")
    .select("id, title, client_id, project_id, kind")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!source) return { error: "Document not found" };
  if (source.kind !== "proposal") return { error: "An SOW can only be created from a proposal" };

  const [{ data: client }, { data: project }] = await Promise.all([
    source.client_id
      ? ctx.supabase.from("clients").select("id, name").eq("organization_id", ctx.org.id).eq("id", source.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    source.project_id
      ? ctx.supabase.from("projects").select("id, name").eq("organization_id", ctx.org.id).eq("id", source.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const sowTitle = `SOW · ${source.title}`;
  const sowDoc = buildBasicDocumentTemplate({
    kind: "sow",
    title: sowTitle,
    orgName: ctx.org.name,
    client: client ? { id: client.id as string, label: client.name as string, type: "client" } : null,
    project: project ? { id: project.id as string, label: project.name as string, type: "project" } : null,
  });
  const { data: sow, error } = await ctx.supabase
    .from("documents")
    .insert({
      organization_id: ctx.org.id,
      title: sowTitle,
      kind: "sow",
      status: "draft",
      client_id: source.client_id,
      project_id: source.project_id,
      source_document_id: source.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !sow) return { error: error?.message ?? "Could not create SOW" };
  await ctx.supabase.from("document_versions").insert({
    organization_id: ctx.org.id,
    document_id: sow.id,
    version_number: 1,
    content_doc: sowDoc,
    status: "draft",
    created_by: ctx.userId,
  });
  return { id: sow.id as string, title: sowTitle, status: "draft" };
}

/** Emails the current version and marks it sent only after the email is accepted. */
export async function deliverDocumentEmail(
  ctx: OrgContext,
  input: {
    documentId: string;
    to: string;
    recipientName?: string | null;
    cc?: string[];
    subject: string;
    message: string;
    trackOpens?: boolean;
    versionId?: string | null;
    content: JSONContent;
    sourceDoc?: Record<string, unknown> | null;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  },
): Promise<WriteResult> {
  const blocked = assertWrite(ctx, "documents");
  if (blocked) return blocked;
  const sender = await resolveSender(ctx.org.id, ctx.userId);
  if (!sender.via) {
    return { error: "Email sending isn't set up. An owner or admin can connect the studio's mailbox in Settings." };
  }
  const to = input.to.trim().toLowerCase();
  const cc = [...new Set((input.cc ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (!EMAIL_PATTERN.test(to)) return { error: "Enter a valid recipient email" };
  const badCc = cc.find((value) => !EMAIL_PATTERN.test(value));
  if (badCc) return { error: `"${badCc}" isn't a valid email` };
  if (!input.subject.trim()) return { error: "Subject is required" };
  if (!input.message.trim()) return { error: "Write a short message" };
  if (input.content?.type !== "doc") return { error: "Couldn't read the document content" };

  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, title, kind, status")
    .eq("id", input.documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };

  const sendId = crypto.randomUUID();
  const token = documentSendToken(sendId);
  const { data: send, error: insertError } = await ctx.supabase
    .from("document_sends")
    .insert({
      id: sendId,
      organization_id: ctx.org.id,
      document_id: input.documentId,
      document_version_id: input.versionId ?? null,
      token_hash: hashShareToken(token),
      title: document.title as string,
      recipient_email: to,
      recipient_name: input.recipientName?.trim() || null,
      cc,
      subject: input.subject.trim().slice(0, 200),
      message: input.message.trim().slice(0, 5000),
      content_doc: input.content,
      track_opens: input.trackOpens !== false,
      sent_by: ctx.userId,
    })
    .select("id")
    .single();
  if (insertError || !send) return { error: insertError?.message ?? "Couldn't prepare the email" };

  const viewUrl = `${getAppUrl()}${documentViewPath(token)}`;
  const emailInput = {
    orgName: ctx.org.name,
    senderName: ctx.user.displayName,
    kindLabel: DOCUMENT_KIND_LABEL[asDocumentKind(String(document.kind ?? ""))],
    title: document.title as string,
    message: input.message.trim(),
    viewUrl,
    pixelUrl: input.trackOpens === false ? null : mailPixelUrl(token),
  };
  const mailed = await sendTrackedApplicationEmail(
    ctx.supabase,
    { organizationId: ctx.org.id, userId: ctx.userId },
    {
      to,
      cc,
      subject: input.subject.trim(),
      fromName: `${ctx.user.displayName ? `${ctx.user.displayName} at ` : ""}${ctx.org.name}`,
      replyTo: ctx.user.email ?? undefined,
      html: documentEmailHtml(emailInput),
      text: documentEmailText(emailInput),
      smtp: sender.smtp,
      attachments: input.attachments,
    },
  );
  if (!mailed.ok) {
    await ctx.supabase.from("document_sends").delete().eq("id", send.id);
    return { error: mailed.error };
  }

  if (input.versionId) {
    await ctx.supabase
      .from("document_versions")
      .update({
        ...(input.sourceDoc ? { content_doc: input.sourceDoc } : {}),
        status: "sent",
        snapshot: buildLiveSnapshot({
          contentDoc: input.content as Record<string, unknown>,
          frozenAt: new Date().toISOString(),
        }),
      })
      .eq("id", input.versionId)
      .eq("organization_id", ctx.org.id)
      .eq("status", "draft");
  }
  if (document.status === "draft") {
    await ctx.supabase
      .from("documents")
      .update({ status: "sent" })
      .eq("id", input.documentId)
      .eq("organization_id", ctx.org.id);
  }
  return { id: send.id as string, sent: true, viewUrl, to };
}

export async function sendDocumentRecord(
  ctx: OrgContext,
  input: {
    id: string;
    to: string;
    subject: string;
    message: string;
    cc?: string;
    name?: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  },
): Promise<WriteResult> {
  const loaded = await latestVersion(ctx, input.id);
  if ("error" in loaded) return loaded;
  const version = loaded.version;
  if (version.status === "signed" || version.status === "accepted") {
    return { error: "This version is already locked. It cannot be sent for signature again." };
  }
  const text = docToPlainText(version.content_doc);
  if (/\[[^\]\n]{2,80}\]/.test(text)) {
    return { error: "This draft still has placeholders. Fill them before sending for signature." };
  }
  const cc = input.cc
    ? input.cc.split(/[,;\s]+/).map((value) => value.trim()).filter(Boolean)
    : [];
  return deliverDocumentEmail(ctx, {
    documentId: input.id,
    to: input.to,
    recipientName: input.name,
    cc,
    subject: input.subject,
    message: input.message,
    versionId: version.id,
    content: version.content_doc,
    attachments: input.attachments,
  });
}
