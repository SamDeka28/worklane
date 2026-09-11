import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { listMyOrgs, requireOrg } from "@/modules/identity/org";
import { RESERVED_ORG_SLUGS } from "@/modules/identity/types";
import { listNotificationsForUser } from "@/modules/team/actions";
import { notFound } from "next/navigation";

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

  return (
    <div className="lane-app flex h-svh max-h-svh gap-3 overflow-hidden p-3">
      <AppSidebar org={ctx.org} orgs={memberships.map((row) => row.org)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <AppHeader
          org={ctx.org}
          orgs={memberships.map((row) => row.org)}
          canWrite={ctx.canWrite}
          notifications={notifications}
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <CommandPalette org={ctx.org} />
    </div>
  );
}
