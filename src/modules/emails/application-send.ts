import type { SupabaseClient } from "@supabase/supabase-js";
import { mailPixelUrl } from "@/shared/email/pixel";
import { pixelHtml } from "@/modules/emails/types";
import { sendEmail, type SendEmailInput, type SendEmailResult } from "@/shared/email";
import { removeEmailAttachments, storeEmailAttachments } from "@/modules/emails/storage";

/** Sends an app initiated email and records its open tracker in the shared Emails ledger. */
export async function sendTrackedApplicationEmail(
  supabase: SupabaseClient,
  context: { organizationId: string; userId: string; leadId?: string | null },
  input: SendEmailInput & { body?: string | null },
): Promise<SendEmailResult | { ok: true; messageId?: string; trackedId: string }> {
  const id = crypto.randomUUID();
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const claim = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  const recipient = Array.isArray(input.to) ? input.to.join(", ") : input.to;
  const cc = input.cc ?? [];
  const body = input.body?.slice(0, 20_000) ?? null;
  const savedAttachments = await storeEmailAttachments(
    supabase,
    context.organizationId,
    context.userId,
    id,
    input.attachments ?? [],
  );
  if ("error" in savedAttachments) return { ok: false, error: savedAttachments.error };
  const { error } = await supabase.from("mail_pixels").insert({
    id,
    organization_id: context.organizationId,
    created_by: context.userId,
    token,
    claim,
    subject: input.subject.slice(0, 200),
    recipient: recipient.slice(0, 320),
    lead_id: context.leadId ?? null,
    body,
    cc,
    attachments: savedAttachments.attachments,
  });
  if (error) {
    await removeEmailAttachments(supabase, savedAttachments.attachments);
    return { ok: false, error: "Could not prepare email tracking. Please try again." };
  }

  const pixel = pixelHtml(mailPixelUrl(token));
  const html = input.html.includes("</body>")
    ? input.html.replace(/<\/body>/i, `${pixel}</body>`)
    : `${input.html}${pixel}`;
  const sent = await sendEmail({ ...input, html });
  if (!sent.ok) {
    await supabase.from("mail_pixels").delete().eq("id", id).eq("organization_id", context.organizationId);
    await removeEmailAttachments(supabase, savedAttachments.attachments);
    return sent;
  }
  const { error: updateError } = await supabase.from("mail_pixels").update({
    sent_at: new Date().toISOString(),
    message_id: sent.messageId ?? null,
  }).eq("id", id).eq("organization_id", context.organizationId);
  if (updateError) return { ok: false, error: "Email was sent, but its tracking status could not be saved." };
  return { ok: true, messageId: sent.messageId, trackedId: id };
}
