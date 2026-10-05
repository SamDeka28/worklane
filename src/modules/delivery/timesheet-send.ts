import type { OrgContext } from "@/modules/identity/org";
import { renderTimesheetPdfBuffer } from "@/modules/delivery/timesheet-pdf";
import { personalEmailHtml, personalEmailText } from "@/shared/email";
import { parseEmailAttachments } from "@/shared/email/attachments";
import type { EmailAttachmentPayload } from "@/modules/emails/types";
import { sendTrackedApplicationEmail } from "@/modules/emails/application-send";
import { asIsoCurrency } from "@/shared/money";

export async function sendProjectTimesheetForContext(
  ctx: OrgContext,
  projectId: string,
  month: string,
  input: { to: string; cc?: string; subject: string; body: string; attachments?: EmailAttachmentPayload[] },
): Promise<{ ok: true; to: string; cc: string[] } | { error: string }> {
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

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, name, clients(name, currency)")
    .eq("organization_id", ctx.org.id)
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found" };
  const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;

  const [{ data: logs }, { data: tasks }] = await Promise.all([
    ctx.supabase
      .from("work_logs")
      .select("worked_on, task_id, description, hours_millis, hourly_rate_minor, fixed_minor, created_at")
      .eq("organization_id", ctx.org.id)
      .eq("project_id", projectId),
    ctx.supabase.from("tasks").select("id, title").eq("organization_id", ctx.org.id).eq("project_id", projectId),
  ]);
  const taskNames = new Map((tasks ?? []).map((task) => [task.id as string, task.title as string]));
  const entries = (logs ?? [])
    .filter((log) => String(log.worked_on).slice(0, 7) === month)
    .sort((a, b) => String(a.worked_on).localeCompare(String(b.worked_on)) || String(a.created_at).localeCompare(String(b.created_at)))
    .map((log) => ({
      workedOn: log.worked_on as string,
      task: log.task_id ? taskNames.get(log.task_id as string) ?? "" : "",
      description: (log.description as string | null) ?? "",
      hoursMillis: Number(log.hours_millis ?? 0),
      hourlyRateMinor: log.hourly_rate_minor == null ? null : BigInt(log.hourly_rate_minor as number),
      fixedMinor: log.fixed_minor == null ? null : BigInt(log.fixed_minor as number),
    }));
  const projectName = project.name as string;
  const attachment = await renderTimesheetPdfBuffer({
    organizationName: ctx.org.name,
    projectName,
    clientName: (client?.name as string | undefined) ?? "Client",
    month,
    currency: asIsoCurrency((client?.currency as string | undefined) ?? "USD"),
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
        filename: `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-timesheet-${month}.pdf`,
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
    metadata: { kind: "timesheet", month, to, cc },
  });
  return { ok: true, to, cc };
}
