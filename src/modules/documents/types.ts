export type DocumentKind = "proposal" | "sow" | "other";
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
