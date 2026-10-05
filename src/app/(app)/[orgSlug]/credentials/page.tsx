import { notFound } from "next/navigation";
import { WorkSurface, StudioToolbar } from "@/components/studio/chrome";
import { CredentialsVault } from "@/modules/credentials/components/credentials-vault";
import { listCredentialPeople, listStudioCredentials } from "@/modules/credentials/queries";
import type { CredentialPerson } from "@/modules/credentials/types";
import { listProjects } from "@/modules/delivery/queries";
import { requireOrg } from "@/modules/identity/org";
import { canAccessProjectTab } from "@/modules/identity/permissions";
import { isSecretsConfigured } from "@/shared/crypto/secrets";
import { JOURNEY } from "@/shared/journey-copy";

export default async function CredentialsPage({ params }: PageProps<"/[orgSlug]/credentials">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  if (!canAccessProjectTab(ctx.permissions, "credentials")) notFound();

  const [credentials, projects, studioPeople] = await Promise.all([
    listStudioCredentials(orgSlug),
    listProjects(orgSlug).catch(() => []),
    listCredentialPeople(orgSlug, null),
  ]);

  const [{ data: members }, { data: partnerLinks }] = await Promise.all([
    ctx.supabase.from("project_members").select("project_id, user_id").eq("organization_id", ctx.org.id),
    ctx.supabase
      .from("project_partners")
      .select("project_id, partners(user_id, active)")
      .eq("organization_id", ctx.org.id),
  ]);

  const byId = new Map(studioPeople.all.map((person) => [person.userId, person]));
  const alwaysIds = new Set(studioPeople.always.map((person) => person.userId));
  const teamsByProject: Record<string, CredentialPerson[]> = {};
  for (const project of projects) {
    const ids = new Set<string>();
    for (const row of members ?? []) {
      if (row.project_id === project.id) ids.add(row.user_id);
    }
    for (const row of partnerLinks ?? []) {
      if (row.project_id !== project.id) continue;
      const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
      if (partner?.active && partner.user_id) ids.add(partner.user_id);
    }
    teamsByProject[project.id] = [...ids].flatMap((id) => {
      const person = byId.get(id);
      return person && !alwaysIds.has(id) ? [person] : [];
    });
  }

  return (
    <WorkSurface>
      <StudioToolbar purpose={JOURNEY.credentials.purpose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <CredentialsVault
          orgSlug={orgSlug}
          projectId={null}
          credentials={credentials}
          team={studioPeople.team}
          always={studioPeople.always}
          people={studioPeople.all}
          projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          teamsByProject={teamsByProject}
          studioTeam={studioPeople.team}
          canCreate={ctx.canWrite}
          configured={isSecretsConfigured()}
        />
      </div>
    </WorkSurface>
  );
}
