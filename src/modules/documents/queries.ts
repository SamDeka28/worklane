import { cache } from "react";
import { requireOrg } from "@/modules/identity/org";
import {
  FEEDBACK_COLUMNS,
  mapFeedback,
  type DocumentFeedback,
  type DocumentSend,
} from "@/modules/documents/sends";
import {
  asDocumentKind,
  type DocumentKind,
  type DocumentRecord,
  type DocumentSignature,
  type DocumentStatus,
  type DocumentVersion,
} from "@/modules/documents/types";

function asKind(value: string): DocumentKind {
  return asDocumentKind(value);
}

function asStatus(value: string): DocumentStatus {
  if (
    value === "sent" ||
    value === "accepted" ||
    value === "signed" ||
    value === "void"
  ) {
    return value;
  }
  return "draft";
}

export const listDocuments = cache(async (orgSlug: string): Promise<DocumentRecord[]> => {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("documents")
    .select(
      "id, kind, title, status, client_id, project_id, source_document_id, created_at, updated_at",
    )
    .eq("organization_id", ctx.org.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: asKind(row.kind),
    title: row.title,
    status: asStatus(row.status),
    clientId: row.client_id,
    projectId: row.project_id,
    sourceDocumentId: row.source_document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

export async function getDocument(orgSlug: string, documentId: string) {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("documents")
    .select(
      "id, kind, title, status, client_id, project_id, source_document_id, created_at, updated_at",
    )
    .eq("organization_id", ctx.org.id)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    kind: asKind(data.kind),
    title: data.title,
    status: asStatus(data.status),
    clientId: data.client_id,
    projectId: data.project_id,
    sourceDocumentId: data.source_document_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies DocumentRecord;
}

export async function listDocumentVersions(
  orgSlug: string,
  documentId: string,
): Promise<DocumentVersion[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("document_versions")
    .select(
      "id, document_id, version_number, content_doc, snapshot, status, pdf_file_id, created_at, locked_at, created_by",
    )
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    versionNumber: row.version_number,
    contentDoc: (row.content_doc as Record<string, unknown>) ?? {},
    snapshot: (row.snapshot as Record<string, unknown> | null) ?? null,
    status: asStatus(row.status),
    pdfFileId: row.pdf_file_id,
    createdAt: row.created_at,
    lockedAt: row.locked_at,
    createdBy: row.created_by,
  }));
}

export async function listSignaturesForVersion(
  orgSlug: string,
  versionId: string,
): Promise<DocumentSignature[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("document_signatures")
    .select("id, document_version_id, signer_name, signer_email, intent_text, signed_at")
    .eq("organization_id", ctx.org.id)
    .eq("document_version_id", versionId)
    .order("signed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    documentVersionId: row.document_version_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    intentText: row.intent_text,
    signedAt: row.signed_at,
  }));
}

export type DocumentRefRow = {
  entityType: "client" | "project" | "milestone" | "task";
  entityId: string;
  label: string;
};

