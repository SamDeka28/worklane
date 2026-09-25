"use client";

import {
  Bell,
  Briefcase,
  CheckSquare,
  Handshake,
  MessageSquare,
  MoreHorizontal,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AvatarMark } from "@/components/studio/avatar-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  NotificationCategory,
  NotificationRecord,
} from "@/modules/notifications/types";

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  tasks: CheckSquare,
  comments: MessageSquare,
  projects: Briefcase,
  leads: Target,
  finance: Wallet,
  partners: Handshake,
  team: Users,
  general: Bell,
};

const CATEGORY_TONE: Record<NotificationCategory, string> = {
  tasks: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  comments: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  projects: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  leads: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  finance: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partners: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  team: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  general: "bg-muted text-muted-foreground",
};

export function relativeTime(iso: string, now = Date.now()) {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function NotificationItem({
  item,
  onOpen,
  onToggleRead,
  onDelete,
  compact = false,
}: {
  item: NotificationRecord;
  onOpen: (item: NotificationRecord) => void;
  onToggleRead: (item: NotificationRecord) => void;
  onDelete: (item: NotificationRecord) => void;
  compact?: boolean;
}) {
  const Icon = CATEGORY_ICON[item.category];
  const unread = !item.readAt;

  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-muted/60",
        unread && "bg-primary/[0.04]",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none"
        aria-label={item.title}
      />
      <div className="relative shrink-0">
        {item.actor ? (
          <AvatarMark
            name={item.actor.name}
            src={item.actor.avatarUrl}
            size="sm"
          />
        ) : (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full",
              CATEGORY_TONE[item.category],
            )}
          >
            <Icon className="size-3.5" />
          </span>
        )}
        {item.actor ? (
          <span
            className={cn(
              "absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-popover",
              CATEGORY_TONE[item.category],
            )}
          >
            <Icon className="size-2.5" />
          </span>
        ) : null}
      </div>
      <div className="pointer-events-none min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            unread ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {item.title}
        </p>
        {item.body ? (
          <p
            className={cn(
              "mt-0.5 text-xs leading-relaxed text-muted-foreground",
              compact ? "line-clamp-2" : "line-clamp-3",
            )}
          >
            {item.body}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          {relativeTime(item.createdAt)}
        </p>
      </div>
      <div className="relative flex shrink-0 flex-col items-end gap-1">
        {unread ? (
          <span
            className="mt-1.5 size-2 rounded-full bg-primary"
            aria-label="Unread"
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                aria-label="Notification actions"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggleRead(item)}>
              {unread ? "Mark as read" : "Mark as unread"}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(item)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
