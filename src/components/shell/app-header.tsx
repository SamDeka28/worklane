"use client";

import { usePathname, useRouter } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AvatarMark } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/shell/app-sidebar";
import {
  NotificationsMenu,
  type HeaderNotification,
} from "@/components/shell/notifications-menu";
import { canAccessModule, type MemberPermissions } from "@/modules/identity/permissions";
import type { Organization, OrgRole } from "@/modules/identity/types";

const TITLES: Record<string, string> = {
  "": "Overview",
  crm: "Leads",
  clients: "Clients",
  projects: "Projects",
  finance: "Finance",
  invoices: "Invoices",
  partners: "Partners",
  documents: "Documents",
  team: "Team",
  settings: "Settings",
};

export function AppHeader({
  org,
  orgs = [],
  canWrite = true,
  notifications = [],
  permissions,
  role,
  user,
}: {
  org: Organization;
  orgs?: Organization[];
  canWrite?: boolean;
  notifications?: HeaderNotification[];
  permissions: MemberPermissions;
  role: OrgRole;
  user: { email: string | null; displayName: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/${org.slug}`;
  const rest = pathname.replace(`/${org.slug}`, "").split("/").filter(Boolean)[0] ?? "";
  const title = TITLES[rest] ?? org.name;
  const display =
    user.displayName?.trim() || user.email?.split("@")[0] || "You";

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 rounded-4xl bg-card/95 px-4 shadow-soft backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="size-4" />
              </Button>
            }
          />
          <SheetContent
            side="left"
            className="data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:h-auto data-[side=left]:w-[260px] data-[side=left]:rounded-4xl data-[side=left]:border-0 data-[side=left]:p-3 data-[side=left]:shadow-soft"
          >
            <AppSidebar
              org={org}
              orgs={orgs}
              permissions={permissions}
              role={role}
              user={user}
              expanded
              className="flex h-full w-full rounded-none shadow-none"
            />
          </SheetContent>
        </Sheet>
        <BrandMark size={24} />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <Button
        variant="outline"
        size="sm"
        className="mx-auto hidden h-10 w-full max-w-md justify-start rounded-full border-0 bg-muted text-muted-foreground md:inline-flex"
        onClick={() => window.dispatchEvent(new Event("worklane:open-command"))}
      >
        <Search className="size-3.5" />
        Search
        <kbd className="ml-auto rounded-full bg-background px-1.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <NotificationsMenu notifications={notifications} />
        {canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button className="h-10 rounded-full px-4">
                  <Plus className="size-4" />
                  Create
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-44">
              {org.modules.crm && canAccessModule(permissions, "crm") ? (
                <DropdownMenuItem onClick={() => router.push(`${base}/crm?new=1`)}>
                  New lead
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => router.push(`${base}/clients?new=1`)}>
                New client
              </DropdownMenuItem>
              {org.modules.delivery && canAccessModule(permissions, "delivery") ? (
                <DropdownMenuItem onClick={() => router.push(`${base}/projects?new=1`)}>
                  New project
                </DropdownMenuItem>
              ) : null}
              {org.modules.finance && canAccessModule(permissions, "finance") ? (
                <>
                  <DropdownMenuItem onClick={() => router.push(`${base}/finance?new=charge`)}>
                    New charge
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`${base}/finance?new=payment`)}>
                    Collect
                  </DropdownMenuItem>
                </>
              ) : null}
              {org.modules.documents && canAccessModule(permissions, "documents") ? (
                <DropdownMenuItem onClick={() => router.push(`${base}/documents?new=1`)}>
                  New document
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <div className="hidden items-center gap-2 rounded-full bg-muted py-1 pr-3 pl-1 sm:flex">
          <AvatarMark name={display} size="sm" />
          <span className="max-w-28 truncate text-sm font-medium">{display}</span>
        </div>
      </div>
    </header>
  );
}
