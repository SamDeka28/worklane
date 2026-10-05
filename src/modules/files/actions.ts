"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import { listFilesForEntity } from "@/modules/files/queries";
import { uploadStoredFile } from "@/modules/files/store";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function uploadFileAction(
  orgSlug: string,
  formData: FormData,
): Promise<{ id?: string; path?: string; url?: string; name?: string; error?: string }> {
  const ctx = await requireWritableOrg(orgSlug);
  const file = formData.get("file");
  const entityType = String(formData.get("entity_type") ?? "").trim();
  const entityId = String(formData.get("entity_id") ?? "").trim();
  const visibility =
    String(formData.get("visibility") ?? "internal") === "shared" ? "shared" : "internal";

  if (!(file instanceof File)) return { error: "Choose a file" };
  if (!entityType || !entityId) return { error: "Missing attachment target" };
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return { error: "File must be under 12 MB" };
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return { error: "File type not allowed" };
  }

  const stored = await uploadStoredFile(ctx, {
    entityType,
    entityId,
    name: file.name,
    mime: file.type || null,
    bytes: new Uint8Array(await file.arrayBuffer()),
    visibility,
  });
  if ("error" in stored) return { error: stored.error };
  revalidatePath(`/${orgSlug}`);
  return { id: stored.id, path: stored.path, name: stored.name, url: stored.url ?? undefined };
}

export async function softDeleteFileAction(orgSlug: string, fileId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", fileId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function listTaskFilesAction(orgSlug: string, taskId: string) {
  return listFilesForEntity(orgSlug, "task", taskId);
}

export async function listLeadFilesAction(orgSlug: string, leadId: string) {
  return listFilesForEntity(orgSlug, "lead", leadId);
}
