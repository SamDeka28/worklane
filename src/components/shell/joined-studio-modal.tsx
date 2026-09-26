"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  FileText,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Lock,
  Plus,
  Search,
  Target,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type ModuleItem = {
  key: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  visible: boolean;
};

const ROLE_LABEL: Partial<Record<string, string>> = { lead: "Project lead" };

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
    body: "Run projects on the board: milestones, work, and documents in one lane.",
    icon: FolderKanban,
  },
  {
    key: "collect",
    title: "Collect",
    body: "Bill what’s due, record payments, and keep partner shares internal.",
    icon: Wallet,
  },
] as const;

const STEP_COPY = [
  { eyebrow: "Welcome", title: "", description: "" },
  { eyebrow: "The lane", title: "How Worklane moves", description: "One continuous lane from first conversation to final payment. Each stage hands off to the next, so nothing gets retyped." },
  { eyebrow: "Your access", title: "What you can open", description: "These modules are on for you in this studio. Owners can change access anytime from Team." },
] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "W";
}

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
  const [prevShouldShow, setPrevShouldShow] = useState(shouldShow);
  const continueRef = useRef<HTMLButtonElement>(null);

  if (shouldShow !== prevShouldShow) {
    setPrevShouldShow(shouldShow);
    if (shouldShow) {
      setOpen(true);
      setStep(0);
    }
  }

  const modules = useMemo<ModuleItem[]>(
    () => [
      { key: "home", label: "Home", blurb: JOURNEY.home.purpose, icon: LayoutDashboard, visible: true },
      { key: "crm", label: "Leads", blurb: JOURNEY.leads.purpose, icon: Target, visible: canAccessModule(permissions, "crm") },
      { key: "clients", label: "Clients", blurb: JOURNEY.clients.purpose, icon: Users, visible: true },
      { key: "projects", label: "Projects", blurb: JOURNEY.projects.purpose, icon: FolderKanban, visible: canAccessModule(permissions, "delivery") },
      { key: "board", label: "Board", blurb: "Kanban for delivery work across projects", icon: Columns3, visible: canAccessModule(permissions, "delivery") },
      { key: "documents", label: "Documents", blurb: JOURNEY.documents.purpose, icon: FileText, visible: canAccessModule(permissions, "documents") },
      { key: "team", label: "Team", blurb: "People, invites, and studio access", icon: UserRound, visible: true },
      { key: "finance", label: "Finance", blurb: JOURNEY.finance.purpose, icon: Wallet, visible: canAccessModule(permissions, "finance") },
      { key: "partners", label: "Partners", blurb: JOURNEY.partners.purpose, icon: Handshake, visible: canAccessModule(permissions, "partners") },
    ],
    [permissions],
  );
  const openCount = modules.filter((m) => m.visible).length;

  const canDeliver = canAccessModule(permissions, "delivery");
  const primaryHref = canDeliver ? `/${orgSlug}/projects` : `/${orgSlug}`;
  const roleName = ROLE_LABEL[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
  const totalSteps = 3;
  const last = step === totalSteps - 1;

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
      router.replace(thenHref ?? stripJoinedParam());
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
      <DialogContent
        initialFocus={continueRef}
        className="grid max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden rounded-[1.75rem] border-0 bg-[color:var(--shell)] p-0 shadow-lift ring-1 ring-foreground/10 sm:max-w-[min(58rem,calc(100%-2rem))] md:h-[min(40rem,calc(100dvh-2rem))] md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
      >
        <VisualPane step={step} orgName={orgName} roleName={roleName} modules={modules} />

        <section className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-7 pb-5 sm:px-8 sm:pt-8">
            <div key={step} className="lane-fade-up">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
                {STEP_COPY[step]!.eyebrow} · {step + 1} of {totalSteps}
              </p>
              <DialogTitle className="mt-2 font-heading text-[1.65rem] leading-tight font-semibold tracking-[-0.02em] text-foreground sm:text-[1.9rem]">
                {step === 0 ? `Welcome to ${orgName}` : STEP_COPY[step]!.title}
              </DialogTitle>
              <DialogDescription className="mt-2 text-[14px] leading-6 text-muted-foreground">
                {step === 0 ? (
                  <>
                    You&apos;re in as <span className="font-medium text-foreground">{roleName}</span>.
                    Here&apos;s how to find your way around before you dive in.
                  </>
                ) : (
                  STEP_COPY[step]!.description
                )}
              </DialogDescription>

              <div className="mt-6">
                {step === 0 ? <WelcomeStep /> : null}
                {step === 1 ? <LaneStep /> : null}
                {step === 2 ? <AccessStep modules={modules} openCount={openCount} /> : null}
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border/50 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-3 bg-muted",
                    )}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-muted-foreground"
                onClick={() => finish()}
              >
                Skip tour
              </Button>
            </div>
            <div className="flex gap-2">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Back"
                  disabled={pending}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : null}
              <Button
                ref={continueRef}
                type="button"
                disabled={pending}
                className="font-semibold"
                onClick={() =>
                  last ? finish(primaryHref) : setStep((s) => Math.min(totalSteps - 1, s + 1))
                }
              >
                {last ? (canDeliver ? "Open projects" : "Go to home") : "Continue"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </footer>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function VisualPane({
  step,
  orgName,
  roleName,
  modules,
}: {
  step: number;
  orgName: string;
  roleName: string;
  modules: ModuleItem[];
}) {
  return (
    <aside
      data-theme="dark"
      className="relative hidden overflow-hidden bg-shell text-foreground md:block"
    >
      <Image
        src="/brand/worklane-hero-mesh.webp"
        alt=""
        fill
        sizes="30rem"
        className="object-cover object-[70%_40%]"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--canvas) 30%, transparent) 0%, transparent 40%, color-mix(in oklch, var(--canvas) 88%, transparent) 100%), radial-gradient(ellipse 70% 50% at 80% 10%, color-mix(in oklch, var(--lane-violet) 40%, transparent), transparent 70%)",
        }}
      />
      <div className="relative z-10 flex h-full flex-col p-7">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} className="brightness-110" />
          <span className="text-[14px] font-semibold tracking-tight text-white">Worklane</span>
        </div>
        <div key={step} className="lane-fade-up my-auto">
          {step === 0 ? <StudioPreview orgName={orgName} roleName={roleName} /> : null}
          {step === 1 ? <LanePreview /> : null}
          {step === 2 ? <AccessPreview modules={modules} /> : null}
        </div>
      </div>
    </aside>
  );
}

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/12 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StudioPreview({ orgName, roleName }: { orgName: string; roleName: string }) {
  return (
    <div className="space-y-3">
      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <span className="lane-gradient grid size-12 shrink-0 place-items-center rounded-2xl text-[15px] font-bold text-white shadow-lg">
            {initials(orgName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-[17px] font-semibold tracking-tight text-white">
              {orgName}
            </p>
            <p className="text-[12px] text-white/55">Studio · {roleName}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["Pipeline", "Leads"],
            ["Delivery", "Projects"],
            ["Money", "Finance"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">
                {label}
              </p>
              <p className="mt-1 text-[13px] font-medium text-white/90">{value}</p>
            </div>
          ))}
        </div>
      </GlassCard>
      <p className="px-1 text-[13px] leading-5 text-white/55">
        Your studio is set up. Everything you create here stays connected, from the first lead to the last payment.
      </p>
    </div>
  );
}

