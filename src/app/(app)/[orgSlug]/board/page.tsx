import { EmptyState } from "@/components/studio/empty-state";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { KanbanBoard } from "@/modules/delivery/components/kanban-board";
import {
  listColumnsForProjects,
  listMilestonesForProjects,
  listOrgBoardTasks,
  listProjects,
  listTaskComments,
} from "@/modules/delivery/queries";
import { listOrgMembers, requireModuleAccess, requireOrg } from "@/modules/identity/org";

export default async function BoardPage({ params }: PageProps<"/[orgSlug]/board">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "delivery");

  const [tasks, projects, members] = await Promise.all([
    listOrgBoardTasks(orgSlug),
    listProjects(orgSlug),
    listOrgMembers(orgSlug).catch(() => []),
  ]);

  const activeProjects = projects.filter(
    (project) =>
      project.status === "planning" ||
      project.status === "active" ||
      project.status === "on_hold",
  );
  const projectIds = activeProjects.map((project) => project.id);
  const [comments, milestonesByProject, columnsByProject] = await Promise.all([
    listTaskComments(
      orgSlug,
      tasks.map((task) => task.id),
    ),
    listMilestonesForProjects(orgSlug, projectIds),
    listColumnsForProjects(orgSlug, projectIds),
  ]);

  const assignees = members
    .filter((member) => member.status === "active")
    .map((member) => ({
      userId: member.userId,
      label: member.isYou
        ? "You"
        : member.displayName || member.email || `Member ${member.userId.slice(0, 8)}`,
      avatarUrl: member.avatarUrl,
    }));

  return (
    <WorkSurface className="min-h-0">
      <StudioToolbar purpose="Studio board — every open card across active projects" />
      {activeProjects.length === 0 ? (
        <EmptyState
          fill
          title="No active projects"
          body="Start a project first, then tasks from every board land here."
          actionHref={ctx.canWrite ? `/${orgSlug}/projects?new=1` : undefined}
          actionLabel={ctx.canWrite ? "New project" : undefined}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <KanbanBoard
            orgSlug={orgSlug}
            scope="org"
            tasks={tasks}
            comments={comments}
            milestonesByProject={milestonesByProject}
            columnsByProject={columnsByProject}
            canWrite={ctx.canWrite}
            currentUserId={ctx.userId}
            assignees={assignees}
            projects={activeProjects.map((project) => ({
              id: project.id,
              name: project.name,
              clientName: project.clientName,
            }))}
            className="min-h-0 flex-1"
          />
        </div>
      )}
    </WorkSurface>
  );
}
