import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { listNotificationsForUser } from "@/modules/team/actions";

/** Streamed so org layout + page work are not blocked on the notifications query. */
export async function HeaderNotifications() {
  const notifications = await listNotificationsForUser(20).catch(() => []);
  return <NotificationsMenu notifications={notifications} />;
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
