import { Badge } from "@/components/ui/badge";
import { AvatarMark, SoftCard, StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import { StatusChip } from "@/components/studio/status-chip";
import { listProjectBoard } from "@/modules/delivery/queries";
import { listOrgMembers, requireOrg } from "@/modules/identity/org";
import {
  FULL_PERMISSIONS,
  PARTNER_DEFAULT_PERMISSIONS,
  resolveMemberPermissions,
} from "@/modules/identity/permissions";
import { isEmailConfigured } from "@/shared/email";
import { listPendingInvitations } from "@/modules/team/actions";
import { EditMemberAccessSheet } from "@/modules/team/components/edit-member-access";
import {
  InviteMemberForm,
  PendingInvitesList,
} from "@/modules/team/components/invite-forms";

export default async function TeamPage({
  params,
}: PageProps<"/[orgSlug]/team">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const [members, board, pendingInvites, projectMembershipRows] = await Promise.all([
    listOrgMembers(orgSlug),
    listProjectBoard(orgSlug).catch(() => []),
    canManage ? listPendingInvitations(orgSlug) : Promise.resolve([]),
    canManage
      ? ctx.supabase
          .from("project_members")
          .select("user_id, project_id, role")
          .eq("organization_id", ctx.org.id)
          .then(({ data }) => data ?? [])
      : Promise.resolve([] as { user_id: string; project_id: string; role: string }[]),
  ]);
  const projects = board.map((row) => ({
    id: row.project.id,
    name: row.project.name,
  }));
  const projectsByUser = new Map<string, { projectIds: string[]; projectRole: "member" | "lead" }>();
  for (const row of projectMembershipRows) {
    const userId = row.user_id as string;
    const current = projectsByUser.get(userId) ?? {
      projectIds: [],
      projectRole: "member" as const,
    };
    current.projectIds.push(row.project_id as string);
    if ((row.role as string) === "lead") current.projectRole = "lead";
    projectsByUser.set(userId, current);
  }

  return (
    <WorkSurface>
      <StudioToolbar purpose="Studio team — invite people and manage access" />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {members.length} member{members.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden>·</span>
          <span>Email {isEmailConfigured() ? "connected" : "not configured"}</span>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SoftCard className="p-5">
            <p className="mb-1 text-sm font-semibold tracking-tight">Members</p>
            <p className="mb-4 text-xs text-muted-foreground">
              People with studio access — edit role and module permissions
            </p>
            {members.length === 0 ? (
              <EmptyState title="No members yet" body="Invite a teammate to get started." />
            ) : (
              <ul className="space-y-1">
                {members.map((member) => {
                  const effective = resolveMemberPermissions({
                    role: member.role,
                    stored: member.permissions,
                    orgModules: ctx.org.modules,
                  });
                  const accessHint =
                    member.role === "owner"
                      ? "Full"
                      : !member.permissions
                        ? member.role === "partner"
                          ? "Partner default"
                          : "Full"
                        : effective.finance?.access === "none" &&
                            effective.delivery?.access !== "none"
                          ? "Progress"
                          : "Custom";
                  return (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-muted/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {member.isYou
                            ? "You"
                            : member.displayName ||
                              member.email ||
                              member.userId.slice(0, 8)}
                        </p>
                        {member.email && !member.isYou ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusChip tone="paid">Active</StatusChip>
                        <Badge variant="secondary" className="capitalize">
                          {member.role}
                        </Badge>
                        <span className="hidden text-[11px] text-muted-foreground sm:inline">
                          {accessHint}
                        </span>
                        {canManage ? (
                          <EditMemberAccessSheet
                            orgSlug={orgSlug}
                            actorRole={ctx.role}
                            projects={projects}
                            member={{
                              ...member,
                              projectIds: projectsByUser.get(member.userId)?.projectIds ?? [],
                              projectRole:
                                projectsByUser.get(member.userId)?.projectRole ?? "member",
                              permissions:
                                member.permissions ??
                                (member.role === "partner"
                                  ? PARTNER_DEFAULT_PERMISSIONS
                                  : FULL_PERMISSIONS),
                            }}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SoftCard>

          <div className="space-y-5">
            {canManage ? (
              <SoftCard className="p-5">
                <p className="mb-1 text-sm font-semibold tracking-tight">Invite</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Email a teammate and set what they can see
                </p>
                <InviteMemberForm orgSlug={orgSlug} projects={projects} />
              </SoftCard>
            ) : (
              <SoftCard className="p-5">
                <p className="text-sm text-muted-foreground">
                  Only owners and admins can invite teammates.
                </p>
              </SoftCard>
            )}

            {canManage ? (
              <SoftCard className="p-5">
                <p className="mb-1 text-sm font-semibold tracking-tight">
                  Pending invites
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Not accepted yet — resend or revoke
                </p>
                <PendingInvitesList orgSlug={orgSlug} invitations={pendingInvites} />
              </SoftCard>
            ) : null}
          </div>
        </div>
      </div>
    </WorkSurface>
  );
}
