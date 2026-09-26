import { formatDay } from "@/modules/finance/presentation";
import type { EmailTemplatePurpose, LeadEmailTemplate } from "@/modules/crm/settings";
import { followState, todayIso, type LeadRecord } from "@/modules/crm/types";

export type MergeValues = Record<string, string>;

export function leadMergeValues(
  lead: Pick<LeadRecord, "name" | "company" | "contactName">,
  sender: { name: string; orgName: string },
): MergeValues {
  const contact = lead.contactName?.trim() || "";
  return {
    first_name: contact.split(/\s+/)[0] || "there",
    contact_name: contact || lead.name,
    company: lead.company?.trim() || lead.name,
    lead: lead.name,
    my_name: sender.name,
    org_name: sender.orgName,
  };
}

/** Replaces `{{field}}` placeholders; unknown fields are left for the writer to notice. */
export function fillTemplate(text: string, values: MergeValues) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

export function unfilledFields(text: string) {
  return [...new Set([...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((match) => match[1]))];
}

/** Which template fits the lead right now: first touch, proposal out, gone quiet, or a nudge. */
export function suggestTemplate(
  templates: LeadEmailTemplate[],
  input: { emailsSent: number; proposalSent: boolean; quiet: boolean },
): LeadEmailTemplate | null {
  const purpose: EmailTemplatePurpose =
    input.emailsSent === 0
      ? "intro"
      : input.quiet
        ? "check_in"
        : input.proposalSent
          ? "proposal"
          : "follow_up";
  return templates.find((item) => item.purpose === purpose) ?? templates[0] ?? null;
}

export function replySubject(subject: string) {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

export function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

export function dueLabel(day: string) {
  const state = followState({ nextActionOn: day });
  if (state === "today") return "Today";
  if (day === addDays(1)) return "Tomorrow";
  if (state === "overdue") return `Overdue · ${formatDay(day)}`;
  return formatDay(day);
}