export async function listDocumentRefs(
  orgSlug: string,
  documentId: string,
): Promise<DocumentRefRow[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("document_refs")
    .select("entity_type, entity_id")
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId);
  if (error) {
    if (/document_refs|does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const byType = {
    client: rows.filter((r) => r.entity_type === "client").map((r) => r.entity_id as string),
    project: rows.filter((r) => r.entity_type === "project").map((r) => r.entity_id as string),
    milestone: rows.filter((r) => r.entity_type === "milestone").map((r) => r.entity_id as string),
    task: rows.filter((r) => r.entity_type === "task").map((r) => r.entity_id as string),
  };

  const labels = new Map<string, string>();
  await Promise.all([
    byType.client.length
      ? ctx.supabase
          .from("clients")
          .select("id, name")
          .in("id", byType.client)
          .then(({ data: list }) => {
            for (const row of list ?? []) labels.set(`client:${row.id}`, row.name);
          })
      : null,
    byType.project.length
      ? ctx.supabase
          .from("projects")
          .select("id, name")
          .in("id", byType.project)
          .then(({ data: list }) => {
            for (const row of list ?? []) labels.set(`project:${row.id}`, row.name);
          })
      : null,
    byType.milestone.length
      ? ctx.supabase
          .from("milestones")
          .select("id, name")
          .in("id", byType.milestone)
          .then(({ data: list }) => {
            for (const row of list ?? []) labels.set(`milestone:${row.id}`, row.name);
          })
      : null,
    byType.task.length
      ? ctx.supabase
          .from("tasks")
          .select("id, title")
          .in("id", byType.task)
          .then(({ data: list }) => {
            for (const row of list ?? []) labels.set(`task:${row.id}`, row.title);
          })
      : null,
  ]);

  return rows.map((row) => {
    const entityType = row.entity_type as DocumentRefRow["entityType"];
    const entityId = row.entity_id as string;
    return {
      entityType,
      entityId,
      label: labels.get(`${entityType}:${entityId}`) ?? entityId.slice(0, 8),
    };
  });
}

/** Documents linked to a project or that mention the project / its milestones / tasks. */
export async function listDocumentsForProjectSurface(
  orgSlug: string,
  projectId: string,
): Promise<
  Array<
    DocumentRecord & {
      mentionCount: number;
      mentionedVia: "link" | "tag" | "both";
    }
  >
> {
  const ctx = await requireOrg(orgSlug);
  const linked = await listDocuments(orgSlug);
  const linkedIds = new Set(
    linked.filter((doc) => doc.projectId === projectId).map((doc) => doc.id),
  );

  const { data: milestoneRows } = await ctx.supabase
    .from("milestones")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  const { data: taskRows } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);

  const entityIds = [
    projectId,
    ...(milestoneRows ?? []).map((row) => row.id as string),
    ...(taskRows ?? []).map((row) => row.id as string),
  ];

  const { data: refRows, error } = await ctx.supabase
    .from("document_refs")
    .select("document_id, entity_type, entity_id")
    .eq("organization_id", ctx.org.id)
    .in("entity_id", entityIds);

  if (error && !/document_refs|does not exist|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }

  const mentionCounts = new Map<string, number>();
  for (const row of refRows ?? []) {
    const docId = row.document_id as string;
    mentionCounts.set(docId, (mentionCounts.get(docId) ?? 0) + 1);
  }

  const taggedIds = new Set(mentionCounts.keys());
  const allIds = new Set([...linkedIds, ...taggedIds]);
  const byId = new Map(linked.map((doc) => [doc.id, doc]));

  const missing = [...taggedIds].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const { data: extra } = await ctx.supabase
      .from("documents")
      .select(
        "id, kind, title, status, client_id, project_id, source_document_id, created_at, updated_at",
      )
      .eq("organization_id", ctx.org.id)
      .in("id", missing);
    for (const row of extra ?? []) {
      byId.set(row.id, {
        id: row.id,
        kind: asKind(row.kind),
        title: row.title,
        status: asStatus(row.status),
        clientId: row.client_id,
        projectId: row.project_id,
        sourceDocumentId: row.source_document_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  }

  return [...allIds]
    .map((id) => {
      const doc = byId.get(id);
      if (!doc) return null;
      const linkedHere = linkedIds.has(id);
      const tagged = taggedIds.has(id);
      return {
        ...doc,
        mentionCount: mentionCounts.get(id) ?? 0,
        mentionedVia: linkedHere && tagged ? "both" : linkedHere ? "link" : "tag",
      } as const;
    })
    .filter(Boolean)
    .sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt)) as Array<
    DocumentRecord & {
      mentionCount: number;
      mentionedVia: "link" | "tag" | "both";
    }
  >;
}

export async function listDocumentSends(
  orgSlug: string,
  documentId: string,
): Promise<DocumentSend[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("document_sends")
    .select(
      "id, recipient_email, recipient_name, cc, subject, sent_at, sent_by, track_opens, open_count, first_opened_at, last_opened_at, view_count, first_viewed_at, last_viewed_at, revoked_at",
    )
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId)
    .order("sent_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const senderIds = [...new Set(rows.map((row) => row.sent_by as string | null).filter(Boolean))];
  const names = new Map<string, string>();
  if (senderIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", senderIds as string[]);
    for (const profile of profiles ?? []) {
      const name = (profile.display_name as string | null) ?? (profile.email as string | null);
      if (name) names.set(profile.id as string, name);
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    recipientEmail: row.recipient_email as string,
    recipientName: (row.recipient_name as string | null) ?? null,
    cc: (row.cc as string[] | null) ?? [],
    subject: row.subject as string,
    sentAt: row.sent_at as string,
    sentByName: row.sent_by ? (names.get(row.sent_by as string) ?? null) : null,
    trackOpens: Boolean(row.track_opens),
    openCount: Number(row.open_count ?? 0),
    firstOpenedAt: (row.first_opened_at as string | null) ?? null,
    lastOpenedAt: (row.last_opened_at as string | null) ?? null,
    viewCount: Number(row.view_count ?? 0),
    firstViewedAt: (row.first_viewed_at as string | null) ?? null,
    lastViewedAt: (row.last_viewed_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
  }));
}

export async function listDocumentFeedback(
  orgSlug: string,
  documentId: string,
): Promise<DocumentFeedback[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("document_feedback")
    .select(FEEDBACK_COLUMNS)
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapFeedback(row as Record<string, unknown>));
}
