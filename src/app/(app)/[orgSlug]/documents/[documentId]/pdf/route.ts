import { requireOrg } from "@/modules/identity/org";
import { documentPdfFilename, renderDocumentPdfBuffer } from "@/modules/documents/pdf";
import { buildSignedDocumentFiles, signedContentFor } from "@/modules/documents/signed-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; documentId: string }> },
) {
  const { orgSlug, documentId } = await params;
  const ctx = await requireOrg(orgSlug);
  const url = new URL(request.url);
  const versionId = url.searchParams.get("version");
  const part = url.searchParams.get("part") === "certificate" ? "certificate" : "document";
  if (!versionId) return new Response("Missing version", { status: 400 });

  const [{ data: document }, { data: version }] = await Promise.all([
    ctx.supabase
      .from("documents")
      .select("title, clients(name)")
      .eq("id", documentId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
    ctx.supabase
      .from("document_versions")
      .select("id, content_doc, version_number")
      .eq("id", versionId)
      .eq("document_id", documentId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle(),
  ]);
  if (!document || !version) return new Response("Not found", { status: 404 });
  const clientRef = document.clients as { name: string } | { name: string }[] | null;
  const clientName = (Array.isArray(clientRef) ? clientRef[0]?.name : clientRef?.name) ?? null;

  const { content } = await signedContentFor(ctx.supabase, versionId);
  const built = await buildSignedDocumentFiles(ctx.supabase, {
    versionId,
    title: document.title,
    orgName: ctx.org.name,
    clientName,
    content: content ?? version.content_doc,
  });

  let file = built.files[0];
  if (part === "certificate") {
    file = built.files[1] ?? {
      filename: documentPdfFilename(document.title, "signature-certificate"),
      content: await renderDocumentPdfBuffer({
        title: document.title,
        orgName: ctx.org.name,
        clientName,
        versionNumber: version.version_number,
        content: { type: "doc", content: [] },
        signatures: built.signatures,
        certificateOnly: true,
      }),
      contentType: "application/pdf",
    };
  } else if (built.signatures.length === 0) {
    file = { ...file, filename: documentPdfFilename(document.title, `v${version.version_number}`) };
  }

  return new Response(new Uint8Array(file.content), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${file.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
