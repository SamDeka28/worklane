export type TaskMilestoneRow = {
  id: string;
  name: string;
  projectId: string;
  status: string;
};

export type TaskMilestonePlan =
  | { op: "leave" }
  | {
      op: "set";
      milestoneId: string | null;
      milestone: TaskMilestoneRow | null;
    }
  | { error: string };

function requestedMilestone(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Decide whether a task write should leave, set, or clear tasks.milestone_id.
 * A milestone can only be linked when it belongs to the task's project.
 */
export function planTaskMilestone(input: {
  mode: "create" | "update";
  requestedId: string | null | undefined;
  taskProjectId: string;
  /** Milestone already stored on the task. Keeping that link is allowed. */
  currentMilestoneId?: string | null;
  milestone: TaskMilestoneRow | null;
}): TaskMilestonePlan {
  const requested = requestedMilestone(input.requestedId);
  if (requested === undefined) {
    if (input.mode === "create") return { op: "set", milestoneId: null, milestone: null };
    return { op: "leave" };
  }
  if (requested === null) return { op: "set", milestoneId: null, milestone: null };
  if (!input.taskProjectId) return { error: "Task project is required" };
  if (!input.milestone || input.milestone.id !== requested) return { error: "Milestone not found" };
  if (input.milestone.projectId !== input.taskProjectId) {
    return { error: "That milestone is on a different project" };
  }
  if (input.milestone.status === "cancelled" && input.milestone.id !== input.currentMilestoneId) {
    return { error: "Cancelled milestones can't be linked to tasks" };
  }
  return {
    op: "set",
    milestoneId: input.milestone.id,
    milestone: {
      id: input.milestone.id,
      name: input.milestone.name,
      projectId: input.milestone.projectId,
      status: input.milestone.status,
    },
  };
}

export async function planTaskMilestoneLink(input: {
  mode: "create" | "update";
  requestedId: string | null | undefined;
  taskProjectId: string;
  currentMilestoneId?: string | null;
  loadMilestone: (id: string) => Promise<TaskMilestoneRow | null>;
}): Promise<TaskMilestonePlan> {
  const lookup = typeof input.requestedId === "string" ? input.requestedId.trim() : "";
  const milestone = lookup ? await input.loadMilestone(lookup) : null;
  return planTaskMilestone({
    mode: input.mode,
    requestedId: input.requestedId,
    taskProjectId: input.taskProjectId,
    currentMilestoneId: input.currentMilestoneId,
    milestone,
  });
}

export function milestoneColumnPatch(plan: TaskMilestonePlan): { milestone_id?: string | null } {
  if ("error" in plan || plan.op === "leave") return {};
  return { milestone_id: plan.milestoneId };
}

export function taskMilestoneFields(plan: Extract<TaskMilestonePlan, { op: "set" }>) {
  return {
    milestone_id: plan.milestoneId,
    milestoneId: plan.milestoneId,
    milestone: plan.milestone,
  };
}

/** MCP create_task / update_task accept milestone_id, and milestoneId as the same value. */
export function milestoneIdFromToolInput(input: {
  milestoneId?: string | null;
  milestone_id?: string | null;
}): string | null | undefined {
  if (input.milestone_id !== undefined) return input.milestone_id ?? "";
  if (input.milestoneId !== undefined) return input.milestoneId ?? "";
  return undefined;
}
