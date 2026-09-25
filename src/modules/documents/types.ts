export const DOCUMENT_KINDS = [
  "proposal",
  "sow",
  "contract",
  "nda",
  "brief",
  "change_order",
  "report",
  "other",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  proposal: "Proposal",
  sow: "Statement of work",
  contract: "Services agreement",
  nda: "NDA",
  brief: "Project brief",
  change_order: "Change order",
  report: "Status report",
  other: "Document",
};

export const DOCUMENT_KIND_SHORT: Record<DocumentKind, string> = {
  proposal: "Proposal",
  sow: "SOW",
  contract: "Agreement",
  nda: "NDA",
  brief: "Brief",
  change_order: "Change order",
  report: "Report",
  other: "Document",
};

export function asDocumentKind(value: string | null | undefined): DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value ?? "")
    ? (value as DocumentKind)
    : "proposal";
}
export type DocumentStatus = "draft" | "sent" | "accepted" | "signed" | "void";

export type DocumentRecord = {
  id: string;
  kind: DocumentKind;
  title: string;
  status: DocumentStatus;
  clientId: string | null;
  projectId: string | null;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  contentDoc: Record<string, unknown>;
  snapshot: Record<string, unknown> | null;
  status: DocumentStatus;
  pdfFileId: string | null;
  createdAt: string;
  lockedAt: string | null;
  createdBy: string | null;
};

export type DocumentSignature = {
  id: string;
  documentVersionId: string;
  signerName: string;
  signerEmail: string;
  intentText: string;
  signedAt: string;
};
