"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import {
  ChevronsUpDown,
  Columns3,
  FileText,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Plus,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CreateOrganizationDialog } from "@/components/shell/create-organization-dialog";
import { UserMenuItems } from "@/components/shell/user-menu-items";
import { AvatarMark } from "@/components/studio/chrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { canAccessModule, type MemberPermissions } from "@/modules/identity/permissions";
import type { ModuleKey, Organization, OrgRole } from "@/modules/identity/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: ModuleKey | null;
};

const SECTIONS: Array<{ label: string | null; items: NavItem[] }> = [
  {
    label: null,
    items: [{ href: "", label: "Home", icon: LayoutDashboard, module: null }],
  },
  {
    label: "Sell",
    items: [
      { href: "/crm", label: "Leads", icon: Target, module: "crm" },
      { href: "/clients", label: "Clients", icon: Users, module: null },
    ],
  },
  {
    label: "Deliver",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, module: "delivery" },
      { href: "/board", label: "Board", icon: Columns3, module: "delivery" },
      { href: "/documents", label: "Documents", icon: FileText, module: "documents" },
      { href: "/team", label: "Team", icon: UserRound, module: null },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/finance", label: "Finance", icon: Wallet, module: "finance" },
      { href: "/partners", label: "Partners", icon: Handshake, module: "partners" },
    ],
  },
];

function switchOrgPath(pathname: string, fromSlug: string, toSlug: string) {
  if (!pathname.startsWith(`/${fromSlug}`)) return `/${toSlug}`;
  const rest = pathname.slice(`/${fromSlug}`.length) || "";
  const kept = rest.match(
    /^(\/(?:crm|clients|projects|board|documents|team|finance|partners|settings|profile|invoices)(?:\/[^/]+)?)/,
  );
  if (kept?.[1]) return `/${toSlug}${kept[1]}`;
  if (rest === "" || rest === "/") return `/${toSlug}`;
  return `/${toSlug}`;
}

function NavLink({
  href,
  label,
  active,
  Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  Icon: typeof LayoutDashboard;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimisticActive, setOptimisticActive] = useOptimistic(active);

  return (
    <Link
      href={href}
      prefetch
      title={label}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (optimisticActive) {
          event.preventDefault();
          onNavigate?.();
          return;
        }
        event.preventDefault();
        onNavigate?.();
        start(() => {
          setOptimisticActive(true);
          router.push(href);
        });
      }}
      className={cn(
        "flex size-10 items-center justify-center rounded-lg text-sm font-medium tracking-tight transition-[background-color,box-shadow,color,opacity] duration-150 group-data-[expanded=true]/rail:h-10 group-data-[expanded=true]/rail:w-full group-data-[expanded=true]/rail:justify-start group-data-[expanded=true]/rail:gap-3 group-data-[expanded=true]/rail:rounded-lg group-data-[expanded=true]/rail:px-3 xl:h-10 xl:w-full xl:justify-start xl:gap-3 xl:rounded-lg xl:px-3",
        optimisticActive
          ? "bg-nav-active text-nav-active-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        pending && !optimisticActive && "opacity-60",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="hidden group-data-[expanded=true]/rail:inline xl:inline">
        {label}
      </span>
    </Link>
  );
}

export function AppSidebar({
  org,
  orgs = [],
  permissions,
  role,
  user,
  expanded = false,
  onNavigate,
  className,
}: {
  org: Organization;
  orgs?: Organization[];
  permissions: MemberPermissions;
  role: OrgRole;
  user: { email: string | null; displayName: string | null; avatarUrl?: string | null };
  expanded?: boolean;
  /** Called when a nav item is chosen (e.g. close mobile sheet). */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${org.slug}`;
  const display =
    user.displayName?.trim() || user.email?.split("@")[0] || "You";
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  function switchTo(slug: string) {
    if (slug === org.slug) {
      onNavigate?.();
      return;
    }
    document.cookie = `worklane_last_org=${encodeURIComponent(slug)};path=/;max-age=31536000;samesite=lax`;
    const next = switchOrgPath(pathname, org.slug, slug);
    onNavigate?.();
    router.push(next);
    router.refresh();
  }

  return (
    <aside
      data-expanded={expanded ? "true" : undefined}
      className={cn(
        "group/rail h-full min-h-0 w-[4.75rem] shrink-0 flex-col self-stretch lane-panel py-3 xl:w-56",
        expanded ? "flex w-full" : "hidden lg:flex",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 px-2.5 group-data-[expanded=true]/rail:items-stretch xl:items-stretch">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center justify-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-muted group-data-[expanded=true]/rail:justify-between xl:justify-between"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <BrandMark size={28} />
              <span className="hidden min-w-0 truncate text-sm font-semibold tracking-tight group-data-[expanded=true]/rail:inline xl:inline">
                {org.name}
              </span>
            </span>
            <ChevronsUpDown className="hidden size-3.5 shrink-0 text-muted-foreground group-data-[expanded=true]/rail:inline xl:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56 p-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2.5 py-2">Studios</DropdownMenuLabel>
              {(orgs.length > 0 ? orgs : [org]).map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => switchTo(item.slug)}
                  className={item.slug === org.slug ? "bg-muted" : undefined}
                >
                  {item.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // Defer so the menu can close before the dialog opens.
                queueMicrotask(() => setCreateOrgOpen(true));
              }}
            >
              <Plus className="size-3.5" />
              Add organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateOrganizationDialog
          open={createOrgOpen}
          onOpenChange={setCreateOrgOpen}
        />
      </div>
      <nav className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 group-data-[expanded=true]/rail:items-stretch xl:items-stretch">
        {SECTIONS.map((section) => {
          const items = section.items.filter((item) => {
            if (!item.module) return true;
            if (!org.modules[item.module]) return false;
            return canAccessModule(permissions, item.module);
          });
          if (items.length === 0) return null;
          return (
            <div key={section.label ?? "home"} className="flex flex-col gap-1">
              {section.label ? (
                <p className="hidden px-3 pt-1 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase group-data-[expanded=true]/rail:block xl:block">
                  {section.label}
                </p>
              ) : null}
              {items.map((item) => {
                const href = `${base}${item.href}`;
                const active =
                  item.href === "" ? pathname === base : pathname.startsWith(href);
                return (
                  <NavLink
                    key={href}
                    href={href}
                    label={item.label}
                    active={active}
                    Icon={item.icon}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 px-2 group-data-[expanded=true]/rail:items-stretch xl:items-stretch">
        <DropdownMenu>
          <DropdownMenuTrigger
            title={display}
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground group-data-[expanded=true]/rail:h-auto group-data-[expanded=true]/rail:w-full group-data-[expanded=true]/rail:justify-start group-data-[expanded=true]/rail:gap-2 group-data-[expanded=true]/rail:px-2 group-data-[expanded=true]/rail:py-2 xl:h-auto xl:w-full xl:justify-start xl:gap-2 xl:px-2 xl:py-2"
          >
            <AvatarMark name={display} src={user.avatarUrl} size="sm" />
            <span className="hidden min-w-0 flex-1 text-left group-data-[expanded=true]/rail:block xl:block">
              <span className="block truncate text-sm font-medium text-foreground">
                {display}
              </span>
              <span className="block truncate text-[11px] capitalize text-muted-foreground">
                {role}
                {user.email ? ` · ${user.email}` : ""}
              </span>
            </span>
            <ChevronsUpDown className="hidden size-3.5 shrink-0 text-muted-foreground group-data-[expanded=true]/rail:inline xl:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="min-w-52 p-2" sideOffset={8}>
            <UserMenuItems base={base} display={display} email={user.email} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
