import { requireOrg } from "@/modules/identity/org";
import { renderStoredDocumentPdf } from "@/modules/documents/render-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; documentId: string }> },
) {
  const { orgSlug, documentId } = await params;
  const ctx = await requireOrg(orgSlug);
  const raw = new URL(request.url).searchParams.get("version");
  const versionNumber = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const versionId = raw && !versionNumber && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  const rendered = await renderStoredDocumentPdf(ctx, { documentId, versionNumber, versionId });
  if ("error" in rendered) return new Response(rendered.error, { status: rendered.status });

  return new Response(new Uint8Array(rendered.content), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${rendered.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
