import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import {
  HeaderNotifications,
  HeaderNotificationsFallback,
} from "@/components/shell/header-notifications";
import { JoinedStudioModal } from "@/components/shell/joined-studio-modal";
import { ThemeSync } from "@/components/shell/theme-sync";
import { listMyOrgs, requireOrg } from "@/modules/identity/org";
import { RESERVED_ORG_SLUGS } from "@/modules/identity/types";

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/[orgSlug]">) {
  const { orgSlug } = await params;

  if (RESERVED_ORG_SLUGS.has(orgSlug)) {
    notFound();
  }

  // Parallel: both share requireUser() via React cache; notifications stream separately
  // so page children are not blocked on the bell query.
  const [ctx, memberships] = await Promise.all([
    requireOrg(orgSlug),
    listMyOrgs(),
  ]);

  const orgs = memberships.map((row) => row.org);

  return (
    <div className="lane-app flex h-dvh max-h-dvh gap-2 overflow-hidden overscroll-none p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] sm:gap-3.5 sm:p-3.5">
      <AppSidebar
        org={ctx.org}
        orgs={orgs}
        permissions={ctx.permissions}
        role={ctx.role}
        user={ctx.user}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-3.5">
        <AppHeader
          org={ctx.org}
          orgs={orgs}
          canWrite={ctx.canWrite}
          notificationsSlot={
            <Suspense fallback={<HeaderNotificationsFallback />}>
              <HeaderNotifications
                orgSlug={ctx.org.slug}
                organizationId={ctx.org.id}
                userId={ctx.userId}
              />
            </Suspense>
          }
          permissions={ctx.permissions}
          role={ctx.role}
          user={ctx.user}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <CommandPalette org={ctx.org} permissions={ctx.permissions} />
      <ThemeSync saved={ctx.theme} />
      <Suspense fallback={null}>
        <JoinedStudioModal
          orgName={ctx.org.name}
          orgSlug={ctx.org.slug}
          role={ctx.role}
          permissions={ctx.permissions}
          needsWelcome={ctx.needsWelcome}
        />
      </Suspense>
    </div>
  );
}
