export const CREDENTIAL_KINDS = [
  "login",
  "api_key",
  "database",
  "server",
  "email",
  "other",
] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export const CREDENTIAL_KIND_LABEL: Record<CredentialKind, string> = {
  login: "Website login",
  api_key: "API key",
  database: "Database",
  server: "Server / SSH",
  email: "Email account",
  other: "Other",
};

export function isCredentialKind(value: unknown): value is CredentialKind {
  return typeof value === "string" && (CREDENTIAL_KINDS as readonly string[]).includes(value);
}

export type CredentialField = { label: string; value: string; secret: boolean };

/** Everything in here is encrypted at rest and only returned by an explicit reveal. */
export type CredentialSecret = {
  username: string;
  password: string;
  fields: CredentialField[];
  notes: string;
};

export const EMPTY_SECRET: CredentialSecret = {
  username: "",
  password: "",
  fields: [],
  notes: "",
};

export type CredentialRecord = {
  id: string;
  projectId: string;
  name: string;
  kind: CredentialKind;
  url: string | null;
  restricted: boolean;
  accessUserIds: string[];
  createdBy: string | null;
  updatedBy: string | null;
  updatedAt: string;
  secretUpdatedAt: string;
  canEdit: boolean;
  canManage: boolean;
};

export type CredentialEventAction =
  | "created"
  | "updated"
  | "revealed"
  | "copied"
  | "deleted"
  | "access_changed";

export type CredentialEvent = {
  id: number;
  action: CredentialEventAction;
  actorId: string | null;
  actorName: string;
  createdAt: string;
};

export type CredentialPerson = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

export type CredentialInput = {
  name: string;
  kind: CredentialKind;
  url: string;
  restricted: boolean;
  accessUserIds: string[];
  /** Omit on edit to keep the stored secret untouched. */
  secret?: CredentialSecret;
};
