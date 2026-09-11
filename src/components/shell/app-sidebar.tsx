"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  FileText,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AvatarMark } from "@/components/studio/chrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { canAccessModule, type MemberPermissions } from "@/modules/identity/permissions";
import type { ModuleKey, Organization, OrgRole } from "@/modules/identity/types";
import { signOutAction } from "@/modules/identity/actions";

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
    /^(\/(?:crm|clients|projects|documents|team|finance|partners|settings|invoices)(?:\/[^/]+)?)/,
  );
  if (kept?.[1]) return `/${toSlug}${kept[1]}`;
  if (rest === "" || rest === "/") return `/${toSlug}`;
  return `/${toSlug}`;
}

export function AppSidebar({
  org,
  orgs = [],
  permissions,
  role,
  user,
  expanded = false,
  className,
}: {
  org: Organization;
  orgs?: Organization[];
  permissions: MemberPermissions;
  role: OrgRole;
  user: { email: string | null; displayName: string | null };
  expanded?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${org.slug}`;
  const display =
    user.displayName?.trim() || user.email?.split("@")[0] || "You";

  function switchTo(slug: string) {
    if (slug === org.slug) return;
    document.cookie = `worklane_last_org=${encodeURIComponent(slug)};path=/;max-age=31536000;samesite=lax`;
    const next = switchOrgPath(pathname, org.slug, slug);
    router.push(next);
    router.refresh();
  }

  return (
    <aside
      data-expanded={expanded ? "true" : undefined}
      className={cn(
        "group/rail hidden h-full min-h-0 w-[4.75rem] shrink-0 flex-col self-stretch rounded-4xl bg-card py-4 shadow-soft lg:flex xl:w-56",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 px-3 group-data-[expanded=true]/rail:items-stretch xl:items-stretch">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-1 py-1.5 text-left hover:bg-muted group-data-[expanded=true]/rail:justify-between xl:justify-between"
          >
            <span className="flex min-w-0 items-center gap-2">
              <BrandMark size={28} />
              <span className="hidden min-w-0 truncate text-sm font-semibold group-data-[expanded=true]/rail:inline xl:inline">
                {org.name}
              </span>
            </span>
            {orgs.length > 0 ? (
              <ChevronsUpDown className="hidden size-3.5 shrink-0 text-muted-foreground group-data-[expanded=true]/rail:inline xl:inline" />
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Studios</DropdownMenuLabel>
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
          </DropdownMenuContent>
        </DropdownMenu>
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
                <p className="hidden px-3 pt-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase group-data-[expanded=true]/rail:block xl:block">
                  {section.label}
                </p>
              ) : null}
              {items.map((item) => {
                const href = `${base}${item.href}`;
                const active =
                  item.href === "" ? pathname === base : pathname.startsWith(href);
                const Icon = item.icon;
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch
                    title={item.label}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-2xl text-sm transition-all duration-200 group-data-[expanded=true]/rail:h-11 group-data-[expanded=true]/rail:w-full group-data-[expanded=true]/rail:justify-start group-data-[expanded=true]/rail:gap-3 group-data-[expanded=true]/rail:px-3 xl:h-11 xl:w-full xl:justify-start xl:gap-3 xl:px-3",
                      active
                        ? "bg-[#1E2A4A] text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden group-data-[expanded=true]/rail:inline xl:inline">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 px-2 group-data-[expanded=true]/rail:items-stretch xl:items-stretch">
        <div className="mb-1 hidden items-center gap-2 rounded-2xl px-2 py-2 group-data-[expanded=true]/rail:flex xl:flex">
          <AvatarMark name={display} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{display}</p>
            <p className="truncate text-[10px] capitalize text-muted-foreground">
              {role}
              {user.email ? ` · ${user.email}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 group-data-[expanded=true]/rail:items-stretch xl:items-stretch">
          <Link
            href={`${base}/settings`}
            prefetch
            title="Settings"
            className="flex size-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground group-data-[expanded=true]/rail:h-11 group-data-[expanded=true]/rail:w-full group-data-[expanded=true]/rail:justify-start group-data-[expanded=true]/rail:gap-3 group-data-[expanded=true]/rail:px-3 group-data-[expanded=true]/rail:text-sm xl:h-11 xl:w-full xl:justify-start xl:gap-3 xl:px-3 xl:text-sm"
          >
            <Settings className="size-4" />
            <span className="hidden group-data-[expanded=true]/rail:inline xl:inline">
              Settings
            </span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex size-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground group-data-[expanded=true]/rail:h-11 group-data-[expanded=true]/rail:w-full group-data-[expanded=true]/rail:justify-start group-data-[expanded=true]/rail:gap-3 group-data-[expanded=true]/rail:px-3 group-data-[expanded=true]/rail:text-sm xl:h-11 xl:w-full xl:justify-start xl:gap-3 xl:px-3 xl:text-sm"
            >
              <LogOut className="size-4" />
              <span className="hidden group-data-[expanded=true]/rail:inline xl:inline">
                Sign out
              </span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
