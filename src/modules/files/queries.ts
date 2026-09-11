import { requireOrg } from "@/modules/identity/org";

export type FileRecord = {
  id: string;
  entityType: string;
  entityId: string;
  name: string;
  mime: string | null;
  sizeBytes: number | null;
  storagePath: string;
  createdAt: string;
  url?: string | null;
};

export async function listFilesForEntity(
  orgSlug: string,
  entityType: string,
  entityId: string,
): Promise<FileRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("files")
    .select("id, entity_type, entity_id, name, mime, size_bytes, storage_path, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows: FileRecord[] = [];
  for (const row of data ?? []) {
    const { data: signed } = await ctx.supabase.storage
      .from("org-files")
      .createSignedUrl(row.storage_path, 60 * 60);
    rows.push({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      name: row.name,
      mime: row.mime,
      sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
      storagePath: row.storage_path,
      createdAt: row.created_at,
      url: signed?.signedUrl ?? null,
    });
  }
  return rows;
}
