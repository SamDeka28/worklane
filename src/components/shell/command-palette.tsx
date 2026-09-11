"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FolderKanban,
  Handshake,
  Home,
  LogOut,
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
import type { Organization } from "@/modules/identity/types";

export function CommandPalette({ org }: { org: Organization }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const base = `/${org.slug}`;

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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Go">
          <CommandItem onSelect={() => go(base)}>
            <Home /> Home
          </CommandItem>
          {org.modules.crm ? (
            <CommandItem onSelect={() => go(`${base}/crm`)}>
              <Target /> Leads
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(`${base}/clients`)}>
            <Search /> Clients
          </CommandItem>
          {org.modules.delivery ? (
            <CommandItem onSelect={() => go(`${base}/projects`)}>
              <FolderKanban /> Projects
            </CommandItem>
          ) : null}
          {org.modules.documents ? (
            <CommandItem onSelect={() => go(`${base}/documents`)}>
              <FileText /> Documents
            </CommandItem>
          ) : null}
          {org.modules.finance ? (
            <CommandItem onSelect={() => go(`${base}/finance`)}>
              <Wallet /> Finance
            </CommandItem>
          ) : null}
          {org.modules.partners ? (
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
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Sell">
          {org.modules.crm ? (
            <CommandItem onSelect={() => go(`${base}/crm?new=1`)}>
              <Target /> New lead
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(`${base}/clients?new=1`)}>
            <UserPlus /> New client
          </CommandItem>
          {org.modules.documents ? (
            <CommandItem onSelect={() => go(`${base}/documents?new=1`)}>
              <FileText /> New document
            </CommandItem>
          ) : null}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Deliver">
          {org.modules.delivery ? (
            <CommandItem onSelect={() => go(`${base}/projects?new=1`)}>
              <FolderKanban /> New project
            </CommandItem>
          ) : null}
          {org.modules.delivery ? (
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
          <CommandItem onSelect={() => go(`${base}/finance?view=collect`)}>
            <Receipt /> Collect
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/finance?new=charge`)}>
            <Plus /> New charge
          </CommandItem>
          {org.modules.finance ? (
            <CommandItem onSelect={() => go(`${base}/finance?view=invoices`)}>
              <FileText /> Invoices
            </CommandItem>
          ) : null}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
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
