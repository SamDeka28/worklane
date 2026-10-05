import { documentPreviewUrl, documentWarnings } from "@/modules/documents/structured";
import type { JSONContent } from "@tiptap/core";
import type { OrgContext } from "@/modules/identity/org";
import { canAccessModule } from "@/modules/identity/permissions";

export async function readDocumentForContext(ctx: OrgContext, id: string) {
  if (!ctx.org.modules.documents || !canAccessModule(ctx.permissions, "documents")) {
    return { error: "You don't have access to documents in this studio." };
  }
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id, title, kind, status, client_id, project_id, lead_id, updated_at")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };

  const { data: version } = await ctx.supabase
    .from("document_versions")
    .select("id, version_number, status, locked_at, content_doc")
    .eq("organization_id", ctx.org.id)
    .eq("document_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: sends }, { data: signatures }] = await Promise.all([
    ctx.supabase
      .from("document_sends")
      .select("id, recipient_email, recipient_name, cc, sent_at, open_count, first_opened_at, revoked_at")
      .eq("organization_id", ctx.org.id)
      .eq("document_id", id)
      .order("sent_at", { ascending: false })
      .limit(8),
    version
      ? ctx.supabase
          .from("document_signatures")
          .select("signer_name, signer_email, signed_at, method")
          .eq("organization_id", ctx.org.id)
          .eq("document_version_id", version.id)
          .order("signed_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const versionNumber = version ? Number(version.version_number) : null;
  const previewUrl = documentPreviewUrl(ctx.org.slug, document.id as string, versionNumber);
  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    status: document.status,
    clientId: document.client_id,
    projectId: document.project_id,
    leadId: document.lead_id,
    previewUrl,
    pdfUrl: previewUrl,
    validation: documentWarnings((version?.content_doc as JSONContent) ?? { type: "doc", content: [] }, {
      title: document.title as string,
      clientId: (document.client_id as string | null) ?? null,
      projectId: (document.project_id as string | null) ?? null,
      leadId: (document.lead_id as string | null) ?? null,
    }),
    version: version
      ? {
          id: version.id,
          number: version.version_number,
          status: version.status,
          locked: Boolean(version.locked_at),
        }
      : null,
    sends: (sends ?? []).map((row) => ({
      id: row.id,
      to: row.recipient_email,
      name: row.recipient_name,
      cc: row.cc ?? [],
      sentAt: row.sent_at,
      opened: Number(row.open_count ?? 0) > 0,
      openCount: row.open_count ?? 0,
      firstOpenedAt: row.first_opened_at,
      revoked: Boolean(row.revoked_at),
    })),
    signatures: (signatures ?? []).map((row) => ({
      name: row.signer_name,
      email: row.signer_email,
      signedAt: row.signed_at,
      party: row.method === "portal" ? "client" : "studio",
    })),
  };
}
