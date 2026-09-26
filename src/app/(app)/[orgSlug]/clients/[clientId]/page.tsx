import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AvatarMark } from "@/components/studio/avatar-mark";
import {
  EntityChrome,
  HubBody,
  HubSection,
  NextStepCard,
  SoftCard,
  Stat,
  WorkSurface,
  moneyFill,
} from "@/components/studio/chrome";
import { StatusChip } from "@/components/studio/status-chip";
import {
  AddContactSheet,
  EditClientBillingSheet,
} from "@/modules/clients/components/client-forms";
import { ClientHubChrome } from "@/modules/clients/components/client-hub-chrome";
import { clientNextStep } from "@/modules/clients/next-step";
import {
  describeClientActivity,
  getClient,
  listClientActivity,
  listContacts,
} from "@/modules/clients/queries";
import type { ClientActivityItem } from "@/modules/clients/types";
import { cn } from "@/lib/utils";
import {
  Activity,
  BadgeCheck,
  Mail,
  MapPin,
  Phone,
  Receipt,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { listClientProjects } from "@/modules/delivery/queries";
import { CollectComposer } from "@/modules/finance/components/finance-forms";
import { ChargeRows } from "@/modules/finance/components/charge-board";
import { clientMoneySnapshot, moneyLabel } from "@/modules/finance/ledger";
import { collectTargets } from "@/modules/finance/presentation";
import { loadClientFinance } from "@/modules/finance/queries";
import { requireOrg } from "@/modules/identity/org";
import { canAccessModule, canDeleteModule, canSeeMoney } from "@/modules/identity/permissions";
import { CreateDocumentDialog } from "@/modules/documents/components/document-forms";
import { getClientBillingProfile } from "@/modules/invoices/queries";
import { EMPTY_BILL_TO, type InvoiceBillTo } from "@/modules/invoices/types";
import { listDocuments } from "@/modules/documents/queries";
import { listClientLeads, listLeadStages } from "@/modules/crm/queries";
import { isClosedStage, stageLabel, stageTone, stagesOrDefault } from "@/modules/crm/types";

const ACTIVITY_ICON: Record<ClientActivityItem["kind"], typeof Receipt> = {
  charge: Receipt,
  payment: BadgeCheck,
  created: UserPlus,
  other: Activity,
};

const ACTIVITY_ICON_TONE: Record<ClientActivityItem["kind"], string> = {
  charge: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  payment: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  created: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  other: "bg-muted text-muted-foreground",
};

function projectTone(status: string): "active" | "planning" | "on_hold" | "completed" | "cancelled" {
  if (status === "active") return "active";
  if (status === "on_hold") return "on_hold";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "planning";
}

export default async function ClientProfilePage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/clients/[clientId]">) {
  const { orgSlug, clientId } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const seeMoney = canSeeMoney(ctx.permissions);
  const canCollect = ctx.canWrite && seeMoney;
  const client = await getClient(orgSlug, clientId);
  if (!client) notFound();

  const selectedChargeId = typeof query.charge === "string" ? query.charge : undefined;
  const showCollect =
    seeMoney && (query.collect === "1" || Boolean(selectedChargeId));
  const showDeals = ctx.org.modules.crm && canAccessModule(ctx.permissions, "crm");
  const [contacts, activity, financeLoaded, projects, documents, billing, deals, stageRows] =
    await Promise.all([
      listContacts(orgSlug, clientId),
      listClientActivity(orgSlug, clientId),
      seeMoney ? loadClientFinance(orgSlug, clientId) : Promise.resolve(null),
      listClientProjects(orgSlug, clientId),
      listDocuments(orgSlug).catch(() => []),
      getClientBillingProfile(orgSlug, clientId),
      showDeals ? listClientLeads(orgSlug, clientId) : Promise.resolve([]),
      showDeals ? listLeadStages(orgSlug) : Promise.resolve([]),
    ]);
  const dealStages = stagesOrDefault(stageRows);
  const finance = financeLoaded ?? {
    charges: [],
    snapshot: clientMoneySnapshot([], [], []),
  };
  const clientDocs = documents.filter((doc) => doc.clientId === clientId);
  const activityItems = await describeClientActivity(orgSlug, activity, {
    includeMoney: seeMoney,
  });

  const latestProjectId = projects[0]?.id ?? null;
  const next = clientNextStep({
    projectCount: projects.length,
    outstandingMinor: seeMoney ? finance.snapshot.outstandingMinor : BigInt(0),
    contactCount: contacts.length,
    latestProjectId,
  });
  const base = `/${orgSlug}/clients/${client.id}`;
  const owing = seeMoney
    ? finance.charges.filter(
        (c) => c.status !== "void" && c.outstandingMinor > BigInt(0),
      )
    : [];
  const dueMinor = seeMoney ? finance.snapshot.outstandingMinor : BigInt(0);
  const collectedMinor = seeMoney ? finance.snapshot.collectedMinor : BigInt(0);
  const moneyWhole =
    dueMinor + collectedMinor > BigInt(0) ? dueMinor + collectedMinor : BigInt(1);
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const billingDraft: InvoiceBillTo = billing ?? {
    ...EMPTY_BILL_TO,
    name: client.name,
    contactName: primary?.name ?? "",
    email: primary?.email ?? "",
    phone: primary?.phone ?? "",
  };
  const moneyStatus =
    dueMinor > BigInt(0) ? "due" : collectedMinor > BigInt(0) ? "paid" : "planning";

  return (
    <WorkSurface variant="panel">
      <EntityChrome
        title={client.name}
        meta={
          <>
            <span className="capitalize">{client.kind}</span>
            {seeMoney ? (
              <>
                <span aria-hidden className="text-border/80">
                  ·
                </span>
                <span className="tabular-nums">
                  {moneyLabel(dueMinor, client.currency)} due
                </span>
              </>
            ) : null}
            {projects.length > 0 ? (
              <>
                <span aria-hidden className="text-border/80">
                  ·
                </span>
                <span>
                  {projects.length} project{projects.length === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
          </>
        }
        primaryAction={
          <ClientHubChrome
            orgSlug={orgSlug}
            client={{
              id: client.id,
              name: client.name,
              kind: client.kind,
              notes: client.notes,
              notesDoc: client.notesDoc,
              currency: client.currency,
            }}
            next={next}
            canWrite={ctx.canWrite}
            canDelete={canDeleteModule(ctx, "crm")}
            seeMoney={seeMoney}
            editOpen={query.edit === "1"}
            contactOpen={query.contact === "1"}
            projectOpen={query.new === "project"}
            chargeOpen={seeMoney && query.new === "charge"}
            attachableDocuments={clientDocs.map((doc) => ({
              id: doc.id,
              title: doc.title,
              kind: doc.kind,
              status: doc.status,
              projectId: doc.projectId,
            }))}
          />
        }
      />

      <HubBody className="*:shrink-0">
        <NextStepCard title={next.title} body={next.body} />

        <SoftCard
          className={`grid overflow-hidden ${seeMoney ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}
        >
          {seeMoney ? (
            <>
              <div className="border-b border-border/50 sm:border-r xl:border-b-0">
                <Stat
                  variant="tile"
                  className="bg-transparent"
                  label="Due"
                  value={moneyLabel(dueMinor, client.currency)}
                  tone={dueMinor > BigInt(0) ? "rose" : "emerald"}
                  fill={moneyFill(dueMinor, moneyWhole)}
                />
              </div>
              <div className="border-b border-border/50 xl:border-r xl:border-b-0">
                <Stat
                  variant="tile"
                  className="bg-transparent"
                  label="Collected"
                  value={moneyLabel(collectedMinor, client.currency)}
                  tone="emerald"
                  fill={moneyFill(collectedMinor, moneyWhole)}
                />
              </div>
            </>
          ) : null}
          <div
            className={
              seeMoney
                ? "border-b border-border/50 sm:border-r sm:border-b-0 xl:border-b-0"
                : "border-b border-border/50 sm:border-r sm:border-b-0"
            }
          >
            <Stat
              variant="tile"
              className="bg-transparent"
              label="Projects"
              value={String(projects.length)}
              tone="violet"
              fill={projects.length > 0 ? Math.min(1, projects.length / 4) : 0.08}
            />
          </div>
          <div>
            <Stat
              variant="tile"
              className="bg-transparent"
              label="Contacts"
              value={String(contacts.length)}
              tone="sky"
              fill={contacts.length > 0 ? Math.min(1, contacts.length / 3) : 0.08}
            />
          </div>
        </SoftCard>

        <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)] lg:gap-7">
          <div className="flex min-w-0 flex-col gap-5">
            <HubSection
              variant="panel"
              title="Projects"
              action={
                ctx.canWrite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`${base}?new=project`} />}
                  >
                    New
                  </Button>
                ) : null
              }
            >
              {projects.length === 0 ? (
                <div className="flex flex-col items-start gap-3 px-4 py-4">
                  <p className="text-[15px] font-semibold tracking-tight">No projects yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Start delivery so money and documents have a home.
                  </p>
                  {ctx.canWrite ? (
                    <Button
                      size="sm"
                      className="mt-1"
                      nativeButton={false}
                      render={<Link href={`${base}?new=project`} />}
                    >
                      Start project
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/${orgSlug}/projects/${project.id}`}
                        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold tracking-tight group-hover:text-primary">
                            {project.name}
                          </p>
                          <div className="mt-1.5">
                            <StatusChip tone={projectTone(project.status)}>
                              {project.status.replaceAll("_", " ")}
                            </StatusChip>
                          </div>
                        </div>
                        {seeMoney ? (
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {project.contractedAmountMinor != null
                              ? moneyLabel(project.contractedAmountMinor, project.currency)
                              : project.currency}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </HubSection>

            {showDeals && (deals.length > 0 || ctx.canWrite) ? (
              <HubSection
                variant="panel"
                title="Deals"
                action={
                  ctx.canWrite ? (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/${orgSlug}/crm?new=1&client=${client.id}`} />}
                    >
                      New deal
                    </Button>
                  ) : null
                }
              >
                {deals.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    Track upsells and repeat work in the pipeline.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {deals.map((deal) => (
                      <li key={deal.id}>
                        <Link
                          href={`/${orgSlug}/crm?view=list&lead=${deal.id}`}
                          className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold tracking-tight group-hover:text-primary">
                              {deal.name}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <StatusChip tone={stageTone(deal.stage, dealStages)}>
                                {stageLabel(deal.stage, dealStages)}
                              </StatusChip>
                              {!isClosedStage(deal.stage, dealStages) && deal.nextAction ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {deal.nextAction}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {seeMoney && deal.estimatedValueMinor != null ? (
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              {moneyLabel(deal.estimatedValueMinor, deal.currency)}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </HubSection>
            ) : null}

            {seeMoney &&
            (owing.length > 0 ||
              finance.charges.length > 0 ||
              showCollect ||
              next.href === "collect") ? (
              <HubSection variant="panel" id="collect" title="Money">
                {owing.length > 0 ? (
                  <div className="px-1 py-1">
                    <ChargeRows
                      orgSlug={orgSlug}
                      charges={owing}
                      canWrite={canCollect}
                      activeChargeId={selectedChargeId}
                      collectHref={(chargeId) =>
                        `${base}?collect=1&charge=${chargeId}#collect`
                      }
                    />
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    Caught up on the ledger.
                  </p>
                )}
                {canCollect && (showCollect || owing.length > 0) ? (
                  <div className="border-t border-border/50 px-4 py-4">
                    <CollectComposer
                      orgSlug={orgSlug}
                      clientId={client.id}
                      targets={collectTargets(finance.charges)}
                      defaultChargeId={selectedChargeId}
                    />
                  </div>
                ) : null}
              </HubSection>
            ) : null}

            {activityItems.length > 0 ? (
              <HubSection variant="panel" title="Activity">
                <ul className="divide-y divide-border/50">
                  {activityItems.slice(0, 10).map((item) => {
                    const Icon = ACTIVITY_ICON[item.kind];
                    const byline = [
                      item.detail,
                      item.actorName ? `by ${item.actorName}` : null,
                    ].filter(Boolean);
                    return (
                      <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                            ACTIVITY_ICON_TONE[item.kind],
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            <span className="font-semibold">{item.title}</span>
                            {item.subject ? (
                              <span className="text-muted-foreground"> · {item.subject}</span>
                            ) : null}
                          </p>
                          {item.projectName || byline.length > 0 ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {item.projectName && item.projectId ? (
                                <Link
                                  href={`/${orgSlug}/projects/${item.projectId}`}
                                  className="font-medium text-foreground/80 hover:text-foreground hover:underline"
                                >
                                  {item.projectName}
                                </Link>
                              ) : null}
                              {item.projectName && byline.length > 0 ? " · " : null}
                              {byline.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {item.amountMinor != null && item.currency ? (
                            <p
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                item.kind === "payment"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-foreground",
                              )}
                            >
                              {item.kind === "payment" ? "+" : ""}
                              {moneyLabel(item.amountMinor, item.currency as typeof client.currency)}
                            </p>
                          ) : null}
                          <time
                            dateTime={item.createdAt}
                            title={new Date(item.createdAt).toLocaleString()}
                            className="mt-0.5 block text-xs tabular-nums text-muted-foreground"
                          >
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).format(new Date(item.createdAt))}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </HubSection>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <SoftCard className="overflow-hidden">
              <InspectorHeader title="Details" />
              <dl>
                <MetaRow label="Kind">
                  <span className="capitalize">{client.kind}</span>
                </MetaRow>
                {seeMoney ? (
                  <MetaRow label="Status">
                    <StatusChip
                      tone={
                        moneyStatus === "due"
                          ? "due"
                          : moneyStatus === "paid"
                            ? "paid"
                            : "planning"
                      }
                    >
                      {moneyStatus === "due"
                        ? "Outstanding"
                        : moneyStatus === "paid"
                          ? "Current"
                          : "New"}
                    </StatusChip>
                  </MetaRow>
                ) : null}
                <MetaRow label="Currency">{client.currency}</MetaRow>
                <MetaRow label="Primary">
                  {primary ? (
                    <span className="inline-flex max-w-full items-center gap-2">
                      <AvatarMark name={primary.name || "?"} size="sm" />
                      <span className="truncate">{primary.name || "Unnamed"}</span>
                    </span>
                  ) : (
                    "-"
                  )}
                </MetaRow>
              </dl>
              {client.notes ? (
                <div className="border-t border-border/50 px-4 py-3.5">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Notes
                  </p>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                    {client.notes}
                  </p>
                </div>
              ) : null}
            </SoftCard>

            <SoftCard className="overflow-hidden">
              <InspectorHeader
                title="Billing details"
                action={
                  ctx.canWrite ? (
                    <EditClientBillingSheet
                      orgSlug={orgSlug}
                      clientId={client.id}
                      initial={billingDraft}
                      hasSaved={Boolean(billing)}
                    />
                  ) : null
                }
              />
              {billing ? (
                <BillingSummary billing={billing} />
              ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Add the legal name, address and tax ID you bill to. New invoices fill it in
                  automatically.
                </p>
              )}
            </SoftCard>

            <SoftCard className="overflow-hidden">
              <InspectorHeader
                title="Contacts"
                action={
                  ctx.canWrite ? (
                    <AddContactSheet orgSlug={orgSlug} clientId={client.id} />
                  ) : null
                }
              />
              {contacts.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">No contacts yet.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {contacts.map((contact) => {
                    const detail = [contact.email, contact.phone, contact.whatsapp]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={contact.id} className="flex items-center gap-3 px-4 py-3">
                        <AvatarMark name={contact.name || "?"} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {contact.name || "Unnamed"}
                            {contact.isPrimary ? (
                              <span className="ml-1.5 text-[10px] font-semibold text-primary">
                                Primary
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {detail || "No details"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SoftCard>

            <SoftCard className="overflow-hidden">
              <InspectorHeader
                title="Documents"
                action={
                  ctx.canWrite ? (
                    <CreateDocumentDialog
                      orgSlug={orgSlug}
                      triggerLabel="New"
                      triggerVariant="ghost"
                      defaultClientId={client.id}
                      clients={[{ id: client.id, name: client.name }]}
                      projects={projects.map((project) => ({
                        id: project.id,
                        name: project.name,
                        clientId: client.id,
                      }))}
                    />
                  ) : null
                }
              />
              {clientDocs.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Proposals and SOWs appear here.
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {clientDocs.slice(0, 8).map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/${orgSlug}/documents/${doc.id}`}
                        className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                      >
                        <span className="min-w-0 truncate text-sm font-medium group-hover:text-primary">
                          {doc.title}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          {doc.kind}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SoftCard>
          </aside>
        </div>
      </HubBody>
    </WorkSurface>
  );
}

function InspectorHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/25 px-4 py-3">
      <h3 className="text-[12px] font-bold tracking-[0.12em] text-foreground/70 uppercase">
        {title}
      </h3>
      {action}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

const BILLING_ICON: [keyof InvoiceBillTo, LucideIcon][] = [
  ["contactName", UserRound],
  ["address", MapPin],
  ["email", Mail],
  ["phone", Phone],
];

function BillingSummary({ billing }: { billing: InvoiceBillTo }) {
  const facts = [
    ...(billing.taxId ? [{ label: "Tax ID", value: billing.taxId }] : []),
    ...billing.extras,
  ];
  return (
    <div className="grid gap-2 px-4 py-3.5 text-sm">
      {billing.name ? <p className="font-semibold tracking-tight">{billing.name}</p> : null}
      <ul className="grid gap-1">
        {BILLING_ICON.map(([key, Icon]) => {
          const value = billing[key];
          if (typeof value !== "string" || !value.trim()) return null;
          return (
            <li key={key} className="flex items-start gap-2 text-muted-foreground">
              <Icon className="mt-[3px] size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0 break-words whitespace-pre-line">{value}</span>
            </li>
          );
        })}
      </ul>
      {facts.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {facts.map((fact, index) => (
            <div key={`${fact.label}-${index}`} className="contents">
              <dt className="text-muted-foreground">{fact.label || "·"}</dt>
              <dd className="min-w-0 font-medium break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
