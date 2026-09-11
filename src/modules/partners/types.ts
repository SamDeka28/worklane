import type { IsoCurrency } from "@/shared/money";

export type PartnerKind = "originator" | "participant" | "referral";

export type PartnerRecord = {
  id: string;
  name: string;
  kind: PartnerKind;
  email: string | null;
  userId: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
};

export type ProjectMemberRecord = {
  id: string;
  projectId: string;
  userId: string;
  role: "lead" | "member";
  createdAt: string;
  isYou: boolean;
};

export type DistributionLineRole = "pool" | "remainder";

export type DistributionLine = {
  partnerId: string;
  shareBps: number;
  /** Pool % of build pool, or remainder share of leftover. Effective project % is shareBps. */
  role?: DistributionLineRole;
  /** Original pool share bps (of the build pool), when role=pool and pool model used. */
  poolShareBps?: number | null;
};

export type DistributionVersion = {
  id: string;
  projectId: string;
  chargeId: string | null;
  label: string | null;
  effectiveOn: string;
  poolAmountMinor: bigint | null;
  lines: DistributionLine[];
  createdAt: string;
};

export type PartnerAllocation = {
  id: string;
  partnerId: string;
  distributionVersionId: string;
  chargeId: string;
  paymentId: string | null;
  earnedMinor: bigint;
  currency: IsoCurrency;
  earnedOn: string;
  status: "posted" | "void";
};

export type PartnerSettlement = {
  id: string;
  partnerId: string;
  amountMinor: bigint;
  currency: IsoCurrency;
  settledOn: string;
  method: string;
  memo: string | null;
  status: "posted" | "void";
};

export type PartnerBalance = {
  partnerId: string;
  name: string;
  kind: PartnerKind;
  currency: IsoCurrency;
  earnedMinor: bigint;
  settledMinor: bigint;
  payableMinor: bigint;
};

export type MonthlyRegisterRow = {
  partnerId: string;
  partnerName: string;
  currency: IsoCurrency;
  earnedMinor: bigint;
  settledMinor: bigint;
  pendingMinor: bigint;
};
