export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const BILLING_MODES = [
  "none",
  "single_charge",
  "milestones",
  "hourly",
  "manual",
] as const;

export type BillingMode = (typeof BILLING_MODES)[number];

export const MILESTONE_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_KINDS = ["task", "bug", "feature", "chore"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export type ProjectRecord = {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  currency: "USD" | "INR";
  name: string;
  status: ProjectStatus;
  billingMode: BillingMode;
  defaultFeeBps: number;
  earnOn: "charge" | "receipt";
  contractedAmountMinor: bigint | null;
  scope: string | null;
  scopeDoc: Record<string, unknown> | null;
  startsOn: string | null;
  dueOn: string | null;
  createdAt: string;
};

export type MilestoneRecord = {
  id: string;
  projectId: string;
  name: string;
  status: MilestoneStatus;
  amountMinor: bigint | null;
  dueOn: string | null;
  description: string | null;
  descriptionDoc: Record<string, unknown> | null;
  /** @deprecated use description */
  deliverables: string | null;
  /** @deprecated use descriptionDoc */
  deliverablesDoc: Record<string, unknown> | null;
  chargeId: string | null;
  billedAt: string | null;
  createdAt: string;
};

export type MilestoneItemRecord = {
  id: string;
  milestoneId: string;
  title: string;
  position: number;
  taskId: string | null;
  createdAt: string;
};

export type BoardColumn = {
  id: string;
  projectId: string;
  name: string;
  position: number;
  systemKey: "todo" | "doing" | "done" | null;
};

export type TaskRecord = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  columnId: string | null;
  title: string;
  description: string | null;
  descriptionDoc: Record<string, unknown> | null;
  status: TaskStatus;
  priority: TaskPriority;
  kind: TaskKind;
  labels: string[];
  dueOn: string | null;
  position: number;
  /** @deprecated prefer assigneeUserIds — first assignee for legacy reads */
  assigneeUserId: string | null;
  assigneeUserIds: string[];
  commentCount: number;
  createdAt: string;
};

export type TaskAssigneeOption = {
  userId: string;
  label: string;
  avatarUrl?: string | null;
};

export type BoardTask = TaskRecord & {
  projectName?: string;
  clientName?: string;
  clientId?: string;
  /** @deprecated prefer assigneeLabels */
  assigneeLabel?: string | null;
  assigneeLabels?: string[];
};

/** @deprecated use BoardTask */
export type OrgBoardTask = BoardTask;

export type TaskComment = {
  id: string;
  taskId: string;
  body: string;
  bodyDoc: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
};

export type WorkLogRecord = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  workedOn: string;
  hoursMillis: number | null;
  hourlyRateMinor: bigint | null;
  fixedMinor: bigint | null;
  description: string | null;
  externalUrl: string | null;
  chargeId: string | null;
  createdAt: string;
};
