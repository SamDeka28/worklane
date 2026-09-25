import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import {
  getAppUrl,
  notificationEmailHtml,
  notificationEmailText,
  sendEmail,
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
};

/**
 * Inserts in-app notifications and emails recipients who have that category enabled.
 * Uses the service client: recipients' rows aren't writable by the actor under RLS.
 * Never throws; notifications must not break the action that triggered them.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const recipients = [
      ...new Set(input.recipients.filter((id): id is string => Boolean(id))),
    ].filter((id) => id !== input.actorId);
    if (recipients.length === 0) return;

    const admin = createAdminSupabaseClient();
    if (!admin) return;
    const href = input.href?.startsWith("/")
      ? `${getAppUrl()}${input.href}`
      : (input.href ?? null);

    const { data: rows } = await admin
      .from("notifications")
      .insert(
        recipients.map((userId) => ({
          organization_id: input.organizationId,
          user_id: userId,
          kind: "info",
          category: input.category,
          title: input.title,
          body: input.body,
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
      .in("id", recipients);

    const sentIds: string[] = [];
    await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const email = (profile.email as string | null) ?? null;
        if (!email) return;
        const prefs =
          (profile.notification_prefs as NotificationPrefs | null) ?? {};
        if (input.email !== true && !emailEnabled(prefs, input.category))
          return;
        const mail = {
          title: input.title,
          body: input.body,
          href,
          actionLabel: input.actionLabel,
          orgName: input.orgName ?? null,
        };
        const result = await sendEmail({
          to: email,
          subject: input.title,
          html: notificationEmailHtml(mail),
          text: notificationEmailText(mail),
        });
        if (!result.ok) {
          console.error(`notify email to ${email} failed: ${result.error}`);
          return;
        }
        const row = (rows ?? []).find((item) => item.user_id === profile.id);
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
