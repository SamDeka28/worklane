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
};
