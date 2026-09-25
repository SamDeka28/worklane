"use client";

import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { NotificationItem } from "@/modules/notifications/components/notification-item";
import { useNotifications } from "@/modules/notifications/components/use-notifications";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_META,
  isNotificationCategory,
  type NotificationRecord,
} from "@/modules/notifications/types";

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function NotificationsInbox({
  organizationId,
  userId,
  initial,
  initialUnread,
}: {
  organizationId: string;
  userId: string;
  initial: NotificationRecord[];
  initialUnread: number;
}) {
  const inbox = useNotifications({
    userId,
    organizationId,
    initial,
    initialUnread,
    pageSize: 30,
  });
  const unreadOnly = Boolean(inbox.filter.unreadOnly);

  const groups: { label: string; items: NotificationRecord[] }[] = [];
  for (const item of inbox.items) {
    const label = dayLabel(item.createdAt);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-muted/60 p-0.5 text-sm">
          {(
            [
              ["all", "All"],
              ["unread", `Unread${inbox.unread ? ` · ${inbox.unread}` : ""}`],
            ] as const
          ).map(([id, label]) => {
            const active = (id === "unread") === unreadOnly;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  inbox.setFilter({
                    ...inbox.filter,
                    unreadOnly: id === "unread",
                  })
                }
                className={cn(
                  "rounded-[0.625rem] px-3 py-1 font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <NativeSelect
          aria-label="Category"
          className="h-8 w-40"
          value={inbox.filter.category ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            inbox.setFilter({
              ...inbox.filter,
              category: isNotificationCategory(value) ? value : null,
            });
          }}
        >
          <option value="">All categories</option>
          {NOTIFICATION_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {NOTIFICATION_CATEGORY_META[category].label}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={inbox.unread === 0}
          onClick={() => void inbox.markAllRead()}
        >
          <CheckCheck />
          Mark all read
        </Button>
      </div>

      {inbox.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted/30 px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Bell className="size-5" />
          </span>
          <p className="text-sm font-medium">
            {unreadOnly ? "You’re all caught up" : "Nothing here yet"}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            You’ll be notified about assignments, comments on your tasks,
            payments, and access changes.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.label} className="grid gap-1">
              <p className="px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              <div className="grid gap-0.5">
                {group.items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onOpen={inbox.open}
                    onToggleRead={(row) => void inbox.toggleRead(row)}
                    onDelete={(row) => void inbox.remove(row)}
                  />
                ))}
              </div>
            </section>
          ))}
          {inbox.hasMore ? (
            <Button
              type="button"
              variant="outline"
              className="justify-self-center"
              disabled={inbox.loading}
              onClick={() => void inbox.loadMore()}
            >
              {inbox.loading ? "Loading…" : "Load older"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
