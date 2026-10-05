import type { JSONContent } from "@tiptap/core";
import { documentPdfFilename } from "@/modules/documents/pdf";
import { resolveDocumentForPreview, type PreviewCatalog } from "@/modules/documents/resolve-preview";
import { buildSignedDocumentFiles, signedContentFor } from "@/modules/documents/signed-pdf";
import type { OrgContext } from "@/modules/identity/org";

type NameRef = { name: string } | { name: string }[] | null;

function joinedName(ref: NameRef): string | null {
  if (!ref) return null;
  return (Array.isArray(ref) ? ref[0]?.name : ref.name) ?? null;
}

/** Same expansion the editor uses in Preview, so the PDF is the saved document. */
async function previewCatalog(ctx: OrgContext, projectId: string | null): Promise<PreviewCatalog> {
  const [clients, projects, milestones, tasks] = await Promise.all([
    ctx.supabase.from("clients").select("id, name").eq("organization_id", ctx.org.id),
    ctx.supabase.from("projects").select("id, name, status, starts_on, due_on, clients(name)").eq("organization_id", ctx.org.id),
    projectId
      ? ctx.supabase.from("milestones").select("id, name, status, due_on, amount_minor").eq("project_id", projectId)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    projectId
      ? ctx.supabase.from("tasks").select("id, title, status, due_on").eq("project_id", projectId)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  return {
    currency: ctx.org.defaultCurrency,
    clients: (clients.data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
    projects: (projects.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      status: (row.status as string | null) ?? undefined,
      clientName: joinedName(row.clients as NameRef),
      startsOn: (row.starts_on as string | null) ?? null,
      dueOn: (row.due_on as string | null) ?? null,
    })),
    milestones: (milestones.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      status: row.status == null ? undefined : String(row.status),
      dueOn: (row.due_on as string | null) ?? null,
      amountMinor: (row.amount_minor as string | number | null) ?? null,
    })),
    tasks: (tasks.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: row.status == null ? undefined : String(row.status),
      dueOn: (row.due_on as string | null) ?? null,
    })),
  };
}

export async function renderStoredDocumentPdf(
  ctx: OrgContext,
  input: { documentId: string; versionNumber?: number | null; versionId?: string | null },
): Promise<
  | { error: string; status: number }
  | { filename: string; content: Buffer; versionNumber: number; versionId: string; contentDoc: JSONContent }
> {
  const versionQuery = ctx.supabase
    .from("document_versions")
    .select("id, content_doc, version_number, status, locked_at")
    .eq("document_id", input.documentId)
    .eq("organization_id", ctx.org.id);
  const versionRequest =
    input.versionId
      ? versionQuery.eq("id", input.versionId).maybeSingle()
      : input.versionNumber != null
        ? versionQuery.eq("version_number", input.versionNumber).maybeSingle()
        : versionQuery.order("version_number", { ascending: false }).limit(1).maybeSingle();

  const [{ data: document }, { data: version }] = await Promise.all([
    ctx.supabase
      .from("documents")
      .select("title, project_id, clients(name)")
      .eq("id", input.documentId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
    versionRequest,
  ]);
  if (!document || !version) return { error: "Document not found", status: 404 };

  const clientName = joinedName(document.clients as NameRef);
  const versionId = version.id as string;
  const status = version.status as string;
  const locked = Boolean(version.locked_at) || status === "signed" || status === "accepted";
  const stored = locked ? (await signedContentFor(ctx.supabase, versionId)).content : version.content_doc;
  const source = (stored as JSONContent | null) ?? { type: "doc", content: [] };
  const catalog = await previewCatalog(ctx, (document.project_id as string | null) ?? null);
  const contentDoc = resolveDocumentForPreview(source, catalog);
  try {
    const built = await buildSignedDocumentFiles(ctx.supabase, {
      versionId,
      title: document.title as string,
      orgName: ctx.org.name,
      clientName,
      content: contentDoc,
    });
    const file = built.files[0];
    if (!file) return { error: "Could not render the document.", status: 500 };
    const filename =
      built.signatures.length === 0
        ? documentPdfFilename(document.title as string, `v${version.version_number as number}`)
        : file.filename;
    return {
      filename,
      content: file.content,
      versionNumber: version.version_number as number,
      versionId,
      contentDoc,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not render the document.", status: 500 };
  }
}
