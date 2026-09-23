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
};

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
  createdAt: string;
  updatedAt: string;
};

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
