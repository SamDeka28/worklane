import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadStoredFile } from "@/modules/files/store";
import type { OrgContext } from "@/modules/identity/org";

const MAX_BYTES = 4 * 1024 * 1024;
const SIGNED_SECONDS = 60 * 60;
const ASSET_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

export async function uploadDocumentAsset(
  ctx: OrgContext,
  input: { documentId: string; filename: string; contentType: string; contentBase64: string },
): Promise<{ id: string; name: string; url: string; contentType: string } | { error: string }> {
  const documentId = input.documentId.trim();
  if (!documentId) return { error: "Pass the document id." };
  const contentType = input.contentType.trim().toLowerCase();
  if (!ASSET_TYPES.has(contentType)) {
    return { error: "Upload png, jpeg, webp, gif, or svg." };
  }
  const decoded = decodeAsset(input.contentBase64);
  if ("error" in decoded) return decoded;
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };

  const stored = await uploadStoredFile(ctx, {
    entityType: "document",
    entityId: documentId,
    name: input.filename,
    mime: contentType,
    bytes: decoded.bytes,
  });
  if ("error" in stored) return stored;
  if (!stored.url) return { error: "The file was saved, but no link could be created." };
  return { id: stored.id, name: stored.name, url: stored.url, contentType };
}

function decodeAsset(raw: string): { bytes: Uint8Array } | { error: string } {
  const cleaned = raw.replace(/\s/g, "");
  if (!cleaned || cleaned.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) {
    return { error: "The file must be base64 and under 4 MB." };
  }
  const bytes = Buffer.from(cleaned, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return { error: "The file must be under 4 MB." };
  }
  return { bytes: new Uint8Array(bytes) };
}

/** Replace stored file ids with a fresh signed URL so images keep showing after the first link expires. */
export async function refreshDocumentFileUrls(
  client: SupabaseClient,
  doc: JSONContent,
  organizationId?: string,
): Promise<JSONContent> {
  const ids = new Set<string>();
  collectFileIds(doc, ids);
  if (ids.size === 0) return doc;
  let query = client.from("files").select("id, storage_path").in("id", [...ids]).is("deleted_at", null);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data } = await query;
  const urls = new Map<string, string>();
  for (const row of data ?? []) {
    const path = row.storage_path as string;
    const { data: signed } = await client.storage.from("org-files").createSignedUrl(path, SIGNED_SECONDS);
    if (signed?.signedUrl) urls.set(row.id as string, signed.signedUrl);
  }
  if (urls.size === 0) return doc;
  return mapFileUrls(doc, urls);
}

function collectFileIds(node: JSONContent, ids: Set<string>) {
  const fileId = node.attrs?.fileId;
  if (typeof fileId === "string" && fileId) ids.add(fileId);
  node.content?.forEach((child) => collectFileIds(child, ids));
}

function mapFileUrls(node: JSONContent, urls: Map<string, string>): JSONContent {
  const fileId = typeof node.attrs?.fileId === "string" ? node.attrs.fileId : "";
  const src = fileId ? urls.get(fileId) : undefined;
  return {
    ...node,
    attrs: src ? { ...node.attrs, src } : node.attrs,
    content: node.content?.map((child) => mapFileUrls(child, urls)),
  };
}
