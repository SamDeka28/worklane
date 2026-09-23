"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AvatarMark } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/shell/app-sidebar";
// import { ThemeToggle } from "@/components/shell/theme-toggle";
import {
  NotificationsMenu,
  type HeaderNotification,
} from "@/components/shell/notifications-menu";
import { canAccessModule, type MemberPermissions } from "@/modules/identity/permissions";
import { signOutAction } from "@/modules/identity/actions";
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
  profile: "Profile",
  board: "Board",
};

export function AppHeader({
  org,
  orgs = [],
  canWrite = true,
  notifications = [],
  notificationsSlot,
  permissions,
  role,
  user,
}: {
  org: Organization;
  orgs?: Organization[];
  canWrite?: boolean;
  notifications?: HeaderNotification[];
  /** Prefer streaming this from the layout so nav is not blocked on the query. */
  notificationsSlot?: ReactNode;
  permissions: MemberPermissions;
  role: OrgRole;
  user: { email: string | null; displayName: string | null; avatarUrl?: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const base = `/${org.slug}`;
  const rest = pathname.replace(`/${org.slug}`, "").split("/").filter(Boolean)[0] ?? "";
  const title = TITLES[rest] ?? org.name;
  const display =
    user.displayName?.trim() || user.email?.split("@")[0] || "You";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 rounded-2xl bg-card px-4 shadow-soft ring-1 ring-foreground/6 dark:ring-white/8 md:px-5">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            }
          />
          <SheetContent
            side="left"
            className="data-[side=left]:inset-y-2.5 data-[side=left]:left-2.5 data-[side=left]:h-auto data-[side=left]:w-[260px] data-[side=left]:rounded-3xl data-[side=left]:border-0 data-[side=left]:p-3 data-[side=left]:shadow-soft"
          >
            <AppSidebar
              org={org}
              orgs={orgs}
              permissions={permissions}
              role={role}
              user={user}
              expanded
              className="flex h-full w-full rounded-none shadow-none ring-0"
            />
          </SheetContent>
        </Sheet>
        <BrandMark size={24} />
      </div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <Button
        variant="outline"
        size="sm"
        className="mx-auto hidden h-8 w-full max-w-md justify-start rounded-lg border-0 bg-muted font-medium text-muted-foreground md:inline-flex"
        onClick={() => window.dispatchEvent(new Event("worklane:open-command"))}
      >
        <Search className="size-3.5" />
        Search
        <kbd className="ml-auto rounded-md bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* <ThemeToggle /> */}
        {notificationsSlot ?? <NotificationsMenu notifications={notifications} />}
        {canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Create"
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Create</span>
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
        <DropdownMenu>
          <DropdownMenuTrigger
            className="hidden items-center gap-2 rounded-lg bg-muted py-1 pr-2.5 pl-1 sm:flex"
          >
            <AvatarMark name={display} src={user.avatarUrl} size="sm" />
            <span className="max-w-28 truncate text-sm font-medium">{display}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{display}</p>
                {user.email ? (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push(`${base}/profile`)}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`${base}/settings`)}>
                Studio settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  void signOutAction();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
