"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/shared/db/require-user";
import {
  NOTIFICATION_CATEGORIES,
  isNotificationCategory,
  type NotificationCategory,
  type NotificationPrefs,
  type NotificationRecord,
} from "@/modules/notifications/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Org-scoped views include global (org-less) notifications too. */
function orgScope(organizationId: string | null | undefined) {
  if (!organizationId || !UUID_RE.test(organizationId)) return null;
  return `organization_id.eq.${organizationId},organization_id.is.null`;
}

const NOTIFICATION_COLUMNS =
  "id, category, title, body, href, read_at, created_at, organization_id, actor_id";

export async function listNotificationsAction(options: {
  organizationId?: string | null;
  unreadOnly?: boolean;
  category?: NotificationCategory | null;
  before?: string | null;
  limit?: number;
}): Promise<NotificationRecord[]> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(options.limit ?? 20, 100));
  const scope = orgScope(options.organizationId);
  if (scope) query = query.or(scope);
  if (options.unreadOnly) query = query.is("read_at", null);
  if (options.category) query = query.eq("category", options.category);
  if (options.before) query = query.lt("created_at", options.before);

  const { data, error } = await query;
  if (error) return [];

  const actorIds = [
    ...new Set(
      (data ?? []).map((row) => row.actor_id as string | null).filter(Boolean),
    ),
  ] as string[];
  const actors = new Map<string, { name: string; avatarUrl: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", actorIds);
    for (const profile of profiles ?? []) {
      actors.set(profile.id as string, {
        name:
          (profile.display_name as string | null)?.trim() ||
          (profile.email as string | null)?.split("@")[0] ||
          "Someone",
        avatarUrl: (profile.avatar_url as string | null) ?? null,
      });
    }
  }

  return (data ?? []).map((row) => {
    const category = String(row.category ?? "general");
    return {
      id: row.id as string,
      category: isNotificationCategory(category) ? category : "general",
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      href: (row.href as string | null) ?? null,
      readAt: (row.read_at as string | null) ?? null,
      createdAt: row.created_at as string,
      organizationId: (row.organization_id as string | null) ?? null,
      actor: row.actor_id ? (actors.get(row.actor_id as string) ?? null) : null,
    };
  });
}

export async function countUnreadNotifications(organizationId?: string | null) {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  const scope = orgScope(organizationId);
  if (scope) query = query.or(scope);
  const { count } = await query;
  return count ?? 0;
}

export async function markNotificationReadAction(
  notificationId: string,
  read = true,
) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function markAllNotificationsReadAction(
  organizationId?: string | null,
) {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  const scope = orgScope(organizationId);
  if (scope) query = query.or(scope);
  const { error } = await query;
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteNotificationAction(notificationId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.notification_prefs as NotificationPrefs | null) ?? {};
}

export async function updateNotificationPrefsAction(
  orgSlug: string,
  formData: FormData,
) {
  const { supabase, user } = await requireUser();
  const prefs: NotificationPrefs = {};
  for (const category of NOTIFICATION_CATEGORIES) {
    prefs[category] = { email: formData.get(`email_${category}`) === "on" };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: prefs })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/notifications`);
  return { ok: true as const };
}
