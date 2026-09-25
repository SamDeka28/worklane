export type ClientKind = "company" | "person";

export type ClientRecord = {
  id: string;
  organizationId: string;
  kind: ClientKind;
  name: string;
  notes: string | null;
  notesDoc?: Record<string, unknown> | null;
  currency: "USD" | "INR";
  archivedAt: string | null;
  createdAt: string;
};

export type ContactRecord = {
  id: string;
  clientId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
};

export type ActivityRecord = {
  id: string;
  verb: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorId?: string | null;
};

/** Client timeline row with the charge / payment it refers to resolved. */
export type ClientActivityItem = {
  id: string;
  kind: "charge" | "payment" | "created" | "other";
  title: string;
  /** What it was for, e.g. milestone or memo. */
  subject: string | null;
  projectId: string | null;
  projectName: string | null;
  /** e.g. "via Bank · ref 1234" or "due Sep 30". */
  detail: string | null;
  amountMinor: bigint | null;
  currency: string | null;
  actorName: string | null;
  createdAt: string;
};
