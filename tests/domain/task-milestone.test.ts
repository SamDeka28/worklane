import { describe, expect, it } from "vitest";
import {
  milestoneColumnPatch,
  milestoneIdFromToolInput,
  planTaskMilestoneLink,
  taskMilestoneFields,
  type TaskMilestoneRow,
} from "@/modules/delivery/task-milestone";

const design: TaskMilestoneRow = {
  id: "milestone-design",
  name: "Design",
  projectId: "project-lynqo",
  status: "planned",
};
const build: TaskMilestoneRow = {
  id: "milestone-build",
  name: "Build",
  projectId: "project-lynqo",
  status: "active",
};
const otherProject: TaskMilestoneRow = {
  id: "milestone-other",
  name: "Other studio work",
  projectId: "project-other",
  status: "planned",
};
const cancelled: TaskMilestoneRow = {
  id: "milestone-cancelled",
  name: "Dropped",
  projectId: "project-lynqo",
  status: "cancelled",
};

const rows = [design, build, otherProject, cancelled];

function loadMilestone(id: string) {
  return Promise.resolve(rows.find((row) => row.id === id) ?? null);
}

describe("task milestone linking", () => {
  it("creates a task linked to a milestone on the same project", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "create",
      requestedId: design.id,
      taskProjectId: design.projectId,
      loadMilestone,
    });
    expect(milestoneColumnPatch(plan)).toEqual({ milestone_id: design.id });
    expect(plan).toMatchObject({
      op: "set",
      milestoneId: design.id,
      milestone: { id: design.id, name: "Design", projectId: design.projectId },
    });
    if ("error" in plan || plan.op !== "set") throw new Error("expected a link");
    expect(taskMilestoneFields(plan).milestone_id).toBe(design.id);
  });

  it("creates an unlinked task when milestone_id is omitted", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "create",
      requestedId: undefined,
      taskProjectId: design.projectId,
      loadMilestone,
    });
    expect(milestoneColumnPatch(plan)).toEqual({ milestone_id: null });
    expect(plan).toMatchObject({ op: "set", milestone: null });
  });

  it("updates a task onto a milestone", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "update",
      requestedId: design.id,
      taskProjectId: design.projectId,
      currentMilestoneId: null,
      loadMilestone,
    });
    expect(milestoneColumnPatch(plan)).toEqual({ milestone_id: design.id });
  });

  it("moves a task from one milestone to another on the same project", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "update",
      requestedId: build.id,
      taskProjectId: design.projectId,
      currentMilestoneId: design.id,
      loadMilestone,
    });
    expect(plan).toMatchObject({ op: "set", milestoneId: build.id, milestone: { name: "Build" } });
  });

  it("clears the link when milestone_id is empty", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "update",
      requestedId: "",
      taskProjectId: design.projectId,
      currentMilestoneId: design.id,
      loadMilestone,
    });
    expect(milestoneColumnPatch(plan)).toEqual({ milestone_id: null });
    expect(plan).toMatchObject({ op: "set", milestoneId: null, milestone: null });
  });

  it("leaves an existing link unchanged when the update omits milestone_id", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "update",
      requestedId: undefined,
      taskProjectId: design.projectId,
      currentMilestoneId: design.id,
      loadMilestone,
    });
    expect(plan).toEqual({ op: "leave" });
    expect(milestoneColumnPatch(plan)).toEqual({});
  });

  it("rejects an unknown milestone", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "create",
      requestedId: "missing",
      taskProjectId: design.projectId,
      loadMilestone,
    });
    expect(plan).toEqual({ error: "Milestone not found" });
    expect(milestoneColumnPatch(plan)).toEqual({});
  });

  it("rejects a milestone from another project", async () => {
    const plan = await planTaskMilestoneLink({
      mode: "update",
      requestedId: otherProject.id,
      taskProjectId: design.projectId,
      currentMilestoneId: design.id,
      loadMilestone,
    });
    expect(plan).toEqual({ error: "That milestone is on a different project" });
  });

  it("rejects a new link to a cancelled milestone and keeps one that is already linked", async () => {
    const blocked = await planTaskMilestoneLink({
      mode: "create",
      requestedId: cancelled.id,
      taskProjectId: design.projectId,
      loadMilestone,
    });
    expect(blocked).toEqual({ error: "Cancelled milestones can't be linked to tasks" });

    const kept = await planTaskMilestoneLink({
      mode: "update",
      requestedId: cancelled.id,
      taskProjectId: design.projectId,
      currentMilestoneId: cancelled.id,
      loadMilestone,
    });
    expect(kept).toMatchObject({ op: "set", milestoneId: cancelled.id });
  });

  it("reads milestone_id from the MCP tool input, with milestoneId as the same field", () => {
    expect(milestoneIdFromToolInput({ milestone_id: design.id, milestoneId: build.id })).toBe(design.id);
    expect(milestoneIdFromToolInput({ milestoneId: build.id })).toBe(build.id);
    expect(milestoneIdFromToolInput({ milestone_id: "" })).toBe("");
    expect(milestoneIdFromToolInput({ milestone_id: null })).toBe("");
    expect(milestoneIdFromToolInput({})).toBeUndefined();
  });
});
