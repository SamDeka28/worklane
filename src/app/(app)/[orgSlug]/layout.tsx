import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { JoinedStudioModal } from "@/components/shell/joined-studio-modal";
import { listMyOrgs, requireOrg } from "@/modules/identity/org";
import { RESERVED_ORG_SLUGS } from "@/modules/identity/types";
import { listNotificationsForUser } from "@/modules/team/actions";

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/[orgSlug]">) {
  const { orgSlug } = await params;

  if (RESERVED_ORG_SLUGS.has(orgSlug)) {
    notFound();
  }

  const ctx = await requireOrg(orgSlug);
  const [memberships, notifications] = await Promise.all([
    listMyOrgs(),
    listNotificationsForUser(20).catch(() => []),
  ]);

  const orgs = memberships.map((row) => row.org);

  return (
    <div className="lane-app flex h-svh max-h-svh gap-3 overflow-hidden p-3">
      <AppSidebar
        org={ctx.org}
        orgs={orgs}
        permissions={ctx.permissions}
        role={ctx.role}
        user={ctx.user}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <AppHeader
          org={ctx.org}
          orgs={orgs}
          canWrite={ctx.canWrite}
          notifications={notifications}
          permissions={ctx.permissions}
          role={ctx.role}
          user={ctx.user}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <CommandPalette org={ctx.org} permissions={ctx.permissions} />
      <Suspense fallback={null}>
        <JoinedStudioModal orgName={ctx.org.name} />
      </Suspense>
    </div>
  );
}