function LanePreview() {
  const cards = [
    { stage: "Sell", title: "Website redesign", meta: "Lead · ₹4,80,000", dot: "bg-sky-400" },
    { stage: "Deliver", title: "Homepage build", meta: "Doing · due Fri", dot: "bg-violet-400" },
    { stage: "Collect", title: "INV-0042", meta: "Paid · ₹1,60,000", dot: "bg-emerald-400" },
  ];
  return (
    <ol className="relative space-y-3">
      <span aria-hidden className="absolute top-6 bottom-6 left-[1.35rem] w-px bg-gradient-to-b from-sky-400/60 via-violet-400/60 to-emerald-400/60" />
      {cards.map((card) => (
        <li key={card.stage} className="relative flex items-center gap-3">
          <span className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--shell)] ring-1 ring-white/15">
            <span className={cn("size-2.5 rounded-full", card.dot)} />
          </span>
          <GlassCard className="flex-1 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">
              {card.stage}
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-white">{card.title}</p>
            <p className="text-[12px] text-white/55">{card.meta}</p>
          </GlassCard>
        </li>
      ))}
    </ol>
  );
}

function AccessPreview({ modules }: { modules: ModuleItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <div
            key={mod.key}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl px-2 py-4 ring-1 backdrop-blur-md",
              mod.visible ? "bg-white/[0.08] ring-white/15" : "bg-white/[0.03] ring-white/8",
            )}
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-xl",
                mod.visible ? "lane-gradient text-white" : "bg-white/5 text-white/30",
              )}
            >
              {mod.visible ? <Icon className="size-4" /> : <Lock className="size-3.5" />}
            </span>
            <span className={cn("text-[12px] font-medium", mod.visible ? "text-white/90" : "text-white/35")}>
              {mod.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep() {
  const tips: { icon: LucideIcon; title: string; body: React.ReactNode }[] = [
    {
      icon: LayoutDashboard,
      title: "Start on Home",
      body: "Studio health at a glance: what’s due, what’s moving, and what needs you.",
    },
    {
      icon: Plus,
      title: "Create from anywhere",
      body: "Use Create in the header to add a lead, project, task, or invoice.",
    },
    {
      icon: Search,
      title: "Jump with search",
      body: (
        <>
          Press{" "}
          <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
            ⌘K
          </kbd>{" "}
          to find any client, project, or document.
        </>
      ),
    },
  ];
  return (
    <ul className="space-y-2.5">
      {tips.map((tip) => {
        const Icon = tip.icon;
        return (
          <li key={tip.title} className="lane-inset flex gap-3.5 rounded-2xl p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-foreground">{tip.title}</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{tip.body}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function LaneStep() {
  return (
    <ol className="space-y-2.5">
      {JOURNEY_STEPS.map((item, index) => {
        const Icon = item.icon;
        return (
          <li key={item.key} className="lane-inset flex gap-3.5 rounded-2xl p-4">
            <span className="lane-gradient grid size-10 shrink-0 place-items-center rounded-xl text-primary-foreground">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  0{index + 1}
                </span>
                <span className="text-[14px] font-semibold text-foreground">{item.title}</span>
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{item.body}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AccessStep({ modules, openCount }: { modules: ModuleItem[]; openCount: number }) {
  return (
    <div>
      <p className="mb-3 text-[12px] font-medium text-muted-foreground">
        {openCount} of {modules.length} modules open to you
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <li
              key={mod.key}
              title={mod.visible ? mod.blurb : undefined}
              className={cn("lane-inset flex items-center gap-3 rounded-xl px-3 py-2.5", !mod.visible && "opacity-55")}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg",
                  mod.visible ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {mod.visible ? <Icon className="size-4" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">{mod.label}</span>
                <span className="mt-0.5 block truncate text-[12px] leading-4 text-muted-foreground">
                  {mod.visible ? mod.blurb : "Ask an owner for access"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
