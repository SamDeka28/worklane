import type { JSONContent } from "@tiptap/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadStoredFile } from "@/modules/files/store";
import type { OrgContext } from "@/modules/identity/org";

const MAX_BYTES = 4 * 1024 * 1024;
const SIGNED_SECONDS = 60 * 60;
const ASSET_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

export type DocumentAsset = {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
};

type AssetRow = {
  id: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  storage_path: string;
  organization_id?: string;
};

export async function uploadDocumentAsset(
  ctx: OrgContext,
  input: {
    documentId: string;
    filename: string;
    contentType: string;
    contentBase64: string;
    alt?: string;
    metadata?: unknown;
  },
): Promise<(DocumentAsset & { metadata?: unknown }) | { error: string }> {
  const documentId = input.documentId.trim();
  if (!documentId) return { error: "Pass the document id." };
  const prepared = prepareAssetBytes({
    filename: input.filename,
    mimeType: input.contentType,
    contentBase64: input.contentBase64,
  });
  if ("error" in prepared) return prepared;
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
    name: prepared.filename,
    mime: prepared.mimeType,
    bytes: prepared.bytes,
  });
  if ("error" in stored) return stored;
  return assetResult(stored, prepared, input.alt, input.metadata);
}

export async function getDocumentAsset(ctx: OrgContext, fileId: string): Promise<DocumentAsset | { error: string }> {
  const row = await assetRow(ctx, fileId);
  if ("error" in row) return row;
  return presentAsset(ctx, row);
}

export async function listDocumentAssets(ctx: OrgContext, documentId: string): Promise<{ assets: DocumentAsset[] } | { error: string }> {
  const id = documentId.trim();
  if (!id) return { error: "Pass the document id." };
  const { data: document } = await ctx.supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!document) return { error: "Document not found" };
  const { data, error } = await ctx.supabase
    .from("files")
    .select("id, name, mime, size_bytes, storage_path")
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", "document")
    .eq("entity_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  const assets: DocumentAsset[] = [];
  for (const row of data ?? []) assets.push(await presentAsset(ctx, row as AssetRow));
  return { assets };
}

export async function deleteDocumentAsset(ctx: OrgContext, fileId: string): Promise<{ fileId: string; deleted: true } | { error: string }> {
  const row = await assetRow(ctx, fileId);
  if ("error" in row) return row;
  const { error } = await ctx.supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  return { fileId: row.id, deleted: true };
}

/** Reject image blocks whose fileId is missing from this studio. */
export async function assertDocumentImageAssets(
  ctx: OrgContext,
  doc: JSONContent,
): Promise<{ error: string } | null> {
  const ids = imageAssetIds(doc);
  if (ids.length === 0) return null;
  const { data, error } = await ctx.supabase
    .from("files")
    .select("id, mime")
    .in("id", ids)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  const found = new Map((data ?? []).map((row) => [row.id as string, String(row.mime ?? "")]));
  return missingDocumentAssets(ids, found);
}

export function imageAssetIds(doc: JSONContent): string[] {
  const ids = new Set<string>();
  const walk = (node: JSONContent) => {
    if (node.type === "image" && typeof node.attrs?.fileId === "string" && node.attrs.fileId) ids.add(node.attrs.fileId);
    node.content?.forEach(walk);
  };
  walk(doc);
  return [...ids];
}

export function missingDocumentAssets(ids: string[], found: Map<string, string>): { error: string } | null {
  for (const id of ids) {
    const mime = found.get(id);
    if (!mime) {
      return { error: `Asset ${id} does not exist in this studio. Upload the asset first using upload_asset. Use the returned fileId in compose_document image blocks. Do not invent fileIds.` };
    }
    if (!ASSET_TYPES.has(mime)) {
      return { error: `Asset ${id} is not an image this document can place.` };
    }
  }
  return null;
}

/** Drop a temporary signed URL before the document is saved. The fileId is the reference. */
export function persistDocumentAssets(doc: JSONContent): JSONContent {
  const fileId = typeof doc.attrs?.fileId === "string" ? doc.attrs.fileId : "";
  return {
    ...doc,
    attrs: fileId ? { ...doc.attrs, src: null } : doc.attrs,
    content: doc.content?.map(persistDocumentAssets),
  };
}

export function applySignedAssetUrls(doc: JSONContent, urls: Map<string, string>): JSONContent {
  const fileId = typeof doc.attrs?.fileId === "string" ? doc.attrs.fileId : "";
  const src = fileId ? urls.get(fileId) : undefined;
  return {
    ...doc,
    attrs: src ? { ...doc.attrs, src } : doc.attrs,
    content: doc.content?.map((child) => applySignedAssetUrls(child, urls)),
  };
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
  return applySignedAssetUrls(doc, urls);
}

