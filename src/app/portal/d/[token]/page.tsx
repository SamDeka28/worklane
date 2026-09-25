import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { SharedDocumentView } from "@/modules/documents/components/shared-document-view";
import { loadSharedDocument, trackDocumentSendById } from "@/modules/documents/sends";
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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const rev = typeof query.rev === "string" ? query.rev : null;
  const shared = await loadSharedDocument(token, rev);
  if (!shared) notFound();

  const isMember = await viewerIsStudioMember(shared.organizationId);
  if (!isMember && shared.isLatest) {
    after(() => trackDocumentSendById(shared.displayedSendId, "view"));
  }

  return (
    <SharedDocumentView
      token={token}
      title={shared.title}
      orgName={shared.orgName}
      recipientName={shared.recipientName}
      recipientEmail={shared.recipientEmail}
      sentAt={shared.sentAt}
      content={shared.content}
      versionNumber={shared.versionNumber}
      previousContent={shared.previousContent}
      previousVersionNumber={shared.previousVersionNumber}
      revisions={shared.revisions}
      displayedSendId={shared.displayedSendId}
      isLatest={shared.isLatest}
      internalPreview={isMember}
      supersededAt={shared.supersededAt}
      locked={shared.locked}
      signatures={shared.signatures}
      clientSigned={shared.clientSigned}
      accepted={shared.accepted}
      feedback={shared.feedback}
    />
  );
}
