"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/shared/db/supabase/browser";
import {
  countUnreadNotifications,
  deleteNotificationAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import type {
  NotificationCategory,
  NotificationRecord,
} from "@/modules/notifications/types";

type Filter = { unreadOnly?: boolean; category?: NotificationCategory | null };

export function useNotifications({
  userId,
  organizationId,
  initial,
  initialUnread,
  pageSize = 20,
  toastOnNew = false,
}: {
  userId: string;
  organizationId: string;
  initial: NotificationRecord[];
  initialUnread: number;
  pageSize?: number;
  toastOnNew?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [filter, setFilterState] = useState<Filter>({});
  const [hasMore, setHasMore] = useState(initial.length >= pageSize);
  const [loading, setLoading] = useState(false);
  const filterRef = useRef(filter);

  const reload = useCallback(
    async (next: Filter = filterRef.current) => {
      setLoading(true);
      const [list, count] = await Promise.all([
        listNotificationsAction({ organizationId, limit: pageSize, ...next }),
        countUnreadNotifications(organizationId),
      ]);
      setLoading(false);
      if (filterRef.current !== next) return;
      setItems(list);
      setUnread(count);
      setHasMore(list.length >= pageSize);
    },
    [organizationId, pageSize],
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    // Topic must be unique per hook instance: the bell and inbox can mount together,
    // and supabase-js returns the already-subscribed channel for a reused topic.
    const channel = supabase
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            organization_id?: string | null;
            title?: string;
            body?: string | null;
          };
          if (row?.organization_id && row.organization_id !== organizationId)
            return;
          if (payload.eventType === "INSERT" && toastOnNew && row?.title) {
            toast(row.title, { description: row.body ?? undefined });
          }
          void reload();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, organizationId, reload, toastOnNew]);

  function setFilter(next: Filter) {
    filterRef.current = next;
    setFilterState(next);
    void reload(next);
  }

  async function loadMore() {
    const last = items.at(-1);
    if (!last || loading) return;
    setLoading(true);
    const more = await listNotificationsAction({
      organizationId,
      limit: pageSize,
      before: last.createdAt,
      ...filterRef.current,
    });
    setItems((prev) => [...prev, ...more]);
    setHasMore(more.length >= pageSize);
    setLoading(false);
  }

  async function toggleRead(item: NotificationRecord, forceRead?: boolean) {
    const read = forceRead ?? !item.readAt;
    if (read === Boolean(item.readAt)) return;
    setItems((prev) =>
      prev
        .map((row) =>
          row.id === item.id
            ? { ...row, readAt: read ? new Date().toISOString() : null }
            : row,
        )
        .filter((row) => !(filterRef.current.unreadOnly && row.readAt)),
    );
    setUnread((count) => Math.max(0, count + (read ? -1 : 1)));
    const result = await markNotificationReadAction(item.id, read);
    if ("error" in result) void reload();
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((prev) =>
      filterRef.current.unreadOnly
        ? []
        : prev.map((row) => ({ ...row, readAt: row.readAt ?? now })),
    );
    setUnread(0);
    const result = await markAllNotificationsReadAction(organizationId);
    if ("error" in result) void reload();
  }

  async function remove(item: NotificationRecord) {
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    if (!item.readAt) setUnread((count) => Math.max(0, count - 1));
    const result = await deleteNotificationAction(item.id);
    if ("error" in result) void reload();
  }

  function open(item: NotificationRecord) {
    void toggleRead(item, true);
    if (!item.href) return;
    try {
      // Hrefs are absolute app URLs (for email); navigate in-app by path.
      const url = new URL(item.href, window.location.origin);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      window.location.assign(item.href);
    }
  }

  return {
    items,
    unread,
    filter,
    setFilter,
    hasMore,
    loading,
    loadMore,
    toggleRead,
    markAllRead,
    remove,
    open,
  };
}
