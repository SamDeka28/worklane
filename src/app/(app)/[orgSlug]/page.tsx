import Link from "next/link";
import { PageShell } from "@/components/studio/composer";
import {
  NextStepCard,
  SoftCard,
  StudioToolbar,
  WorkSurface,
  moneyFill,
} from "@/components/studio/chrome";
import {
  DotStackChart,
  HorizonBars,
  PillTrack,
  SoftStatCard,
} from "@/components/studio/charts";
import { MoneyDonut, MONEY_COLORS } from "@/components/studio/money-donut";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio/empty-state";
import { listClients } from "@/modules/clients/queries";
import { listLeads } from "@/modules/crm/queries";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/modules/crm/types";
import { projectMoneyStats } from "@/modules/delivery/board";
import { listProjectBoard } from "@/modules/delivery/queries";
import { moneyLabel } from "@/modules/finance/ledger";
import { dueThisMonthMinor, groupChargesByClient } from "@/modules/finance/presentation";
import { loadMonthlyStatement, loadOrgDashboard, loadOrgFinance } from "@/modules/finance/queries";
import { requireOrg } from "@/modules/identity/org";
import { loadOpsQueue } from "@/modules/ops/queries";
import { loadPartnerBalances } from "@/modules/partners/queries";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney } from "@/shared/money";

function activityCopy(verb: string, clientName: string | null, entityType?: string) {
  const who = clientName ?? "a client";
  switch (verb) {
    case "created":
      return entityType === "project" ? "Created a project" : `Created ${who}`;
    case "updated":
      return entityType === "project" ? "Updated a project" : `Updated ${who}`;
    case "contact_added":
      return `Added a contact on ${who}`;
    case "archived":
      return `Archived ${who}`;
    case "charged":
      return `Posted a charge for ${who}`;
    case "paid":
      return `Recorded a payment from ${who}`;
    case "refunded":
      return `Recorded a refund for ${who}`;
    case "voided":
      return "Cancelled a ledger row";
    case "logged":
      return "Logged work";
    case "tasked":
      return "Added a task";
    case "lead_created":
      return "Added a lead";
    case "lead_won":
      return "Won a lead";
    case "invoice_issued":
      return "Issued an invoice";
    default:
      return verb.replaceAll("_", " ");
  }
}

function relativeDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function monthKeys(count: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthShort(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export default async function DashboardPage({
  params,
}: PageProps<"/[orgSlug]">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const months = monthKeys(6);

  const [dash, finance, board, clients, balances, leads, opsQueue, ...statements] = await Promise.all([
    loadOrgDashboard(orgSlug),
    loadOrgFinance(orgSlug),
    listProjectBoard(orgSlug),
    listClients(orgSlug),
    loadPartnerBalances(orgSlug).catch(() => []),
    ctx.org.modules.crm ? listLeads(orgSlug).catch(() => []) : Promise.resolve([]),
    loadOpsQueue(orgSlug).catch(() => []),
    ...months.map((month) => loadMonthlyStatement(orgSlug, month)),
  ]);

  const emptyStudio = dash.clientCount === 0;
  const doNext = opsQueue[0] ?? null;
  const currency = dash.currency;
  const names = new Map(clients.map((client) => [client.id, client.name]));
  const monthDueMinor = dueThisMonthMinor(
    finance.charges.filter((charge) => charge.status !== "void"),
  );

  const projectRows = board
    .map((row) => {
      const projectCharges = finance.charges.filter(
        (charge) => charge.projectId === row.project.id,
      );
      const money = projectMoneyStats(row.project, projectCharges);
      return { project: row.project, money, openTasks: row.openTasks };
    })
    .filter(
      (row) =>
        row.money.totalPriceMinor > BigInt(0) ||
        row.money.outstandingMinor > BigInt(0) ||
        row.money.collectedMinor > BigInt(0),
    )
    .sort((a, b) => Number(b.money.remainingMinor - a.money.remainingMinor));

  const orgRemaining = projectRows.reduce(
    (sum, row) => sum + row.money.remainingMinor,
    BigInt(0),
  );
  const unbilledMinor =
    orgRemaining > finance.snapshot.outstandingMinor
      ? orgRemaining - finance.snapshot.outstandingMinor
      : BigInt(0);

  const activeProjects = board.filter(
    (row) => row.project.status === "active" || row.project.status === "planning",
  ).length;
  const openTasks = board.reduce((sum, row) => sum + row.openTasks, 0);
  const partnerPayable = balances
    .filter((row) => row.active)
    .reduce((sum, row) => sum + row.payableMinor, BigInt(0));

  const owingGroups = groupChargesByClient(
    finance.charges.filter(
      (charge) => charge.status !== "void" && charge.outstandingMinor > BigInt(0),
    ),
    names,
  ).slice(0, 6);

  const pipelineStages: LeadStage[] = [
    "new",
    "contacted",
    "discovery",
    "qualified",
    "proposal",
    "negotiation",
  ];
  const openLeads = leads.filter(
    (lead) => lead.stage !== "won" && lead.stage !== "lost",
  );
  const pipelineValue = openLeads.reduce(
    (sum, lead) => sum + (lead.estimatedValueMinor ?? BigInt(0)),
    BigInt(0),
  );
  const stageCounts = pipelineStages.map((stage) => ({
    stage,
    label: LEAD_STAGE_LABELS[stage],
    count: leads.filter((lead) => lead.stage === stage).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((row) => row.count));

  const collectionTrend = months.map((month, index) => {
    const statement = statements[index] as { payments?: bigint } | undefined;
    const collected = statement?.payments ?? BigInt(0);
    return { month, collected };
  });

  return (
    <WorkSurface>
      <StudioToolbar purpose={JOURNEY.home.purpose} />
      <PageShell className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 pt-1">
      {emptyStudio ? (
        <EmptyState
          fill
          title={
            ctx.org.modules.crm
              ? JOURNEY.leads.emptyTitle
              : JOURNEY.clients.emptyTitle
          }
          body={
            ctx.org.modules.crm
              ? "Start with a lead. Win it, become a client, then deliver and collect — without retyping."
              : "Money, delivery, and pipeline roll up here once work starts."
          }
          actionHref={
            ctx.canWrite
              ? ctx.org.modules.crm
                ? `/${orgSlug}/crm?new=1`
                : `/${orgSlug}/clients?new=1`
              : undefined
          }
          actionLabel={
            ctx.canWrite
              ? ctx.org.modules.crm
                ? JOURNEY.leads.primaryCta
                : JOURNEY.clients.primaryCta
              : undefined
          }
        />
      ) : (
        <>
          {doNext ? (
            <NextStepCard
              title={`Do next · ${doNext.title}`}
              body={`${doNext.subtitle} — ${doNext.why}`}
              action={
                <Button
                  size="lg"
                  nativeButton={false}
                  render={<Link href={doNext.href} />}
                >
                  {doNext.cta}
                  {doNext.amountMinor != null && doNext.currency
                    ? ` · ${moneyLabel(doNext.amountMinor, doNext.currency)}`
                    : ""}
                </Button>
              }
            />
          ) : null}
          <div className="lane-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`/${orgSlug}/finance`} className="block">
              <SoftStatCard
                label="Outstanding"
                value={moneyLabel(dash.outstandingMinor, currency)}
                hint="Open on the ledger"
                tone="sky"
                fill={moneyFill(dash.outstandingMinor, dash.billedMinor)}
              />
            </Link>
            <Link href={`/${orgSlug}/finance?filter=overdue`} className="block">
              <SoftStatCard
                label="Overdue"
                value={moneyLabel(dash.overdueMinor, currency)}
                hint="Past due date"
                tone="amber"
                badge={dash.overdueMinor > BigInt(0) ? "Needs collect" : undefined}
                fill={moneyFill(dash.overdueMinor, dash.outstandingMinor)}
              />
            </Link>
            <Link href={`/${orgSlug}/finance?view=overview`} className="block">
              <SoftStatCard
                label="Collected"
                value={moneyLabel(dash.collectedMinor, currency)}
                hint="Receipts allocated"
                tone="emerald"
                fill={moneyFill(dash.collectedMinor, dash.billedMinor)}
              />
            </Link>
            <Link href={`/${orgSlug}/finance`} className="block">
              <SoftStatCard
                label="Due this month"
                value={moneyLabel(monthDueMinor, currency)}
                hint="Charges with due dates this month"
                tone="violet"
                fill={moneyFill(monthDueMinor, dash.outstandingMinor)}
              />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <SoftCard className="p-6" hover>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">Money mix</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Collected vs owed vs still unbilled on contracts.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/${orgSlug}/finance?view=overview`} />}
                >
                  Finance
                </Button>
              </div>
              <MoneyDonut
                size="lg"
                centerLabel="Booked"
                centerValue={moneyLabel(
                  finance.snapshot.collectedMinor + orgRemaining,
                  currency,
                )}
                slices={[
                  {
                    key: "collected",
                    label: `Collected · ${moneyLabel(finance.snapshot.collectedMinor, currency)}`,
                    value: Number(finance.snapshot.collectedMinor),
                    color: MONEY_COLORS.collected,
                  },
                  {
                    key: "due",
                    label: `Due · ${moneyLabel(finance.snapshot.outstandingMinor, currency)}`,
                    value: Number(finance.snapshot.outstandingMinor),
                    color: MONEY_COLORS.due,
                  },
                  {
                    key: "remaining",
                    label: `Unbilled · ${moneyLabel(unbilledMinor, currency)}`,
                    value: Number(unbilledMinor),
                    color: MONEY_COLORS.remaining,
                  },
                ]}
              />
              <div className="mt-5 rounded-3xl bg-sky-50/80 px-4 py-3 text-sm text-sky-900/80">
                Collecting on time keeps partner payables honest and projects funded.
              </div>
            </SoftCard>

            <SoftCard className="flex flex-col p-6" hover>
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">Collections</p>
                  <p className="mt-1 text-sm text-muted-foreground">Receipts posted by month</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/${orgSlug}/finance`} />}
                >
                  Collect
                </Button>
              </div>
              <div className="mt-6 flex-1">
                <DotStackChart
                  rows={collectionTrend.map((row) => ({
                    id: row.month,
                    label: monthShort(row.month),
                    value: Number(row.collected),
                    meta:
                      row.collected > BigInt(0)
                        ? formatMoney({ amountMinor: row.collected, currency })
                        : undefined,
                  }))}
                />
              </div>
            </SoftCard>
          </div>

          <div className="lane-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`/${orgSlug}/clients`} className="block">
              <SoftStatCard
                label="Clients"
                value={String(dash.clientCount)}
                hint="Who you bill"
                tone="slate"
              />
            </Link>
            <Link href={`/${orgSlug}/projects`} className="block">
              <SoftStatCard
                label="Active projects"
                value={String(activeProjects)}
                hint={`${openTasks} open board cards`}
                tone="sky"
                badge={openTasks > 0 ? `${openTasks} tasks` : undefined}
              />
            </Link>
            <Link href={`/${orgSlug}/partners`} className="block">
              <SoftStatCard
                label="Partner payable"
                value={moneyLabel(partnerPayable, currency)}
                hint="Earned minus settled"
                tone="amber"
                fill={moneyFill(partnerPayable, partnerPayable + dash.collectedMinor)}
              />
            </Link>
            {ctx.org.modules.crm ? (
              <Link href={`/${orgSlug}/crm`} className="block">
                <SoftStatCard
                  label="Pipeline"
                  value={moneyLabel(pipelineValue, currency)}
                  hint={`${openLeads.length} open leads`}
                  tone="violet"
                  badge={openLeads.length ? `${openLeads.length} open` : undefined}
                />
              </Link>
            ) : (
              <Link href={`/${orgSlug}/finance`} className="block">
                <SoftStatCard
                  label="Open charges"
                  value={String(dash.openChargeCount)}
                  hint="Still outstanding"
                  tone="violet"
                />
              </Link>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SoftCard className="p-6" hover>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">Projects</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Collected · due · unbilled remaining
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/${orgSlug}/projects`} />}
                >
                  All
                </Button>
              </div>
              {projectRows.length === 0 ? (
                <p className="py-10 text-sm text-muted-foreground">No project money yet.</p>
              ) : (
                <HorizonBars
                  rows={projectRows.slice(0, 8).map(({ project, money }) => ({
                    id: project.id,
                    label: project.name,
                    href: `/${orgSlug}/projects/${project.id}`,
                    meta: moneyLabel(money.outstandingMinor, project.currency),
                    collected: Number(money.collectedMinor),
                    due: Number(money.outstandingMinor),
                    remaining: Number(
                      money.remainingMinor > money.outstandingMinor
                        ? money.remainingMinor - money.outstandingMinor
                        : BigInt(0),
                    ),
                  }))}
                />
              )}
            </SoftCard>

            <SoftCard className="flex min-h-0 flex-col p-6" hover>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">Who owes</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Clients with open ledger balance
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/${orgSlug}/finance`} />}
                >
                  Collect
                </Button>
              </div>
              {owingGroups.length === 0 ? (
                <p className="py-10 text-sm text-muted-foreground">Nothing outstanding.</p>
              ) : (
                <ul className="space-y-1.5">
                  {owingGroups.map((group) => (
                    <li key={group.clientId}>
                      <Link
                        href={`/${orgSlug}/clients/${group.clientId}?collect=1#collect`}
                        className="flex items-center justify-between gap-3 rounded-3xl px-3.5 py-3 text-sm transition-colors duration-200 hover:bg-sky-50/80"
                      >
                        <span className="truncate font-medium">{group.name}</span>
                        <span className="shrink-0 tabular-nums font-medium text-foreground">
                          {moneyLabel(group.outstandingMinor, group.currency)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SoftCard>
          </div>

          {ctx.org.modules.crm && openLeads.length > 0 ? (
            <SoftCard className="p-6" hover>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">Lead pipeline</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open stages — not including won or lost
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/${orgSlug}/crm`} />}
                >
                  CRM
                </Button>
              </div>
              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {stageCounts.map((row) => (
                  <li
                    key={row.stage}
                    className="rounded-3xl bg-linear-to-br from-white to-sky-50/60 px-3.5 py-3.5 ring-1 ring-border/30 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums">{row.count}</p>
                    <PillTrack
                      className="mt-3"
                      value={row.count}
                      max={maxStage}
                      tone="sky"
                    />
                  </li>
                ))}
              </ul>
            </SoftCard>
          ) : null}

          <SoftCard className="p-6" hover>
            <p className="text-base font-semibold tracking-tight">Recent activity</p>
            {dash.activities.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Charges and receipts land here.</p>
            ) : (
              <ul className="mt-4 space-y-1">
                {dash.activities.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-baseline justify-between gap-3 rounded-2xl px-2.5 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground">
                      {activityCopy(row.verb, row.clientName, row.entityType)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeDay(row.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SoftCard>
        </>
      )}
      </PageShell>
    </WorkSurface>
  );
}
