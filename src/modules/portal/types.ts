export type ShareExpose =
  | "invoices"
  | "milestones"
  | "documents"
  | "files"
  | "projects"
  | "earnings";

export type ClientShareScope = {
  kind: "client";
  client_id: string;
  expose: ShareExpose[];
};

export type PartnerShareScope = {
  kind: "partner";
  partner_id: string;
  expose: ShareExpose[];
};

export type ShareScope = ClientShareScope | PartnerShareScope;

export type ShareGrantRecord = {
  id: string;
  organizationId: string;
  label: string | null;
  scope: ShareScope;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string | null;
};

export function isShareScope(value: unknown): value is ShareScope {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.kind === "client" && typeof row.client_id === "string") {
    return Array.isArray(row.expose);
  }
  if (row.kind === "partner" && typeof row.partner_id === "string") {
    return Array.isArray(row.expose);
  }
  return false;
}
