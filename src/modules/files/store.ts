import type { OrgContext } from "@/modules/identity/org";

const SIGNED_SECONDS = 60 * 60 * 24 * 7;

export async function uploadStoredFile(
  ctx: OrgContext,
  input: {
    entityType: string;
    entityId: string;
    name: string;
    mime: string | null;
    bytes: Uint8Array;
    visibility?: "internal" | "shared";
  },
): Promise<{ id: string; path: string; name: string; url: string | null } | { error: string }> {
  const safeName = input.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "file";
  const storagePath = `${ctx.org.id}/${input.entityType}/${input.entityId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await ctx.supabase.storage.from("org-files").upload(storagePath, input.bytes, {
    contentType: input.mime || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message };

  const { data, error } = await ctx.supabase
    .from("files")
    .insert({
      organization_id: ctx.org.id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      storage_path: storagePath,
      name: safeName,
      mime: input.mime,
      size_bytes: input.bytes.byteLength,
      visibility: input.visibility ?? "internal",
      created_by: ctx.userId,
    })
    .select("id, storage_path, name")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save file" };

  const { data: signed } = await ctx.supabase.storage.from("org-files").createSignedUrl(storagePath, SIGNED_SECONDS);
  return {
    id: data.id as string,
    path: data.storage_path as string,
    name: data.name as string,
    url: signed?.signedUrl ?? null,
  };
}
