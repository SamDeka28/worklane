export const NOTIFICATION_CATEGORIES = [
  "tasks",
  "comments",
  "projects",
  "leads",
  "finance",
  "partners",
  "team",
  "general",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string; emailByDefault: boolean }
> = {
  tasks: {
    label: "Tasks",
    description: "When a task is assigned to you",
    emailByDefault: true,
  },
  comments: {
    label: "Comments",
    description: "New comments on tasks you’re assigned to or discussing",
    emailByDefault: false,
  },
  projects: {
    label: "Projects",
    description: "When you’re added to a project",
    emailByDefault: true,
  },
  leads: {
    label: "Leads",
    description: "When someone moves a lead you own",
    emailByDefault: true,
  },
  finance: {
    label: "Payments",
    description: "Payments received from clients",
    emailByDefault: false,
  },
  partners: {
    label: "Partner payouts",
    description: "Settlements recorded for your partner profile",
    emailByDefault: true,
  },
  team: {
    label: "Team & access",
    description: "Invites accepted and changes to your access",
    emailByDefault: true,
  },
  general: {
    label: "General",
    description: "Other studio updates",
    emailByDefault: true,
  },
};

export type NotificationPrefs = Partial<
  Record<NotificationCategory, { email?: boolean }>
>;

export function isNotificationCategory(
  value: string,
): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function emailEnabled(
  prefs: NotificationPrefs | null | undefined,
  category: NotificationCategory,
) {
  const explicit = prefs?.[category]?.email;
  return explicit ?? NOTIFICATION_CATEGORY_META[category].emailByDefault;
}

export type NotificationRecord = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  organizationId: string | null;
  actor: { name: string; avatarUrl: string | null } | null;
};
