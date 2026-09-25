import {
  SoftCard,
  StudioToolbar,
  WorkSurface,
} from "@/components/studio/chrome";
import { requireOrg } from "@/modules/identity/org";
import {
  countUnreadNotifications,
  getNotificationPrefs,
  listNotificationsAction,
} from "@/modules/notifications/actions";
import { NotificationPrefsForm } from "@/modules/notifications/components/notification-prefs-form";
import { NotificationsInbox } from "@/modules/notifications/components/notifications-inbox";
import { isEmailConfigured } from "@/shared/email";

export default async function NotificationsPage({
  params,
}: PageProps<"/[orgSlug]/notifications">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const [initial, unread, prefs] = await Promise.all([
    listNotificationsAction({ organizationId: ctx.org.id, limit: 30 }),
    countUnreadNotifications(ctx.org.id),
    getNotificationPrefs(),
  ]);

  return (
    <WorkSurface>
      <StudioToolbar
        title="Notifications"
        subtitle="What’s happened across the studio"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 md:px-6">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <SoftCard className="p-3 sm:p-4">
            <NotificationsInbox
              organizationId={ctx.org.id}
              userId={ctx.userId}
              initial={initial}
              initialUnread={unread}
            />
          </SoftCard>
          <div id="settings" className="scroll-mt-4 lg:sticky lg:top-0">
            <SoftCard className="p-4 sm:p-5">
              <p className="text-sm font-semibold tracking-tight">
                Email me about
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                In-app notifications are always on. Choose what also reaches
                your inbox.
              </p>
              <NotificationPrefsForm
                orgSlug={orgSlug}
                prefs={prefs}
                emailConfigured={isEmailConfigured()}
              />
            </SoftCard>
          </div>
        </div>
      </div>
    </WorkSurface>
  );
}
