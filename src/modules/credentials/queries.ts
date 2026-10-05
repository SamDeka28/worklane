import { listOrgMembers, requireOrg } from "@/modules/identity/org";
import { listProjectMembers, listProjectPartners } from "@/modules/partners/queries";
import {
  isCredentialKind,
  type CredentialPerson,
  type CredentialRecord,
} from "@/modules/credentials/types";

type CredentialRow = {
  id: string;
  project_id: string | null;
  name: string;
  kind: string;
  url: string | null;
  restricted: boolean;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
  secret_updated_at: string;
  project_credential_access: { user_id: string }[] | null;
  projects?: { name: string } | { name: string }[] | null;
};

function mapCredential(
  row: CredentialRow,
  ctx: { role: string; canWrite: boolean; userId: string },
  projectName: string | null,
): CredentialRecord {
  const access = row.project_credential_access ?? [];
  const createdBy = row.created_by;
  const isManager = ctx.role === "owner" || ctx.role === "admin";
  return {
    id: row.id,
    projectId: row.project_id,
    projectName,
    name: row.name,
    kind: isCredentialKind(row.kind) ? row.kind : "other",
    url: row.url,
    restricted: Boolean(row.restricted),
    accessUserIds: access.map((entry) => entry.user_id),
    createdBy,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    secretUpdatedAt: row.secret_updated_at,
    canEdit: ctx.canWrite,
    canManage: isManager || (ctx.canWrite && createdBy === ctx.userId),
  };
}

const CREDENTIAL_COLUMNS =
  "id, project_id, name, kind, url, restricted, created_by, updated_by, updated_at, secret_updated_at, project_credential_access(user_id)";

/** Metadata only: secrets are never selected here. RLS hides credentials the user can't see. */
export async function listProjectCredentials(
  orgSlug: string,
  projectId: string,
): Promise<CredentialRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_credentials")
    .select(CREDENTIAL_COLUMNS)
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as CredentialRow[]).map((row) => mapCredential(row, ctx, null));
}

/** Every credential this member can open, including ones with no project. */
export async function listStudioCredentials(orgSlug: string): Promise<CredentialRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_credentials")
    .select(`${CREDENTIAL_COLUMNS}, projects(name)`)
    .eq("organization_id", ctx.org.id)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as CredentialRow[]).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    return mapCredential(row, ctx, project?.name ?? null);
  });
}

/**
 * People for the access picker. `team` can be granted per credential;
 * `always` (owners/admins) see every credential regardless.
 */
export async function listCredentialPeople(
  orgSlug: string,
  projectId: string | null,
): Promise<{ team: CredentialPerson[]; always: CredentialPerson[]; all: CredentialPerson[] }> {
  const [orgMembers, projectMembers, projectPartners] = await Promise.all([
    listOrgMembers(orgSlug),
    projectId ? listProjectMembers(orgSlug, projectId).catch(() => []) : Promise.resolve([]),
    projectId ? listProjectPartners(orgSlug, projectId).catch(() => []) : Promise.resolve([]),
  ]);

  const active = orgMembers.filter((m) => m.status === "active");
  const toPerson = (m: (typeof active)[number]): CredentialPerson => ({
    userId: m.userId,
    name: m.isYou ? "You" : m.displayName?.trim() || m.email?.split("@")[0] || "Member",
    email: m.email,
    avatarUrl: m.avatarUrl,
    role: m.role,
  });

  const all = active.map(toPerson);
  const always = active
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map(toPerson);
  const alwaysIds = new Set(always.map((p) => p.userId));
  const teamIds = projectId
    ? new Set<string>([
        ...projectMembers.map((m) => m.userId),
        ...projectPartners.filter((p) => p.active && p.userId).map((p) => p.userId as string),
      ])
    : null;
  const team = active
    .filter((m) => !alwaysIds.has(m.userId) && (teamIds ? teamIds.has(m.userId) : true))
    .map(toPerson);

  return { team, always, all };
}
