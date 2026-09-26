export const DEFAULT_STALE_DAYS = 14;

export const DEFAULT_LOST_REASONS = [
  "Price",
  "Timing",
  "Went with someone else",
  "No response",
  "Not a fit",
];

export const DEFAULT_LEAD_SOURCES = [
  "Referral",
  "Website form",
  "LinkedIn",
  "Upwork",
  "Cold outreach",
  "Event",
];

export type LeadIntakeSettings = {
  enabled: boolean;
  code: string | null;
  headline: string;
  intro: string;
  ownerUserId: string | null;
  source: string;
  askCompany: boolean;
  askPhone: boolean;
  askBudget: boolean;
};

/** What a template is for; the composer suggests one from the lead's situation. */
export type EmailTemplatePurpose = "intro" | "follow_up" | "proposal" | "check_in" | "custom";

export type LeadEmailTemplate = {
  id: string;
  name: string;
  purpose: EmailTemplatePurpose;
  subject: string;
  body: string;
};

export const EMAIL_TEMPLATE_PURPOSES: { value: EmailTemplatePurpose; label: string }[] = [
  { value: "intro", label: "First contact" },
  { value: "follow_up", label: "Follow-up" },
  { value: "proposal", label: "Proposal nudge" },
  { value: "check_in", label: "Gone quiet" },
  { value: "custom", label: "Other" },
];

/** Placeholders filled from the lead when a template is used. */
export const EMAIL_MERGE_FIELDS = [
  { key: "first_name", label: "Contact first name" },
  { key: "contact_name", label: "Contact full name" },
  { key: "company", label: "Company" },
  { key: "lead", label: "Lead name" },
  { key: "my_name", label: "Your name" },
  { key: "org_name", label: "Studio name" },
] as const;

export const DEFAULT_EMAIL_TEMPLATES: LeadEmailTemplate[] = [
  {
    id: "intro",
    name: "First contact",
    purpose: "intro",
    subject: "Quick hello from {{org_name}}",
    body: "Hi {{first_name}},\n\nThanks for getting in touch. I'd love to hear more about what you have in mind for {{company}}.\n\nWould you have 20 minutes this week for a quick call? Happy to work around your schedule.\n\nBest,\n{{my_name}}\n{{org_name}}",
  },
  {
    id: "follow_up",
    name: "Follow-up",
    purpose: "follow_up",
    subject: "Following up",
    body: "Hi {{first_name}},\n\nJust following up on my last note. Is this still something you're looking at?\n\nIf it helps, I can share a couple of similar projects we've done, or we can jump on a short call.\n\nBest,\n{{my_name}}",
  },
  {
    id: "proposal",
    name: "Proposal nudge",
    purpose: "proposal",
    subject: "Any thoughts on the proposal?",
    body: "Hi {{first_name}},\n\nI wanted to check whether you had a chance to look at the proposal. Happy to walk through it together or adjust the scope if anything doesn't fit.\n\nWhat would be the best next step on your side?\n\nBest,\n{{my_name}}",
  },
  {
    id: "check_in",
    name: "Gone quiet",
    purpose: "check_in",
    subject: "Still on your radar?",
    body: "Hi {{first_name}},\n\nI haven't heard back, so I'm guessing the timing isn't right, and that's completely fine.\n\nShould I close this out for now, or check back in a few weeks?\n\nBest,\n{{my_name}}",
  },
];

export type CrmSettings = {
  staleDays: number;
  lostReasons: string[];
  sources: string[];
  intake: LeadIntakeSettings;
  emailTemplates: LeadEmailTemplate[];
};

const PURPOSES = new Set<string>(EMAIL_TEMPLATE_PURPOSES.map((item) => item.value));

function templates(value: unknown): LeadEmailTemplate[] {
  if (!Array.isArray(value)) return DEFAULT_EMAIL_TEMPLATES;
  const cleaned = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: String(item.id ?? "").slice(0, 40),
      name: String(item.name ?? "").trim().slice(0, 60),
      purpose: (PURPOSES.has(String(item.purpose)) ? item.purpose : "custom") as EmailTemplatePurpose,
      subject: String(item.subject ?? "").slice(0, 200),
      body: String(item.body ?? "").slice(0, 10_000),
    }))
    .filter((item) => item.id && item.name)
    .slice(0, 30);
  return cleaned;
}

function strings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 40);
  return cleaned.length > 0 ? [...new Set(cleaned)] : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function parseCrmSettings(settings: unknown): CrmSettings {
  const root =
    settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const crm =
    root.crm && typeof root.crm === "object" ? (root.crm as Record<string, unknown>) : {};
  const intake =
    crm.intake && typeof crm.intake === "object"
      ? (crm.intake as Record<string, unknown>)
      : {};
  const stale = Number(crm.staleDays);

  return {
    staleDays: Number.isFinite(stale) && stale >= 0 ? Math.min(Math.round(stale), 365) : DEFAULT_STALE_DAYS,
    lostReasons: strings(crm.lostReasons, DEFAULT_LOST_REASONS),
    sources: strings(crm.sources, DEFAULT_LEAD_SOURCES),
    intake: {
      enabled: bool(intake.enabled, false),
      code: typeof intake.code === "string" && intake.code.length >= 8 ? intake.code : null,
      headline: typeof intake.headline === "string" ? intake.headline : "",
      intro: typeof intake.intro === "string" ? intake.intro : "",
      ownerUserId: typeof intake.ownerUserId === "string" && intake.ownerUserId ? intake.ownerUserId : null,
      source: typeof intake.source === "string" && intake.source.trim() ? intake.source : "Website form",
      askCompany: bool(intake.askCompany, true),
      askPhone: bool(intake.askPhone, true),
      askBudget: bool(intake.askBudget, false),
    },
    emailTemplates: templates(crm.emailTemplates),
  };
}
