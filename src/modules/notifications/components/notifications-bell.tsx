"use client";

import { Bell, CheckCheck, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NotificationItem } from "@/modules/notifications/components/notification-item";
import { useNotifications } from "@/modules/notifications/components/use-notifications";
import type { NotificationRecord } from "@/modules/notifications/types";

export function NotificationsBell({
  orgSlug,
  organizationId,
  userId,
  initial,
  initialUnread,
}: {
  orgSlug: string;
  organizationId: string;
  userId: string;
  initial: NotificationRecord[];
  initialUnread: number;
}) {
  const [open, setOpen] = useState(false);
  const inbox = useNotifications({
    userId,
    organizationId,
    initial,
    initialUnread,
    pageSize: 15,
    toastOnNew: true,
  });
  const unreadOnly = Boolean(inbox.filter.unreadOnly);
  const badge = inbox.unread > 99 ? "99+" : String(inbox.unread);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={
              inbox.unread > 0
                ? `Notifications, ${inbox.unread} unread`
                : "Notifications"
            }
          />
        }
      >
        <Bell
          className={cn("size-4", inbox.unread > 0 && !open && "lane-bell-ring")}
        />
        {inbox.unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center">
            {!open ? (
              <span className="absolute inset-0 rounded-full bg-primary/60 motion-safe:animate-ping" />
            ) : null}
            <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background">
              {badge}
            </span>
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-1.5rem),24rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold tracking-tight">
              Notifications
            </p>
            <div className="inline-flex rounded-lg bg-muted/60 p-0.5 text-xs">
              {(
                [
                  ["all", "All"],
                  ["unread", "Unread"],
                ] as const
              ).map(([id, label]) => {
                const active = (id === "unread") === unreadOnly;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      inbox.setFilter({ unreadOnly: id === "unread" })
                    }
                    className={cn(
                      "rounded-md px-2 py-0.5 font-medium transition-colors",
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
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={inbox.unread === 0}
            onClick={() => void inbox.markAllRead()}
          >
            <CheckCheck />
            Mark all read
          </Button>
        </div>

        <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-1.5">
          {inbox.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bell className="size-4" />
              </span>
              <p className="text-sm font-medium">
                {unreadOnly ? "You’re all caught up" : "No notifications yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                Assignments, comments, and payments will show up here.
              </p>
            </div>
          ) : (
            <div className="grid gap-0.5">
              {inbox.items.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  compact
                  onOpen={(row) => {
                    setOpen(false);
                    inbox.open(row);
                  }}
                  onToggleRead={(row) => void inbox.toggleRead(row)}
                  onDelete={(row) => void inbox.remove(row)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 px-2 py-1.5">
          <Button
            variant="ghost"
            size="xs"
            nativeButton={false}
            render={
              <Link
                href={`/${orgSlug}/notifications`}
                onClick={() => setOpen(false)}
              />
            }
          >
            View all
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Notification settings"
            nativeButton={false}
            render={
              <Link
                href={`/${orgSlug}/notifications#settings`}
                onClick={() => setOpen(false)}
              />
            }
          >
            <Settings2 />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
