"use server";

import { revalidatePath } from "next/cache";
import { getProject, listTasks, listWorkLogs } from "@/modules/delivery/queries";
import { renderTimesheetPdfBuffer } from "@/modules/delivery/timesheet-pdf";
import { requireWritableOrg } from "@/modules/identity/org";
import { personalEmailHtml, personalEmailText } from "@/shared/email";
import { parseEmailAttachments } from "@/shared/email/attachments";
import type { EmailAttachmentPayload } from "@/modules/emails/types";
import { sendTrackedApplicationEmail } from "@/modules/emails/application-send";

export async function sendProjectTimesheetEmailAction(
  orgSlug: string,
  projectId: string,
  month: string,
  input: { to: string; cc?: string; subject: string; body: string; attachments?: EmailAttachmentPayload[] },
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireWritableOrg(orgSlug);
  const [project, logs, tasks] = await Promise.all([
    getProject(orgSlug, projectId),
    listWorkLogs(orgSlug, projectId),
    listTasks(orgSlug, projectId),
  ]);
  if (!project) return { error: "Project not found" };

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Choose a valid month" };
  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Enter a valid recipient email" };
  const cc = [...new Set((input.cc ?? "").split(/[,;\s]+/).map((email) => email.trim()).filter(Boolean))]
    .filter((email) => email.toLowerCase() !== to.toLowerCase());
  if (cc.length > 5 || cc.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: "Enter up to 5 valid CC email addresses" };
  }
  const subject = input.subject.trim().slice(0, 200);
  if (!subject) return { error: "Enter an email subject" };
  const body = input.body.trim().slice(0, 20_000);
  if (!body) return { error: "Add a message for your client" };
  const extraAttachments = parseEmailAttachments(input.attachments);
  if ("error" in extraAttachments) return { error: extraAttachments.error };

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
  const attachment = await renderTimesheetPdfBuffer({
    organizationName: ctx.org.name,
    projectName: project.name,
    clientName: project.clientName,
    month,
    currency: project.currency,
    entries,
  });
  const mailed = await sendTrackedApplicationEmail(ctx.supabase, {
    organizationId: ctx.org.id,
    userId: ctx.userId,
  }, {
    to,
    cc,
    subject,
    html: personalEmailHtml({ body }),
    text: personalEmailText({ body }),
    body,
    attachments: [
      ...extraAttachments.attachments,
      {
        filename: `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-timesheet-${month}.pdf`,
        content: attachment,
        contentType: "application/pdf",
      },
    ],
  });
  if (!mailed.ok) return { error: mailed.error || "Couldn't send the timesheet" };

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "sent",
    entity_type: "project",
    entity_id: projectId,
    metadata: { kind: "timesheet", month, to },
  });
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true };
}
