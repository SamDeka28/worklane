"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Columns3,
  FileText,
  FolderKanban,
  Handshake,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markMemberWelcomedAction } from "@/modules/identity/actions";
import {
  canAccessModule,
  type MemberPermissions,
} from "@/modules/identity/permissions";
import type { OrgRole } from "@/modules/identity/types";
import { JOURNEY } from "@/shared/journey-copy";

type WelcomeModule = {
  key: string;
  label: string;
  blurb: string;
  icon: typeof Target;
  visible: boolean;
};

type JoinedStudioModalProps = {
  orgName: string;
  orgSlug: string;
  role: OrgRole;
  permissions: MemberPermissions;
  needsWelcome: boolean;
};

export function JoinedStudioModal({
  orgName,
  orgSlug,
  role,
  permissions,
  needsWelcome,
}: JoinedStudioModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const joined = searchParams.get("joined") === "1";
  const shouldShow = needsWelcome || joined;
  const [open, setOpen] = useState(shouldShow);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  const modules: WelcomeModule[] = [
    {
      key: "crm",
      label: "Leads",
      blurb: JOURNEY.leads.purpose,
      icon: Target,
      visible: canAccessModule(permissions, "crm"),
    },
    {
      key: "clients",
      label: "Clients",
      blurb: JOURNEY.clients.purpose,
      icon: Users,
      visible: true,
    },
    {
      key: "projects",
      label: "Projects",
      blurb: JOURNEY.projects.purpose,
      icon: FolderKanban,
      visible: canAccessModule(permissions, "delivery"),
    },
    {
      key: "board",
      label: "Board",
      blurb: "Kanban for delivery work across projects",
      icon: Columns3,
      visible: canAccessModule(permissions, "delivery"),
    },
    {
      key: "documents",
      label: "Documents",
      blurb: JOURNEY.documents.purpose,
      icon: FileText,
      visible: canAccessModule(permissions, "documents"),
    },
    {
      key: "team",
      label: "Team",
      blurb: "People, invites, and studio access",
      icon: UserRound,
      visible: true,
    },
    {
      key: "finance",
      label: "Finance",
      blurb: JOURNEY.finance.purpose,
      icon: Wallet,
      visible: canAccessModule(permissions, "finance"),
    },
    {
      key: "partners",
      label: "Partners",
      blurb: JOURNEY.partners.purpose,
      icon: Handshake,
      visible: canAccessModule(permissions, "partners"),
    },
  ].filter((m) => m.visible);

  const primaryHref = canAccessModule(permissions, "delivery")
    ? `/${orgSlug}/projects`
    : `/${orgSlug}`;

  function stripJoinedParam() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("joined");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function dismiss(thenHref?: string) {
    startTransition(async () => {
      await markMemberWelcomedAction(orgSlug);
      setOpen(false);
      if (thenHref) {
        router.replace(thenHref);
      } else {
        router.replace(stripJoinedParam());
      }
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-border/60 px-6 pt-6 pb-5">
          <DialogHeader className="gap-2 text-left">
            <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Welcome
            </p>
            <DialogTitle className="font-heading text-xl tracking-tight sm:text-2xl">
              Welcome to {orgName}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-5">
              You&apos;re in as <span className="capitalize text-foreground">{role}</span>.
              Here&apos;s what you can use in this studio — access matches what the owner shared.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ul className="grid max-h-[min(52vh,22rem)] gap-2 overflow-y-auto px-6 py-4 sm:grid-cols-2">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <li
                key={mod.key}
                className="lane-inset flex gap-3 rounded-xl p-3"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">
                    {mod.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
                    {mod.blurb}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => dismiss()}
          >
            Explore on my own
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => dismiss(primaryHref)}
          >
            {canAccessModule(permissions, "delivery") ? "Open projects" : "Go to home"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
