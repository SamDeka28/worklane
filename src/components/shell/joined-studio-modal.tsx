"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Columns3,
  FileText,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";

type JoinedStudioModalProps = {
  orgName: string;
  orgSlug: string;
  role: OrgRole;
  permissions: MemberPermissions;
  needsWelcome: boolean;
};

const JOURNEY_STEPS = [
  {
    key: "sell",
    title: "Sell",
    body: "Capture leads, then convert winners into clients without retyping.",
    icon: Target,
  },
  {
    key: "deliver",
    title: "Deliver",
    body: "Run projects on the board — milestones, work, and documents in one lane.",
    icon: FolderKanban,
  },
  {
    key: "collect",
    title: "Collect",
    body: "Bill what’s due, record payments, and keep partner shares internal.",
    icon: Wallet,
  },
] as const;

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
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (shouldShow) {
      setOpen(true);
      setStep(0);
    }
  }, [shouldShow]);

  const modules = useMemo(
    () =>
      [
        {
          key: "home",
          label: "Home",
          blurb: JOURNEY.home.purpose,
          icon: LayoutDashboard,
          visible: true,
        },
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
      ].filter((m) => m.visible),
    [permissions],
  );

  const primaryHref = canAccessModule(permissions, "delivery")
    ? `/${orgSlug}/projects`
    : `/${orgSlug}`;

  const totalSteps = 3;

  function stripJoinedParam() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("joined");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function finish(thenHref?: string) {
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
        if (!next) finish();
        else setOpen(true);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden border-border/50 bg-[color:var(--shell)] p-0 sm:max-w-xl">
        <div className="relative overflow-hidden border-b border-border/50 px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 20%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 50%)",
            }}
          />
          <DialogHeader className="relative gap-2 text-left">
            <div className="flex items-center justify-between gap-3 pr-8">
              <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Welcome · {step + 1} of {totalSteps}
              </p>
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 w-5 rounded-full transition-colors",
                      i <= step ? "bg-primary" : "bg-muted",
                    )}
                  />
                ))}
              </div>
            </div>
            <DialogTitle className="font-heading text-xl tracking-tight sm:text-2xl">
              {step === 0 && `Welcome to ${orgName}`}
              {step === 1 && "How Worklane moves"}
              {step === 2 && "Your access"}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-5 text-muted-foreground">
              {step === 0 && (
                <>
                  You&apos;re in as{" "}
                  <span className="capitalize text-foreground">{role}</span>. A
                  quick tour of the studio — then you can start where you have
                  access.
                </>
              )}
              {step === 1 && (
                <>One continuous lane: opportunity → delivery → payment.</>
              )}
              {step === 2 && (
                <>Modules available to you in this studio. Owners can change access later.</>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          {step === 0 ? (
            <div className="lane-inset rounded-2xl p-5">
              <p className="font-heading text-lg font-medium tracking-tight text-foreground">
                {orgName}
              </p>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                This is your studio home. Use the sidebar to move between Sell,
                Deliver, and Money — only what you can access appears there.
              </p>
              <ul className="mt-4 space-y-2 text-[13px] text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  Home shows studio health and what’s next
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  Your role: <span className="capitalize text-foreground">{role}</span>
                </li>
              </ul>
            </div>
          ) : null}

          {step === 1 ? (
            <ol className="space-y-3">
              {JOURNEY_STEPS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.key}
                    className="lane-inset flex gap-3 rounded-2xl p-4"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                        <span className="text-muted-foreground">{index + 1}.</span>
                        {item.title}
                      </span>
                      <span className="mt-1 block text-[12px] leading-4 text-muted-foreground">
                        {item.body}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {step === 2 ? (
            <ul className="grid max-h-[min(42vh,18rem)] gap-2 overflow-y-auto sm:grid-cols-2">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <li key={mod.key} className="lane-inset flex gap-3 rounded-xl p-3">
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
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="text-muted-foreground"
            onClick={() => finish()}
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
            ) : null}
            {step < totalSteps - 1 ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={pending}
                onClick={() => finish(primaryHref)}
              >
                {canAccessModule(permissions, "delivery")
                  ? "Open projects"
                  : "Go to home"}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
