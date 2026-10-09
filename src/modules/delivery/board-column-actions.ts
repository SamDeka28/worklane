"use server";

import { revalidatePath } from "next/cache";
import {
  planColumnSync,
  validateBoardColumns,
  type BoardSystemKey,
  type ProjectColumnLink,
  type StudioBoardColumn,
} from "@/modules/delivery/board-columns";
import { moveTaskAction } from "@/modules/delivery/actions";
import { requireWritableOrg, type OrgContext } from "@/modules/identity/org";

function systemKeyOf(value: string | null): BoardSystemKey | null {
  return value === "todo" || value === "doing" || value === "done" ? value : null;
}

async function syncProject(ctx: OrgContext, projectId: string, columns: StudioBoardColumn[]) {
  const { data, error } = await ctx.supabase
    .from("project_columns")
    .select("id, name, position, system_key, studio_column_id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", projectId);
  if (error) return { error: error.message };

  const existing: ProjectColumnLink[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    position: row.position as number,
    systemKey: systemKeyOf(row.system_key as string | null),
    studioColumnId: (row.studio_column_id as string | null) ?? null,
  }));
  const plan = planColumnSync(existing, columns);
  const touched = [...plan.update.map((row) => row.id), ...plan.remove.map((row) => row.id)];
  if (touched.length > 0) {
    const { error: clearError } = await ctx.supabase
      .from("project_columns")
      .update({ system_key: null })
      .eq("organization_id", ctx.org.id)
      .eq("project_id", projectId)
      .in("id", touched);
    if (clearError) return { error: clearError.message };
  }

  for (const row of plan.update) {
    const { error: updateError } = await ctx.supabase
      .from("project_columns")
      .update({
        name: row.name,
        position: row.position,
        system_key: row.systemKey,
        studio_column_id: row.studioColumnId,
      })
      .eq("id", row.id)
      .eq("organization_id", ctx.org.id);
    if (updateError) return { error: updateError.message };
  }

  let insertedTodo: string | null = null;
  for (const row of plan.insert) {
    const { data: created, error: insertError } = await ctx.supabase
      .from("project_columns")
      .insert({
        organization_id: ctx.org.id,
        project_id: projectId,
        name: row.name,
        position: row.position,
        system_key: row.systemKey,
        studio_column_id: row.studioColumnId,
      })
      .select("id")
      .single();
    if (insertError || !created) return { error: insertError?.message ?? "Could not add a column" };
    if (row.systemKey === "todo") insertedTodo = created.id as string;
  }

  for (const row of plan.remove) {
    const target = row.moveTasksToId ?? insertedTodo;
    if (!target) return { error: "Keep a To do list for cards to land in" };
    const landing = plan.update.find((item) => item.id === target);
    const status =
      landing?.systemKey === "todo" || landing?.systemKey === "doing" || landing?.systemKey === "done"
        ? landing.systemKey
        : "doing";
    const { error: moveError } = await ctx.supabase
      .from("tasks")
      .update({ column_id: target, status })
      .eq("organization_id", ctx.org.id)
      .eq("column_id", row.id);
    if (moveError) return { error: moveError.message };
    const { error: deleteError } = await ctx.supabase
      .from("project_columns")
      .delete()
      .eq("id", row.id)
      .eq("organization_id", ctx.org.id);
    if (deleteError) return { error: deleteError.message };
  }
  return { ok: true as const };
}

export async function saveBoardColumnsAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only an admin can change the studio board columns" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("columns") ?? ""));
  } catch {
    return { error: "Column list is invalid" };
  }
  if (!Array.isArray(raw)) return { error: "Column list is invalid" };
  const validated = validateBoardColumns(
    raw.map((item, index) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        position: index,
        systemKey:
          row.systemKey === "todo" || row.systemKey === "doing" || row.systemKey === "done"
            ? row.systemKey
            : null,
      };
    }),
  );
  if ("error" in validated) return validated;
  const shared = String(formData.get("shared") ?? "") === "on";

  const { data: orgRow, error: loadError } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .single();
  if (loadError) return { error: loadError.message };
  const settings =
    orgRow?.settings && typeof orgRow.settings === "object"
      ? (orgRow.settings as Record<string, unknown>)
      : {};
  const { error: saveError } = await ctx.supabase
    .from("organizations")
    .update({
      settings: {
        ...settings,
        board: { shared, columns: validated.columns },
      },
    })
    .eq("id", ctx.org.id);
  if (saveError) return { error: saveError.message };

  if (shared) {
    const { data: projects, error: projectError } = await ctx.supabase
      .from("projects")
      .select("id")
      .eq("organization_id", ctx.org.id);
    if (projectError) return { error: projectError.message };
    for (const project of projects ?? []) {
      const synced = await syncProject(ctx, project.id as string, validated.columns);
      if ("error" in synced) return synced;
    }
  }

  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/board`);
  revalidatePath(`/${orgSlug}/projects`);
  return { ok: true as const };
}

export async function moveTaskToSharedColumnAction(
  orgSlug: string,
  taskId: string,
  studioColumnId: string,
) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  const { data: column } = await ctx.supabase
    .from("project_columns")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", task.project_id)
    .eq("studio_column_id", studioColumnId)
    .maybeSingle();
  if (!column) return { error: "That list isn't on this project yet" };

  const { data: siblings } = await ctx.supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("project_id", task.project_id)
    .eq("column_id", column.id)
    .order("position");
  const ordered = [...(siblings ?? []).map((row) => row.id as string).filter((id) => id !== taskId), taskId];
  return moveTaskAction(orgSlug, taskId, column.id as string, ordered);
}
