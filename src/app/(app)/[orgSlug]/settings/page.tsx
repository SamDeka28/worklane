import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Globe,
  Mail,
  PenLine,
  ReceiptText,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { cn } from "@/lib/utils";
import { listClients } from "@/modules/clients/queries";
import {
  OrgBusinessForm,
  OrgSettingsForm,
} from "@/modules/identity/components/org-settings-form";
import { loadOrgInvoiceConfig } from "@/modules/invoices/config";
import { requireOrg } from "@/modules/identity/org";
import { listPartners } from "@/modules/partners/queries";
import {
  CreateShareGrantForm,
  ShareGrantList,
} from "@/modules/portal/components/share-grant-forms";
import { listShareGrants } from "@/modules/portal/queries";
import { SmtpSenderForm } from "@/modules/email-senders/components/smtp-sender-form";
import { getSmtpSenders, smtpStorageUnavailable } from "@/modules/email-senders/server";
import { StudioSignatureForm } from "@/modules/email-signatures/components/signature-forms";
import { getSignatures, signatureSender } from "@/modules/email-signatures/server";
import { isEmailConfigured } from "@/shared/email";

type SettingsTab = "studio" | "business" | "email" | "signature" | "portal";

type TabItem = { tab: SettingsTab; label: string; icon: LucideIcon };
type LinkItem = { href: string; label: string; icon: LucideIcon };

const NAV_ITEM =
  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors";

function SettingsPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-3xl">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const elevated = ctx.role === "owner" || ctx.role === "admin";
  const showPortal = ctx.org.modules.portal && ctx.canWrite;

  const tabItems: TabItem[] = [
    { tab: "studio", label: "Studio", icon: Store },
    { tab: "business", label: "Business details", icon: Building2 },
    ...(elevated
      ? ([
          { tab: "email", label: "Sending email", icon: Mail },
          { tab: "signature", label: "Email signature", icon: PenLine },
        ] as const)
      : []),
    ...(showPortal ? ([{ tab: "portal", label: "Portal", icon: Globe }] as const) : []),
  ];
  const linkItems: LinkItem[] = [
    { href: `/${orgSlug}/team`, label: "Team", icon: Users },
    ...(ctx.org.modules.finance
      ? [{ href: `/${orgSlug}/invoices?settings=1`, label: "Invoices", icon: ReceiptText }]
      : []),
  ];
  const requested = typeof query.tab === "string" ? query.tab : "";
  const tab = tabItems.find((item) => item.tab === requested)?.tab ?? "studio";

  return (
    <WorkSurface variant="panel">
      <StudioToolbar purpose="Studio settings" subtitle={ctx.org.slug} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Settings"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/50 px-4 py-3 md:w-56 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:px-3 md:py-5"
        >
          {tabItems.map((item) => {
            const Icon = item.icon;
            const active = item.tab === tab;
            return (
              <Link
                key={item.tab}
                href={`/${orgSlug}/settings?tab=${item.tab}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  NAV_ITEM,
                  active
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-border/60 md:mx-3 md:my-2 md:h-px md:w-auto" />
          {linkItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(NAV_ITEM, "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                <ArrowUpRight className="size-3.5 opacity-50" />
              </Link>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
          <SettingsContent tab={tab} orgSlug={orgSlug} ctx={ctx} />
        </div>
      </div>
    </WorkSurface>
  );
}

async function SettingsContent({
  tab,
  orgSlug,
  ctx,
}: {
  tab: SettingsTab;
  orgSlug: string;
  ctx: Awaited<ReturnType<typeof requireOrg>>;
}) {
  if (tab === "business") {
    const invoiceConfig = await loadOrgInvoiceConfig(orgSlug);
    return (
      <SettingsPanel
        title="Business details"
        hint="Your studio's legal name, address and registration numbers. Used in the Billed by block on invoices."
      >
        <OrgBusinessForm
          orgSlug={orgSlug}
          business={invoiceConfig.business}
          canWrite={ctx.canWrite}
        />
      </SettingsPanel>
    );
  }

  if (tab === "email") {
    const senders = await getSmtpSenders(ctx.org.id, ctx.userId);
    return (
      <SettingsPanel
        title="Sending email"
        hint="The studio mailbox sends Compose emails, document sends, and lead emails for anyone without their own."
      >
        <SmtpSenderForm
          orgSlug={orgSlug}
          scope="studio"
          saved={senders.studio}
          fallback={
            isEmailConfigured() ? "Worklane's default address" : "nowhere yet, so sending is off"
          }
          unavailable={smtpStorageUnavailable()}
          defaultFromName={ctx.org.name}
        />
        <p className="mt-5 text-xs text-muted-foreground">
          Members can also send lead emails from their own mailbox once you turn on{" "}
          <span className="text-foreground">Own mailbox</span> in their{" "}
          <Link
            href={`/${orgSlug}/team`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Team access
          </Link>
          .
        </p>
      </SettingsPanel>
    );
  }

  if (tab === "signature") {
    const signatures = await getSignatures(ctx.org.id, ctx.userId);
    return (
      <SettingsPanel
        title="Email signature"
        hint="The studio's default signature, added below lead emails and Compose emails. Fields fill in with each sender's own details."
      >
        <StudioSignatureForm
          orgSlug={orgSlug}
          saved={signatures.studio}
          sender={await signatureSender(ctx)}
        />
      </SettingsPanel>
    );
  }

  if (tab === "portal") {
    const [clients, partners, grants] = await Promise.all([
      listClients(orgSlug),
      listPartners(orgSlug),
      listShareGrants(orgSlug),
    ]);
    return (
      <SettingsPanel title="Portal" hint="Hashed share links: tokens shown once">
        <CreateShareGrantForm
          orgSlug={orgSlug}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
        />
        <div className="mt-5 border-t border-border/40 pt-5">
          <ShareGrantList orgSlug={orgSlug} grants={grants} />
        </div>
      </SettingsPanel>
    );
  }

  const senders = await getSmtpSenders(ctx.org.id, ctx.userId);
  const emailStatus = senders.studio
    ? `From ${senders.studio.fromEmail}`
    : isEmailConfigured()
      ? "Connected"
      : "Not configured";

  return (
    <SettingsPanel title="Studio" hint="Your studio's name and account">
      <OrgSettingsForm orgSlug={orgSlug} name={ctx.org.name} canWrite={ctx.canWrite} />
      <dl className="mt-8 grid max-w-lg gap-3 border-t border-border/50 pt-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Currency</dt>
          <dd className="mt-0.5 font-medium">{ctx.org.defaultCurrency}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Your role</dt>
          <dd className="mt-0.5 font-medium capitalize">{ctx.role}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="mt-0.5 truncate font-medium">{emailStatus}</dd>
        </div>
      </dl>
    </SettingsPanel>
  );
}
