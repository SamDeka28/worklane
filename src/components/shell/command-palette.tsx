"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  FolderKanban,
  Handshake,
  Home,
  LifeBuoy,
  LogOut,
  Palette,
  Plus,
  Receipt,
  Search,
  Settings,
  Target,
  UserPlus,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { signOutAction } from "@/modules/identity/actions";
import { canAccessModule, type MemberPermissions } from "@/modules/identity/permissions";
import type { Organization } from "@/modules/identity/types";
import { searchDocs } from "@/modules/docs/search";
import type { DocSearchEntry } from "@/modules/docs/types";

export function CommandPalette({
  org,
  permissions,
}: {
  org: Organization;
  permissions: MemberPermissions;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [docsIndex, setDocsIndex] = useState<DocSearchEntry[] | null>(null);
  const router = useRouter();
  const base = `/${org.slug}`;
  const docResults = useMemo(
    () => (docsIndex ? searchDocs(docsIndex, query, 6) : []),
    [docsIndex, query],
  );

  useEffect(() => {
    if (!open || docsIndex) return;
    let cancelled = false;
    void import("@/modules/docs/registry").then((mod) => {
      if (!cancelled) setDocsIndex(mod.docSearchIndex());
    });
    return () => {
      cancelled = true;
    };
  }, [open, docsIndex]);

  const openDoc = (slug: string) => {
    setOpen(false);
    window.open(`/docs/${slug}`, "_blank", "noopener");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("worklane:open-command", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("worklane:open-command", onCustom);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const routes = [
      base,
      `${base}/crm`,
      `${base}/clients`,
      `${base}/projects`,
      `${base}/board`,
      `${base}/documents`,
      `${base}/team`,
      `${base}/finance`,
      `${base}/partners`,
      `${base}/settings`,
      `${base}/profile`,
      `${base}/appearance`,
    ];
    for (const href of routes) router.prefetch(href);
  }, [open, base, router]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const show = (module: Parameters<typeof canAccessModule>[1]) =>
    org.modules[module] && canAccessModule(permissions, module);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <CommandInput
        placeholder="Search, jump, or find help…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {docResults.length === 0 ? <CommandEmpty>Nothing matches.</CommandEmpty> : null}
        {docResults.length > 0 ? (
          <>
            <CommandGroup heading="Documentation" forceMount>
              {docResults.map((entry) => (
                <CommandItem
                  key={entry.slug}
                  value={`docs:${entry.slug}`}
                  forceMount
                  onSelect={() => openDoc(entry.slug)}
                >
                  <BookOpen />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{entry.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.category} · {entry.summary}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        <CommandGroup heading="Go">
          <CommandItem onSelect={() => go(base)}>
            <Home /> Home
          </CommandItem>
          {show("crm") ? (
            <CommandItem onSelect={() => go(`${base}/crm`)}>
              <Target /> Leads
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(`${base}/clients`)}>
            <Search /> Clients
          </CommandItem>
          {show("delivery") ? (
            <CommandItem onSelect={() => go(`${base}/projects`)}>
              <FolderKanban /> Projects
            </CommandItem>
          ) : null}
          {show("documents") ? (
            <CommandItem onSelect={() => go(`${base}/documents`)}>
              <FileText /> Documents
            </CommandItem>
          ) : null}
          {show("finance") ? (
            <CommandItem onSelect={() => go(`${base}/finance`)}>
              <Wallet /> Finance
            </CommandItem>
          ) : null}
          {show("partners") ? (
            <CommandItem onSelect={() => go(`${base}/partners`)}>
              <Handshake /> Partners
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(`${base}/team`)}>
            <UserRound /> Team
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/settings`)}>
            <Settings /> Settings
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/appearance`)}>
            <Palette /> Appearance
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Sell">
          {show("crm") ? (
            <CommandItem onSelect={() => go(`${base}/crm?new=1`)}>
              <Target /> New lead
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(`${base}/clients?new=1`)}>
            <UserPlus /> New client
          </CommandItem>
          {show("documents") ? (
            <CommandItem onSelect={() => go(`${base}/documents?new=1`)}>
              <FileText /> New document
            </CommandItem>
          ) : null}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Deliver">
          {show("delivery") ? (
            <CommandItem onSelect={() => go(`${base}/projects?new=1`)}>
              <FolderKanban /> New project
            </CommandItem>
          ) : null}
          {show("delivery") ? (
            <CommandItem onSelect={() => go(`${base}/projects`)}>
              <FolderKanban /> Log work
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(`${base}/team`)}>
            <UserPlus /> Invite teammate
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Money">
          {show("finance") ? (
            <>
              <CommandItem onSelect={() => go(`${base}/finance?view=collect`)}>
                <Receipt /> Collect
              </CommandItem>
              <CommandItem onSelect={() => go(`${base}/finance?new=charge`)}>
                <Plus /> New charge
              </CommandItem>
              <CommandItem onSelect={() => go(`${base}/finance?view=invoices`)}>
                <FileText /> Invoices
              </CommandItem>
            </>
          ) : null}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              window.open("/docs", "_blank", "noopener");
            }}
          >
            <LifeBuoy /> Help &amp; documentation
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              void signOutAction();
            }}
          >
            <LogOut /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
