import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { SharedDocumentView } from "@/modules/documents/components/shared-document-view";
import { loadSharedDocument, trackDocumentSend } from "@/modules/documents/sends";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";

export const metadata: Metadata = {
  title: "Shared document",
  robots: { index: false, follow: false },
};

async function viewerIsStudioMember(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

export default async function SharedDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await loadSharedDocument(token);
  if (!shared) notFound();

  const isMember = await viewerIsStudioMember(shared.organizationId);
  if (!isMember) after(() => trackDocumentSend(token, "view"));

  return (
    <SharedDocumentView
      token={token}
      title={shared.title}
      orgName={shared.orgName}
      recipientName={shared.recipientName}
      recipientEmail={shared.recipientEmail}
      sentAt={shared.sentAt}
      content={shared.content}
      internalPreview={isMember}
      supersededAt={shared.supersededAt}
      locked={shared.locked}
      signature={shared.signature}
      feedback={shared.feedback}
    />
  );
}
