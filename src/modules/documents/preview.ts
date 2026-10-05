import type { JSONContent } from "@tiptap/core";
import { documentsOnProject } from "@/modules/documents/queries";
import { proseFromDoc } from "@/modules/documents/prose";
import { documentPreviewUrl, documentWarnings } from "@/modules/documents/structured";
import type { OrgContext } from "@/modules/identity/org";
import { previewDocumentText } from "@/modules/records/mutate";

const ONE_LIMIT = 20_000;
const LIST_LIMIT = 4_000;
const LIST_CAP = 20;

function previewLinks(ctx: OrgContext, documentId: string, version: number | null) {
  const previewUrl = documentPreviewUrl(ctx.org.slug, documentId, version);
  return { previewUrl, pdfUrl: previewUrl };
}

function clip(text: string, max: number) {
  if (text.length <= max) return { text, truncated: false };
  return { text: `${text.slice(0, max)}\n…`, truncated: true };
}

async function versionText(ctx: OrgContext, documentIds: string[]) {
  const text = new Map<string, { body: string; version: number; content: JSONContent }>();
  if (documentIds.length === 0) return text;
  const { data } = await ctx.supabase
    .from("document_versions")
    .select("document_id, version_number, content_doc")
    .eq("organization_id", ctx.org.id)
    .in("document_id", documentIds)
    .order("version_number", { ascending: false });
  for (const row of data ?? []) {
    const id = row.document_id as string;
    if (text.has(id)) continue;
    const content = (row.content_doc as JSONContent) ?? { type: "doc", content: [] };
    text.set(id, {
      version: Number(row.version_number),
      body: proseFromDoc(content),
      content,
    });
  }
  return text;
}

async function namesFor(ctx: OrgContext, clientId: string | null, projectId: string | null) {
  const [client, project] = await Promise.all([
    clientId
      ? ctx.supabase.from("clients").select("name").eq("organization_id", ctx.org.id).eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    projectId
      ? ctx.supabase.from("projects").select("name").eq("organization_id", ctx.org.id).eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    clientName: (client.data?.name as string | undefined) ?? null,
    projectName: (project.data?.name as string | undefined) ?? null,
  };
}

async function previewOne(ctx: OrgContext, id: string) {
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, title, kind, status, client_id, project_id, lead_id")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };
  const versions = await versionText(ctx, [document.id as string]);
  const version = versions.get(document.id as string);
  const names = await namesFor(
    ctx,
    (document.client_id as string | null) ?? null,
    (document.project_id as string | null) ?? null,
  );
  const body = clip(version?.body ?? "", ONE_LIMIT);
  const versionNumber = version?.version ?? null;
  return {
    id: document.id as string,
    title: document.title as string,
    kind: document.kind as string,
    status: document.status as string,
    version: versionNumber,
    ...names,
    ...previewLinks(ctx, document.id as string, versionNumber),
    leadId: (document.lead_id as string | null) ?? null,
    validation: documentWarnings(version?.content ?? { type: "doc", content: [] }, {
      title: document.title as string,
      clientId: (document.client_id as string | null) ?? null,
      projectId: (document.project_id as string | null) ?? null,
      leadId: (document.lead_id as string | null) ?? null,
    }),
    text: body.text,
    truncated: body.truncated,
  };
}

async function previewProject(ctx: OrgContext, projectId: string) {
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("organization_id", ctx.org.id)
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found" };
  const documents = await documentsOnProject(ctx, projectId);
  if ("error" in documents) return documents;
  const shown = documents.slice(0, LIST_CAP);
  const versions = await versionText(ctx, shown.map((doc) => doc.id));
  const { data: files } = await ctx.supabase
    .from("files")
    .select("id, name, mime, size_bytes")
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);
  return {
    projectId: project.id as string,
    projectName: project.name as string,
    documents: shown.map((doc) => {
      const body = clip(versions.get(doc.id)?.body ?? "", LIST_LIMIT);
      return {
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        status: doc.status,
        version: versions.get(doc.id)?.version ?? null,
        linkedBy: doc.mentionedVia === "client" ? "client" : doc.projectId === projectId ? "project" : "mention",
        ...previewLinks(ctx, doc.id, versions.get(doc.id)?.version ?? null),
        text: body.text,
        truncated: body.truncated,
      };
    }),
    documentsTruncated: documents.length > shown.length,
    files: (files ?? []).map((file) => ({
      id: file.id as string,
      name: file.name as string,
      mime: (file.mime as string | null) ?? null,
      sizeBytes: file.size_bytes == null ? null : Number(file.size_bytes),
    })),
  };
}

async function previewClient(ctx: OrgContext, clientId: string) {
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", ctx.org.id)
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  const { data, error } = await ctx.supabase
    .from("documents")
    .select("id, title, kind, status, project_id")
    .eq("organization_id", ctx.org.id)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(LIST_CAP + 1);
  if (error) return { error: error.message };
  const rows = data ?? [];
  const shown = rows.slice(0, LIST_CAP);
  const versions = await versionText(ctx, shown.map((row) => row.id as string));
  const projectIds = [...new Set(shown.map((row) => row.project_id as string | null).filter(Boolean))] as string[];
  const projectNames = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("organization_id", ctx.org.id)
      .in("id", projectIds);
    for (const project of projects ?? []) projectNames.set(project.id as string, project.name as string);
  }
  return {
    clientId: client.id as string,
    clientName: client.name as string,
    documents: shown.map((row) => {
      const id = row.id as string;
      const projectId = (row.project_id as string | null) ?? null;
      const body = clip(versions.get(id)?.body ?? "", LIST_LIMIT);
      return {
        id,
        title: row.title as string,
        kind: row.kind as string,
        status: row.status as string,
        version: versions.get(id)?.version ?? null,
        projectId,
        projectName: projectId ? projectNames.get(projectId) ?? null : null,
        ...previewLinks(ctx, id, versions.get(id)?.version ?? null),
        text: body.text,
        truncated: body.truncated,
      };
    }),
    documentsTruncated: rows.length > shown.length,
  };
}

export async function validateDocumentForContext(ctx: OrgContext, id: string) {
  if (!ctx.org.modules.documents) return { error: "Documents are turned off for this studio." };
  const preview = await previewOne(ctx, id);
  if ("error" in preview) return preview;
  return {
    id: preview.id,
    title: preview.title,
    version: preview.version,
    status: preview.status,
    previewUrl: preview.previewUrl,
    pdfUrl: preview.pdfUrl,
    validation: preview.validation,
  };
}

/** Readable text of a saved document, a project's documents, a client's documents, or a template. */
export async function previewDocumentsForContext(
  ctx: OrgContext,
  input: { id?: string; projectId?: string; clientId?: string; title?: string; templateId?: string },
) {
  if (!ctx.org.modules.documents) return { error: "Documents are turned off for this studio." };
  if (input.id) return previewOne(ctx, input.id);
  if (input.projectId) return previewProject(ctx, input.projectId);
  if (input.clientId) return previewClient(ctx, input.clientId);
  return previewDocumentText({
    title: input.title || "Untitled",
    templateId: input.templateId,
    orgName: ctx.org.name,
  });
}
