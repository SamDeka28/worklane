"use server";

import { requireOrg } from "@/modules/identity/org";
import { canSeeMoney } from "@/modules/identity/permissions";
import {
  MONEY_FIELDS,
  type RecordChange,
  type RecordEntityType,
  type RecordEvent,
} from "@/modules/history/types";

export async function listRecordEventsAction(
  orgSlug: string,
  entityType: RecordEntityType,
  entityId: string,
): Promise<{ events: RecordEvent[]; error?: string }> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("record_events")
    .select("id, action, actor_id, actor_label, changes, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { events: [], error: error.message };

  const actorIds = [
    ...new Set((data ?? []).map((row) => row.actor_id as string | null).filter(Boolean)),
  ] as string[];
  const avatars = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", actorIds);
    for (const profile of profiles ?? []) {
      avatars.set(String(profile.id), (profile.avatar_url as string | null) ?? null);
    }
  }

  const showMoney = canSeeMoney(ctx.permissions);
  const events: RecordEvent[] = [];
  for (const row of data ?? []) {
    const raw = (row.changes ?? {}) as Record<string, RecordChange>;
    const changes = showMoney
      ? raw
      : Object.fromEntries(Object.entries(raw).filter(([key]) => !MONEY_FIELDS.has(key)));
    if (row.action === "updated" && Object.keys(changes).length === 0) continue;
    const actorId = (row.actor_id as string | null) ?? null;
    events.push({
      id: String(row.id),
      action: row.action as RecordEvent["action"],
      actorId,
      actorLabel: (row.actor_label as string | null) ?? null,
      actorAvatarUrl: actorId ? (avatars.get(actorId) ?? null) : null,
      changes,
      createdAt: String(row.created_at),
    });
  }
  return { events };
}
