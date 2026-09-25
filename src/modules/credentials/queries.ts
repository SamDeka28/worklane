import { listOrgMembers, requireOrg } from "@/modules/identity/org";
import { listProjectMembers, listProjectPartners } from "@/modules/partners/queries";
import {
  isCredentialKind,
  type CredentialPerson,
  type CredentialRecord,
} from "@/modules/credentials/types";

/** Metadata only: secrets are never selected here. RLS hides credentials the user can't see. */
export async function listProjectCredentials(
  orgSlug: string,
  projectId: string,
): Promise<CredentialRecord[]> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_credentials")
    .select(
      "id, project_id, name, kind, url, restricted, created_by, updated_by, updated_at, secret_updated_at, project_credential_access(user_id)",
    )
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId)
    .order("name");
  if (error) throw new Error(error.message);

  const isManager = ctx.role === "owner" || ctx.role === "admin";
  return (data ?? []).map((row) => {
    const access = (row.project_credential_access ?? []) as { user_id: string }[];
    const createdBy = (row.created_by as string | null) ?? null;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      kind: isCredentialKind(row.kind) ? row.kind : "other",
      url: (row.url as string | null) ?? null,
      restricted: Boolean(row.restricted),
      accessUserIds: access.map((a) => a.user_id),
      createdBy,
      updatedBy: (row.updated_by as string | null) ?? null,
      updatedAt: row.updated_at as string,
      secretUpdatedAt: row.secret_updated_at as string,
      canEdit: ctx.canWrite,
      canManage: isManager || (ctx.canWrite && createdBy === ctx.userId),
    };
  });
}

/**
 * People for the access picker. `team` can be granted per credential;
 * `always` (owners/admins) see every credential regardless.
 */
export async function listCredentialPeople(
  orgSlug: string,
  projectId: string,
): Promise<{ team: CredentialPerson[]; always: CredentialPerson[]; all: CredentialPerson[] }> {
  const [orgMembers, projectMembers, projectPartners] = await Promise.all([
    listOrgMembers(orgSlug),
    listProjectMembers(orgSlug, projectId).catch(() => []),
    listProjectPartners(orgSlug, projectId).catch(() => []),
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
  const teamIds = new Set<string>([
    ...projectMembers.map((m) => m.userId),
    ...projectPartners.filter((p) => p.active && p.userId).map((p) => p.userId as string),
  ]);
  const team = active
    .filter((m) => teamIds.has(m.userId) && !alwaysIds.has(m.userId))
    .map(toPerson);

  return { team, always, all };
}
