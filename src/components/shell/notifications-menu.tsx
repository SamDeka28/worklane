"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationReadAction } from "@/modules/team/actions";

export type HeaderNotification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsMenu({
  notifications,
}: {
  notifications: HeaderNotification[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = notifications.filter((row) => !row.readAt).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative rounded-full">
            <Bell className="size-4" />
            {unread > 0 ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-1">
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          notifications.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="flex cursor-pointer flex-col items-start gap-0.5 py-2.5"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  await markNotificationReadAction(item.id);
                  if (item.href) router.push(item.href);
                  else router.refresh();
                });
              }}
            >
              <span className={`text-sm ${item.readAt ? "text-muted-foreground" : "font-medium"}`}>
                {item.title}
              </span>
              {item.body ? (
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
