export type RecordEntityType = "lead" | "task";

export type RecordChange = {
  from?: unknown;
  to?: unknown;
  changed?: boolean;
};

export type RecordEvent = {
  id: string;
  action: "created" | "updated" | "deleted";
  actorId: string | null;
  actorLabel: string | null;
  actorAvatarUrl: string | null;
  changes: Record<string, RecordChange>;
  createdAt: string;
};

/** Fields hidden from members without Finance access. */
export const MONEY_FIELDS = new Set(["estimated_value_minor", "currency", "deal_share_bps"]);
