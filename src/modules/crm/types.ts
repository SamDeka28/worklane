export const DEFAULT_LEAD_STAGES = [
  { name: "New", slug: "new", systemKey: null },
  { name: "Contacted", slug: "contacted", systemKey: null },
  { name: "Discovery", slug: "discovery", systemKey: null },
  { name: "Qualified", slug: "qualified", systemKey: null },
  { name: "Proposal", slug: "proposal", systemKey: null },
  { name: "Negotiation", slug: "negotiation", systemKey: null },
  { name: "Won", slug: "won", systemKey: "won" as const },
  { name: "Lost", slug: "lost", systemKey: "lost" as const },
] as const;

/** @deprecated Prefer org stages from `listLeadStages`. Kept for fallback labels. */
export const LEAD_STAGES = DEFAULT_LEAD_STAGES.map((stage) => stage.slug);

export type LeadStage = string;

export type LeadStageSystemKey = "won" | "lost";

export type LeadStageRecord = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  position: number;
  systemKey: LeadStageSystemKey | null;
  /** Win likelihood in basis points; null falls back to a position-based guess. */
  probabilityBps: number | null;
};

export type LeadOrigin = "manual" | "intake" | "import";

export type LeadRecord = {
  id: string;
  organizationId: string;
  name: string;
  company: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  source: string | null;
  estimatedValueMinor: bigint | null;
  currency: "USD" | "INR";
  closeOn: string | null;
  ownerUserId: string | null;
  tags: string[];
  notes: string | null;
  notesDoc: Record<string, unknown> | null;
  stage: LeadStage;
  position: number;
  clientId: string | null;
  dealShareBps: Record<string, unknown> | null;
  nextAction: string | null;
  nextActionOn: string | null;
  lastTouchedAt: string;
  closedAt: string | null;
  lostReason: string | null;
  lostNote: string | null;
  origin: LeadOrigin;
  createdAt: string;
  updatedAt: string;
};

export const LEAD_ACTIVITY_KINDS = ["call", "email", "meeting", "message", "note"] as const;

export type LeadActivityKind = (typeof LEAD_ACTIVITY_KINDS)[number] | "form";

export const LEAD_ACTIVITY_LABEL: Record<LeadActivityKind, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  message: "Message",
  note: "Note",
  form: "Form enquiry",
};

export type LeadActivityRecord = {
  id: string;
  leadId: string;
  kind: LeadActivityKind;
  body: string | null;
  happenedAt: string;
  actorId: string | null;
  actorLabel: string | null;
  actorAvatarUrl: string | null;
  /** Set when the entry is an email sent from Worklane. */
  email?: LeadEmailInfo | null;
};

export type LeadEmailInfo = {
  id: string;
  toEmail: string;
  subject: string;
  trackOpens: boolean;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
};

/** One row in the lead timeline: a logged touchpoint or a stage move. */
export type LeadTimelineItem =
  | { type: "activity"; at: string; activity: LeadActivityRecord }
  | {
      type: "stage";
      at: string;
      id: string;
      from: string | null;
      to: string;
      actorLabel: string | null;
      actorAvatarUrl: string | null;
    };

export type CrmMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export type FollowState = "overdue" | "today" | "upcoming" | "none";

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function followState(lead: Pick<LeadRecord, "nextActionOn">, today = todayIso()): FollowState {
  if (!lead.nextActionOn) return "none";
  if (lead.nextActionOn < today) return "overdue";
  if (lead.nextActionOn === today) return "today";
  return "upcoming";
}

export function daysSince(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export function isStale(
  lead: Pick<LeadRecord, "lastTouchedAt">,
  staleDays: number,
  now = Date.now(),
) {
  return staleDays > 0 && daysSince(lead.lastTouchedAt, now) >= staleDays;
}

export function stageProbabilityBps(stage: LeadStageRecord, stages: LeadStageRecord[]): number {
  if (stage.probabilityBps != null) return stage.probabilityBps;
  if (stage.systemKey === "won") return 10_000;
  if (stage.systemKey === "lost") return 0;
  const open = openPipelineStages(stages);
  const index = open.findIndex((row) => row.id === stage.id);
  return Math.round((10_000 * (index + 1)) / (open.length + 1));
}

export function stageLabel(
  slug: string,
  stages: LeadStageRecord[],
): string {
  return stages.find((stage) => stage.slug === slug)?.name ?? slug.replaceAll("_", " ");
}

export function isWonStage(slug: string, stages: LeadStageRecord[] = []) {
  const match = stages.find((stage) => stage.slug === slug);
  if (match) return match.systemKey === "won";
  return slug === "won";
}

export function isLostStage(slug: string, stages: LeadStageRecord[] = []) {
  const match = stages.find((stage) => stage.slug === slug);
  if (match) return match.systemKey === "lost";
  return slug === "lost";
}

export function isClosedStage(slug: string, stages: LeadStageRecord[] = []) {
  return isWonStage(slug, stages) || isLostStage(slug, stages);
}

export function openPipelineStages(stages: LeadStageRecord[]) {
  return stages.filter((stage) => stage.systemKey == null);
}

/** Fallback when `lead_stages` is empty (e.g. migration not yet applied). */
export function stagesOrDefault(stages: LeadStageRecord[]): LeadStageRecord[] {
  if (stages.length > 0) return stages;
  return DEFAULT_LEAD_STAGES.map((stage, position) => ({
    id: `default-${stage.slug}`,
    organizationId: "",
    name: stage.name,
    slug: stage.slug,
    position,
    systemKey: stage.systemKey,
    probabilityBps: null,
  }));
}

const STAGE_TONES = [
  "planning",
  "hourly",
  "due",
  "partial",
  "due",
  "partial",
] as const;

export type LeadStageTone = (typeof STAGE_TONES)[number] | "paid" | "cancelled";

export function stageTone(
  slug: string,
  stages: LeadStageRecord[] = [],
): LeadStageTone {
  const match = stages.find((stage) => stage.slug === slug);
  if (match?.systemKey === "won" || (!match && slug === "won")) return "paid";
  if (match?.systemKey === "lost" || (!match && slug === "lost")) return "cancelled";
  const index = match?.position ?? stages.findIndex((stage) => stage.slug === slug);
  if (index < 0) return "planning";
  return STAGE_TONES[index % STAGE_TONES.length] ?? "planning";
}

export function slugifyStageName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `stage-${Date.now().toString(36)}`;
}
