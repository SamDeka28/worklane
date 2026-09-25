import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import {
  getAppUrl,
  notificationEmailHtml,
  notificationEmailText,
  sendEmail,
  type SendEmailInput,
} from "@/shared/email";
import {
  emailEnabled,
  type NotificationCategory,
  type NotificationPrefs,
} from "@/modules/notifications/types";

export type NotifyInput = {
  recipients: (string | null | undefined)[];
  organizationId: string | null;
  orgName?: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string | null;
  /** The user who caused this; never notified about their own action. */
  actorId?: string | null;
  entity?: { type: string; id: string } | null;
  actionLabel?: string;
  /** Force the email on/off regardless of preferences (e.g. invite links). */
  email?: boolean;
  /**
   * Studio owners are copied on every studio notification. Pass third-person copy for
   * them (the default copy is usually addressed to "you"), or `false` to skip owners.
   */
  ownerCopy?: { title: string; body?: string } | false;
  /** Files attached to the notification emails (e.g. a signed PDF). */
  attachments?: SendEmailInput["attachments"];
};

type Delivery = { userId: string; title: string; body: string; forceEmail: boolean };

export async function orgOwnerIds(organizationId: string): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  if (!admin) return [];
  const { data } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .eq("status", "active");
  return (data ?? []).map((row) => row.user_id as string);
}

/**
 * Inserts in-app notifications and emails recipients who have that category enabled.
 * Uses the service client: recipients' rows aren't writable by the actor under RLS.
 * Never throws; notifications must not break the action that triggered them.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const direct = new Set(
      input.recipients.filter((id): id is string => Boolean(id) && id !== input.actorId),
    );
    const deliveries: Delivery[] = [...direct].map((userId) => ({
      userId,
      title: input.title,
      body: input.body,
      forceEmail: input.email === true,
    }));

    if (input.organizationId && input.ownerCopy !== false) {
      const owners = await orgOwnerIds(input.organizationId);
      for (const ownerId of owners) {
        if (direct.has(ownerId) || ownerId === input.actorId) continue;
        deliveries.push({
          userId: ownerId,
          title: input.ownerCopy?.title ?? input.title,
          body: input.ownerCopy?.body ?? input.body,
          forceEmail: false,
        });
      }
    }
    if (deliveries.length === 0) return;

    const admin = createAdminSupabaseClient();
    if (!admin) return;
    const href = input.href?.startsWith("/")
      ? `${getAppUrl()}${input.href}`
      : (input.href ?? null);

    const { data: rows } = await admin
      .from("notifications")
      .insert(
        deliveries.map((delivery) => ({
          organization_id: input.organizationId,
          user_id: delivery.userId,
          kind: "info",
          category: input.category,
          title: delivery.title,
          body: delivery.body,
          href,
          actor_id: input.actorId ?? null,
          entity_type: input.entity?.type ?? null,
          entity_id: input.entity?.id ?? null,
        })),
      )
      .select("id, user_id");

    if (input.email === false) return;

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, notification_prefs")
      .in(
        "id",
        deliveries.map((delivery) => delivery.userId),
      );

    const sentIds: string[] = [];
    await Promise.all(
      deliveries.map(async (delivery) => {
        const profile = (profiles ?? []).find((row) => row.id === delivery.userId);
        const email = (profile?.email as string | null) ?? null;
        if (!email) return;
        const prefs = (profile?.notification_prefs as NotificationPrefs | null) ?? {};
        if (!delivery.forceEmail && !emailEnabled(prefs, input.category)) return;
        const mail = {
          title: delivery.title,
          body: delivery.body,
          href,
          actionLabel: input.actionLabel,
          orgName: input.orgName ?? null,
        };
        const result = await sendEmail({
          to: email,
          subject: delivery.title,
          html: notificationEmailHtml(mail),
          text: notificationEmailText(mail),
          attachments: input.attachments,
        });
        if (!result.ok) {
          console.error(`notify email to ${email} failed: ${result.error}`);
          return;
        }
        const row = (rows ?? []).find((item) => item.user_id === delivery.userId);
        if (row) sentIds.push(row.id as string);
      }),
    );

    if (sentIds.length > 0) {
      await admin
        .from("notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }
  } catch (error) {
    console.error("notify failed", error);
  }
}

/**
 * Studio-wide activity only owners hear about (creations, deletions, invoices).
 * Skips the lookup work when the only owner is the person who did it.
 */
export async function notifyOwners(input: {
  organizationId: string;
  orgName?: string | null;
  actorId: string;
  category: NotificationCategory;
  title: (actor: string) => string;
  body: string;
  href?: string | null;
  entity?: { type: string; id: string } | null;
  actionLabel?: string;
}): Promise<void> {
  try {
    const owners = await orgOwnerIds(input.organizationId);
    if (!owners.some((id) => id !== input.actorId)) return;
    const actor = await userLabel(input.actorId);
    await notify({
      recipients: [],
      organizationId: input.organizationId,
      orgName: input.orgName,
      category: input.category,
      title: input.title(actor),
      body: input.body,
      href: input.href,
      actorId: input.actorId,
      entity: input.entity,
      actionLabel: input.actionLabel,
    });
  } catch (error) {
    console.error("notifyOwners failed", error);
  }
}

/** Active owners and admins of an org, optionally plus members with a module's access. */
export async function orgManagerIds(
  organizationId: string,
  alsoModule?: "finance" | "crm" | "delivery" | "partners",
): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  if (!admin) return [];
  const { data } = await admin
    .from("organization_members")
    .select("user_id, role, permissions")
    .eq("organization_id", organizationId)
    .eq("status", "active");
  return (data ?? [])
    .filter((row) => {
      if (row.role === "owner" || row.role === "admin") return true;
      if (!alsoModule || row.role !== "member") return false;
      const perms = row.permissions as Record<
        string,
        { access?: string }
      > | null;
      return !perms || (perms[alsoModule]?.access ?? "none") !== "none";
    })
    .map((row) => row.user_id as string);
}

export async function userLabel(
  userId: string | null | undefined,
): Promise<string> {
  if (!userId) return "Someone";
  const admin = createAdminSupabaseClient();
  if (!admin) return "Someone";
  const { data } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  return (
    (data?.display_name as string | null)?.trim() ||
    (data?.email as string | null)?.split("@")[0] ||
    "Someone"
  );
}