export function prepareAssetBytes(input: {
  filename: string;
  mimeType: string;
  contentBase64: string;
}): { bytes: Uint8Array; filename: string; mimeType: string; size: number; width: number | null; height: number | null } | { error: string } {
  const unwrapped = unwrapPayload(input.contentBase64, input.mimeType);
  if ("error" in unwrapped) return unwrapped;
  const mimeType = canonicalMime(unwrapped.mimeType);
  if (!ASSET_TYPES.has(mimeType)) return { error: "Upload png, jpeg, webp, gif, or svg." };
  const decoded = decodeAsset(unwrapped.base64);
  if ("error" in decoded) return decoded;
  if (isExecutable(decoded.bytes)) return { error: "That file is not an image." };
  const detected = detectedMime(decoded.bytes);
  if (detected !== mimeType) return { error: "The file contents do not match mimeType." };
  if (mimeType === "image/svg+xml" && svgUnsafe(decoded.bytes)) return { error: "SVG images cannot contain scripts." };
  const size = imageSize(decoded.bytes, mimeType);
  const filename = input.filename.trim().slice(0, 180) || "image";
  return { bytes: decoded.bytes, filename, mimeType, size: decoded.bytes.byteLength, width: size?.width ?? null, height: size?.height ?? null };
}

function assetResult(
  stored: { id: string; name: string; url: string | null },
  prepared: { mimeType: string; size: number; width: number | null; height: number | null },
  alt: string | undefined,
  metadata: unknown,
): DocumentAsset & { metadata?: unknown } {
  return {
    fileId: stored.id,
    filename: stored.name,
    mimeType: prepared.mimeType,
    size: prepared.size,
    url: stored.url,
    width: prepared.width,
    height: prepared.height,
    alt: alt?.trim() ? alt.trim().slice(0, 180) : null,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

async function assetRow(ctx: OrgContext, fileId: string): Promise<AssetRow | { error: string }> {
  const id = fileId.trim();
  if (!id) return { error: "Pass the fileId from upload_asset." };
  const { data, error } = await ctx.supabase
    .from("files")
    .select("id, name, mime, size_bytes, storage_path")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That asset does not exist in this studio." };
  return data as AssetRow;
}

async function presentAsset(ctx: OrgContext, row: AssetRow): Promise<DocumentAsset> {
  const { data: signed } = await ctx.supabase.storage.from("org-files").createSignedUrl(row.storage_path, SIGNED_SECONDS);
  return {
    fileId: row.id,
    filename: row.name,
    mimeType: row.mime ?? "",
    size: Number(row.size_bytes ?? 0),
    url: signed?.signedUrl ?? null,
    width: null,
    height: null,
    alt: null,
  };
}

function collectFileIds(node: JSONContent, ids: Set<string>) {
  const fileId = node.attrs?.fileId;
  if (typeof fileId === "string" && fileId) ids.add(fileId);
  node.content?.forEach((child) => collectFileIds(child, ids));
}

function canonicalMime(value: string) {
  const mime = value.trim().toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

function unwrapPayload(raw: string, mimeType: string): { base64: string; mimeType: string } | { error: string } {
  const trimmed = raw.trim();
  const data = trimmed.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (data) return { mimeType: mimeType.trim() || data[1], base64: data[2] };
  if (!mimeType.trim()) return { error: "Pass mimeType." };
  return { mimeType, base64: trimmed };
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

function isExecutable(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
  return false;
}

function detectedMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  const gif = ascii(bytes, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  const head = new TextDecoder().decode(bytes.slice(0, 240)).trim().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

function svgUnsafe(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes).toLowerCase();
  return /<script\b|javascript:|\bon[a-z]+\s*=/.test(text);
}

function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
  }
  if (mime === "image/gif" && bytes.length >= 10) {
    return { width: bytes[6] + (bytes[7] << 8), height: bytes[8] + (bytes[9] << 8) };
  }
  if (mime === "image/webp" && ascii(bytes, 12, 4) === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (mime === "image/jpeg") return jpegSize(bytes);
  if (mime === "image/svg+xml") return svgSize(new TextDecoder().decode(bytes));
  return null;
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

function svgSize(text: string): { width: number; height: number } | null {
  const width = text.match(/\bwidth=["']([\d.]+)/i);
  const height = text.match(/\bheight=["']([\d.]+)/i);
  if (width && height) return { width: Math.round(Number(width[1])), height: Math.round(Number(height[1])) };
  const view = text.match(/viewBox=["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/i);
  if (!view) return null;
  return { width: Math.round(Number(view[1])), height: Math.round(Number(view[2])) };
}

function uint32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 24) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}
