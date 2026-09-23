"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  const [navOpen, setNavOpen] = useState(false);
  const base = `/${org.slug}`;
  const rest = pathname.replace(`/${org.slug}`, "").split("/").filter(Boolean)[0] ?? "";
  const title = TITLES[rest] ?? org.name;
  const display =
    user.displayName?.trim() || user.email?.split("@")[0] || "You";

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <header className="lane-panel flex h-12 shrink-0 items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            }
          />
          <SheetContent
            side="left"
            showCloseButton={false}
            className="data-[side=left]:inset-y-2 data-[side=left]:left-2 data-[side=left]:h-auto data-[side=left]:w-[min(100%-1rem,18rem)] data-[side=left]:rounded-3xl data-[side=left]:border-0 data-[side=left]:p-3 data-[side=left]:shadow-soft"
          >
            <AppSidebar
              org={org}
              orgs={orgs}
              permissions={permissions}
              role={role}
              user={user}
              expanded
              onNavigate={() => setNavOpen(false)}
              className="flex h-full w-full rounded-none shadow-none ring-0"
            />
          </SheetContent>
        </Sheet>
        <BrandMark size={22} className="shrink-0" />
      </div>
      <h1 className="min-w-0 truncate text-lg font-bold tracking-tight sm:text-xl">
        {title}
      </h1>
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
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Search"
          className="md:hidden"
          onClick={() => window.dispatchEvent(new Event("worklane:open-command"))}
        >
          <Search className="size-4" />
        </Button>
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
                  className="gap-1.5 px-2 sm:px-3"
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
            className="flex items-center gap-2 rounded-lg bg-muted p-1 sm:py-1 sm:pr-2.5 sm:pl-1"
          >
            <AvatarMark name={display} src={user.avatarUrl} size="sm" />
            <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
              {display}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52 p-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-2.5 font-normal">
                <p className="truncate text-sm font-medium">{display}</p>
                {user.email ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
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
