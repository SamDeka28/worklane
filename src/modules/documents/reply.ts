import type { OrgContext } from "@/modules/identity/org";
import { documentSendToken, documentViewPath } from "@/modules/documents/sends";
import { sendTrackedApplicationEmail } from "@/modules/emails/application-send";
import { documentUpdateEmailHtml, documentUpdateEmailText, getAppUrl, isEmailConfigured } from "@/shared/email";

export async function replyDocumentForContext(
  ctx: OrgContext,
  documentId: string,
  input: { sendId?: string; body: string; emailClient?: boolean },
): Promise<{ ok: true; emailed: boolean } | { error: string }> {
  const body = input.body.trim().slice(0, 4000);
  if (!body) return { error: "Write a reply first" };
  const emailClient = input.emailClient !== false;

  let sendQuery = ctx.supabase
    .from("document_sends")
    .select("id, document_version_id, recipient_email, recipient_name, title, revoked_at")
    .eq("document_id", documentId)
    .eq("organization_id", ctx.org.id)
    .order("sent_at", { ascending: false })
    .limit(1);
  if (input.sendId?.trim()) {
    sendQuery = ctx.supabase
      .from("document_sends")
      .select("id, document_version_id, recipient_email, recipient_name, title, revoked_at")
      .eq("id", input.sendId.trim())
      .eq("document_id", documentId)
      .eq("organization_id", ctx.org.id)
      .limit(1);
  }
  const { data: send } = await sendQuery.maybeSingle();
  if (!send) return { error: "This document has not been emailed yet." };

  const { error } = await ctx.supabase.from("document_feedback").insert({
    organization_id: ctx.org.id,
    document_id: documentId,
    document_version_id: send.document_version_id,
    send_id: send.id,
    kind: "reply",
    author_type: "studio",
    author_name: ctx.user.displayName ?? ctx.org.name,
    author_email: ctx.user.email,
    author_user_id: ctx.userId,
    body,
  });
  if (error) return { error: error.message };

  let emailed = false;
  if (emailClient && !send.revoked_at && isEmailConfigured()) {
    const message = {
      orgName: ctx.org.name,
      heading: `New reply on ${send.title}`,
      message: `${ctx.user.displayName ?? ctx.org.name} replied:\n\n${body}`,
      viewUrl: `${getAppUrl()}${documentViewPath(documentSendToken(send.id as string))}`,
      buttonLabel: "Open and respond",
    };
    const result = await sendTrackedApplicationEmail(
      ctx.supabase,
      { organizationId: ctx.org.id, userId: ctx.userId },
      {
        to: send.recipient_email as string,
        subject: `Re: ${send.title}`,
        fromName: `${ctx.user.displayName ? `${ctx.user.displayName} at ` : ""}${ctx.org.name}`,
        replyTo: ctx.user.email ?? undefined,
        html: documentUpdateEmailHtml(message),
        text: documentUpdateEmailText(message),
      },
    );
    emailed = result.ok;
  }
  return { ok: true, emailed };
}
