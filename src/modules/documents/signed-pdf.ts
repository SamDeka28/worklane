import type { SupabaseClient } from "@supabase/supabase-js";
import type { JSONContent } from "@tiptap/core";
import {
  documentPdfFilename,
  renderDocumentPdfBuffer,
  type DocumentPdfSignature,
} from "@/modules/documents/pdf";
import type { SendEmailInput } from "@/shared/email";

type Attachment = NonNullable<SendEmailInput["attachments"]>[number];

/**
 * The exact content that was signed: the stored copy on the client's link when they signed from it
 * (so fingerprints match), otherwise the version's locked snapshot.
 */
export async function signedContentFor(client: SupabaseClient, versionId: string) {
  const [{ data: version }, { data: portalSig }] = await Promise.all([
    client.from("document_versions").select("snapshot, content_doc").eq("id", versionId).maybeSingle(),
    client
      .from("document_signatures")
      .select("send_id")
      .eq("document_version_id", versionId)
      .eq("method", "portal")
      .not("send_id", "is", null)
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: send } = portalSig?.send_id
    ? await client
        .from("document_sends")
        .select("id, recipient_email, content_doc")
        .eq("id", portalSig.send_id)
        .maybeSingle()
    : { data: null };
  const content =
    send?.content_doc ??
    (version?.snapshot as { contentDoc?: unknown } | null)?.contentDoc ??
    version?.content_doc ??
    null;
  return {
    content,
    signedSend: send ? { id: send.id as string, recipientEmail: send.recipient_email as string } : null,
  };
}

/** Renders the signed copy and, once both sides have signed, a standalone signature certificate. */
export async function buildSignedDocumentFiles(
  client: SupabaseClient,
  input: {
    versionId: string;
    title: string;
    orgName: string;
    clientName: string | null;
    content: unknown;
  },
) {
  const [{ data: version }, { data: rows }] = await Promise.all([
    client.from("document_versions").select("version_number").eq("id", input.versionId).maybeSingle(),
    client
      .from("document_signatures")
      .select("signer_name, signer_email, signature_text, signed_at, content_hash, method, ip_address")
      .eq("document_version_id", input.versionId)
      .order("signed_at", { ascending: true }),
  ]);
  const signatures: DocumentPdfSignature[] = (rows ?? []).map((row) => ({
    party: row.method === "portal" ? "client" : "studio",
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    signatureText: row.signature_text ?? null,
    signedAt: row.signed_at,
    contentHash: row.content_hash ?? null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
  }));
  const pdfInput = {
    title: input.title,
    orgName: input.orgName,
    clientName: input.clientName,
    versionNumber: (version?.version_number as number | undefined) ?? null,
    content: (input.content as JSONContent) ?? { type: "doc", content: [] },
    signatures,
  };
  const complete =
    signatures.some((sig) => sig.party === "client") && signatures.some((sig) => sig.party === "studio");

  const files: Attachment[] = [
    {
      filename: documentPdfFilename(input.title, complete ? "signed" : "signed-by-client"),
      content: await renderDocumentPdfBuffer(pdfInput),
      contentType: "application/pdf",
    },
  ];
  if (complete) {
    files.push({
      filename: documentPdfFilename(input.title, "signature-certificate"),
      content: await renderDocumentPdfBuffer({ ...pdfInput, certificateOnly: true }),
      contentType: "application/pdf",
    });
  }
  return { files, complete, signatures };
}

/** Email attachments for the signed copy; undefined on failure so a PDF problem never blocks the email. */
export async function signedDocumentAttachments(
  client: SupabaseClient,
  input: Parameters<typeof buildSignedDocumentFiles>[1],
): Promise<SendEmailInput["attachments"]> {
  try {
    return (await buildSignedDocumentFiles(client, input)).files;
  } catch (error) {
    console.error("signed document pdf failed", error);
    return undefined;
  }
}
