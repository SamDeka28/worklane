export const LEAD_STAGES = [
  "new",
  "contacted",
  "discovery",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  discovery: "Discovery",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
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

export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}
