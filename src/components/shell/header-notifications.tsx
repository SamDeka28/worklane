import {
  countUnreadNotifications,
  listNotificationsAction,
} from "@/modules/notifications/actions";
import { NotificationsBell } from "@/modules/notifications/components/notifications-bell";

/** Streamed so org layout + page work are not blocked on the notifications query. */
export async function HeaderNotifications({
  orgSlug,
  organizationId,
  userId,
}: {
  orgSlug: string;
  organizationId: string;
  userId: string;
}) {
  const [initial, unread] = await Promise.all([
    listNotificationsAction({ organizationId, limit: 15 }).catch(() => []),
    countUnreadNotifications(organizationId).catch(() => 0),
  ]);
  return (
    <NotificationsBell
      orgSlug={orgSlug}
      organizationId={organizationId}
      userId={userId}
      initial={initial}
      initialUnread={unread}
    />
  );
}

export function HeaderNotificationsFallback() {
  return (
    <div
      aria-hidden
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground"
    >
      <span className="lane-skeleton size-4 rounded-md" />
    </div>
  );
}
