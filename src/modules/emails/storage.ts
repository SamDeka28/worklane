import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailFileAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type StoredEmailAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
};

/** Save a private preview copy of each attachment in the existing org file bucket. */
export async function storeEmailAttachments(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  emailId: string,
  attachments: EmailFileAttachment[],
): Promise<{ attachments: StoredEmailAttachment[] } | { error: string }> {
  const stored: StoredEmailAttachment[] = [];
  for (const attachment of attachments) {
    const safeName = attachment.filename.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "attachment";
    const storagePath = `${organizationId}/email-attachments/${userId}/${emailId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("org-files").upload(storagePath, attachment.content, {
      contentType: attachment.contentType || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      await removeEmailAttachments(supabase, stored);
      return { error: "Could not save email attachments for preview. Please try again." };
    }
    stored.push({
      filename: safeName,
      contentType: attachment.contentType || "application/octet-stream",
      sizeBytes: attachment.content.length,
      storagePath,
    });
  }
  return { attachments: stored };
}

export async function removeEmailAttachments(
  supabase: SupabaseClient,
  attachments: Pick<StoredEmailAttachment, "storagePath">[],
) {
  if (attachments.length === 0) return;
  await supabase.storage.from("org-files").remove(attachments.map((item) => item.storagePath));
}
