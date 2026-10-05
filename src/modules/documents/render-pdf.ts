import type { JSONContent } from "@tiptap/core";
import { documentPdfFilename } from "@/modules/documents/pdf";
import { buildSignedDocumentFiles, signedContentFor } from "@/modules/documents/signed-pdf";
import type { OrgContext } from "@/modules/identity/org";

export async function renderStoredDocumentPdf(
  ctx: OrgContext,
  input: { documentId: string; versionNumber?: number | null; versionId?: string | null },
): Promise<
  | { error: string; status: number }
  | { filename: string; content: Buffer; versionNumber: number; versionId: string; contentDoc: JSONContent }
> {
  const versionQuery = ctx.supabase
    .from("document_versions")
    .select("id, content_doc, version_number, status")
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
      .select("title, clients(name)")
      .eq("id", input.documentId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
    versionRequest,
  ]);
  if (!document || !version) return { error: "Document not found", status: 404 };

  const clientRef = document.clients as { name: string } | { name: string }[] | null;
  const clientName = (Array.isArray(clientRef) ? clientRef[0]?.name : clientRef?.name) ?? null;
  const versionId = version.id as string;
  const { content } = await signedContentFor(ctx.supabase, versionId);
  const contentDoc = ((content ?? version.content_doc) as JSONContent) ?? { type: "doc", content: [] };
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
