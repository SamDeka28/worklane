import { NextResponse } from "next/server";
import { getProject, listTasks, listWorkLogs } from "@/modules/delivery/queries";
import { renderTimesheetPdfBuffer } from "@/modules/delivery/timesheet-pdf";
import { canAccessProjectTab } from "@/modules/identity/permissions";
import { requireOrg } from "@/modules/identity/org";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgSlug: string; projectId: string }> },
) {
  const { orgSlug, projectId } = await context.params;
  const ctx = await requireOrg(orgSlug);
  if (!canAccessProjectTab(ctx.permissions, "work")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Choose a valid month" }, { status: 400 });
  }

  const [project, logs, tasks] = await Promise.all([
    getProject(orgSlug, projectId),
    listWorkLogs(orgSlug, projectId),
    listTasks(orgSlug, projectId),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const taskNames = new Map(tasks.map((task) => [task.id, task.title]));
  const entries = logs
    .filter((log) => log.workedOn.slice(0, 7) === month)
    .sort((a, b) => a.workedOn.localeCompare(b.workedOn) || a.createdAt.localeCompare(b.createdAt))
    .map((log) => ({
      workedOn: log.workedOn,
      task: log.taskId ? taskNames.get(log.taskId) ?? "" : "",
      description: log.description ?? "",
      hoursMillis: log.hoursMillis,
      hourlyRateMinor: log.hourlyRateMinor,
      fixedMinor: log.fixedMinor,
    }));
  const buffer = await renderTimesheetPdfBuffer({
    organizationName: ctx.org.name,
    projectName: project.name,
    clientName: project.clientName,
    month,
    currency: project.currency,
    entries,
  });
  const safeProjectName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeProjectName}-timesheet-${month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
