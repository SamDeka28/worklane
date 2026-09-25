"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import { listFilesForEntity } from "@/modules/files/queries";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
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

  const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  const storagePath = `${ctx.org.id}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await ctx.supabase.storage
    .from("org-files")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message };

  const { data, error } = await ctx.supabase
    .from("files")
    .insert({
      organization_id: ctx.org.id,
      entity_type: entityType,
      entity_id: entityId,
      storage_path: storagePath,
      name: safeName,
      mime: file.type || null,
      size_bytes: file.size,
      visibility,
      created_by: ctx.userId,
    })
    .select("id, storage_path, name")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not save file" };

  const { data: signed } = await ctx.supabase.storage
    .from("org-files")
    .createSignedUrl(storagePath, 60 * 60);

  revalidatePath(`/${orgSlug}`);
  return {
    id: data.id as string,
    path: data.storage_path as string,
    name: data.name as string,
    url: signed?.signedUrl,
  };
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
