import Link from "next/link";
import { PageShell } from "@/components/studio/composer";
import {
  NextStepCard,
  StudioToolbar,
  WorkSurface,
  moneyFill,
} from "@/components/studio/chrome";
import {
  DotStackChart,
  PillTrack,
  ProjectMoneyCurves,
  SoftStatCard,
} from "@/components/studio/charts";
import { MoneyDonut, MONEY_COLORS } from "@/components/studio/money-donut";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio/empty-state";
import { listClients, listOrgActivity } from "@/modules/clients/queries";
import { listLeads, listLeadStages } from "@/modules/crm/queries";
import {
  isClosedStage,
  openPipelineStages,
  stagesOrDefault,
} from "@/modules/crm/types";
import { projectMoneyStats } from "@/modules/delivery/board";
import { listProjectBoard } from "@/modules/delivery/queries";
import { moneyLabel } from "@/modules/finance/ledger";
import { dueThisMonthMinor, groupChargesByClient } from "@/modules/finance/presentation";
import { loadMonthlyStatements, loadOrgDashboard, loadOrgFinance } from "@/modules/finance/queries";
import { requireOrg } from "@/modules/identity/org";
import { canAccessModule, canSeeMoney } from "@/modules/identity/permissions";
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
  const seeMoney = canSeeMoney(ctx.permissions);
  const seePartners = canAccessModule(ctx.permissions, "partners");
  const seeCrm = ctx.org.modules.crm && canAccessModule(ctx.permissions, "crm");
  const months = monthKeys(6);

  const [
    dashLoaded,
    finance,
    board,
    clients,
    balances,
    leads,
    leadStages,
    opsQueueRaw,
    statements,
    activityRows,
  ] = await Promise.all([
    seeMoney ? loadOrgDashboard(orgSlug) : Promise.resolve(null),
    seeMoney ? loadOrgFinance(orgSlug) : Promise.resolve(null),
    listProjectBoard(orgSlug),
    listClients(orgSlug),
    seeMoney && seePartners
      ? loadPartnerBalances(orgSlug).catch(() => [])
      : Promise.resolve([]),
    seeCrm ? listLeads(orgSlug).catch(() => []) : Promise.resolve([]),
    seeCrm ? listLeadStages(orgSlug).catch(() => []) : Promise.resolve([]),
    loadOpsQueue(orgSlug).catch(() => []),
    seeMoney ? loadMonthlyStatements(orgSlug, months) : Promise.resolve([]),
    seeMoney ? Promise.resolve([]) : listOrgActivity(orgSlug, 30).catch(() => []),
  ]);

  const names = new Map(clients.map((client) => [client.id, client.name]));
  const dash = dashLoaded ?? {
    currency: ctx.org.defaultCurrency,
    outstandingMinor: BigInt(0),
    overdueMinor: BigInt(0),
    billedMinor: BigInt(0),
    collectedMinor: BigInt(0),
    clientCount: clients.length,
    projectCount: 0,
    openChargeCount: 0,
    paymentCount: 0,
    recentClients: [],
    activities: activityRows.map((row) => ({
      ...row,
      clientName: row.entityId ? (names.get(row.entityId) ?? null) : null,
    })),
  };

  let opsQueue = opsQueueRaw;
  if (!seeMoney) {
    opsQueue = opsQueue.filter(
      (item) =>
        item.amountMinor == null &&
        item.verb !== "collect" &&
        item.verb !== "bill" &&
        item.verb !== "settle",
    );
  } else if (!seePartners) {
    opsQueue = opsQueue.filter((item) => item.verb !== "settle");
  }

  const stages = stagesOrDefault(leadStages);
  const emptyStudio = clients.length === 0;
  const doNext = opsQueue[0] ?? null;
  const currency = seeMoney ? dash.currency : ctx.org.defaultCurrency;

  const monthDueMinor =
    finance != null
      ? dueThisMonthMinor(finance.charges.filter((charge) => charge.status !== "void"))
      : BigInt(0);

  const projectRows =
    finance != null
      ? board
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
          .sort((a, b) => Number(b.money.remainingMinor - a.money.remainingMinor))
      : [];

  const orgRemaining = projectRows.reduce(
    (sum, row) => sum + row.money.remainingMinor,
    BigInt(0),
  );
  const unbilledMinor =
    finance != null && orgRemaining > finance.snapshot.outstandingMinor
      ? orgRemaining - finance.snapshot.outstandingMinor
      : BigInt(0);

  const activeProjects = board.filter(
    (row) => row.project.status === "active" || row.project.status === "planning",
  ).length;
  const openTasks = board.reduce((sum, row) => sum + row.openTasks, 0);
  const partnerPayable =
    seeMoney && seePartners
      ? balances
          .filter((row) => row.active)
          .reduce((sum, row) => sum + row.payableMinor, BigInt(0))
      : BigInt(0);

  const owingGroups =
    finance != null
      ? groupChargesByClient(
          finance.charges.filter(
            (charge) => charge.status !== "void" && charge.outstandingMinor > BigInt(0),
          ),
          names,
        ).slice(0, 6)
      : [];

  const pipelineStages = openPipelineStages(stages);
  const openLeads = leads.filter((lead) => !isClosedStage(lead.stage, stages));
  const pipelineValue = openLeads.reduce(
    (sum, lead) => sum + (lead.estimatedValueMinor ?? BigInt(0)),
    BigInt(0),
  );
  const stageCounts = pipelineStages.map((stage) => ({
    stage: stage.slug,
    label: stage.name,
    count: leads.filter((lead) => lead.stage === stage.slug).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((row) => row.count));

  const collectionTrend = months.map((month) => {
    const statement = statements.find((row) => row.yearMonth === month);
    const collected = statement?.payments ?? BigInt(0);
    return { month, collected };
  });

  const moneyActivityVerbs = new Set([
    "charged",
    "paid",
    "refunded",
    "voided",
    "invoice_issued",
  ]);
  const recentActivities = seeMoney
    ? dash.activities
    : dash.activities.filter((row) => !moneyActivityVerbs.has(row.verb));

  return (
    <WorkSurface>
      <StudioToolbar purpose={JOURNEY.home.purpose} />
      <PageShell className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 pt-1">
      {emptyStudio ? (
        <EmptyState
          fill
          title={
            seeCrm ? JOURNEY.leads.emptyTitle : JOURNEY.clients.emptyTitle
          }
          body={
            seeCrm
              ? "Start with a lead. Win it, become a client, then deliver and collect — without retyping."
              : "Money, delivery, and pipeline roll up here once work starts."
          }
          actionHref={
            ctx.canWrite
              ? seeCrm
                ? `/${orgSlug}/crm?new=1`
                : `/${orgSlug}/clients?new=1`
              : undefined
          }
          actionLabel={
            ctx.canWrite
              ? seeCrm
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
                  {seeMoney && doNext.amountMinor != null && doNext.currency
                    ? ` · ${moneyLabel(doNext.amountMinor, doNext.currency)}`
                    : ""}
                </Button>
              }
            />
          ) : null}
          {seeMoney ? (
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
          ) : null}

          {seeMoney && finance != null ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-2xl lane-inset p-5">
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
              <div className="mt-5 rounded-xl bg-status-due px-4 py-3 text-sm text-status-due-fg">
                Collecting on time keeps partner payables honest and projects funded.
              </div>
            </div>

            <div className="flex flex-col rounded-2xl lane-inset p-5">
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
            </div>
          </div>
          ) : null}

          <div className="lane-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href={`/${orgSlug}/clients`} className="block">
              <SoftStatCard
                label="Clients"
                value={String(clients.length)}
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
            {seeMoney && seePartners ? (
              <Link href={`/${orgSlug}/partners`} className="block">
                <SoftStatCard
                  label="Partner payable"
                  value={moneyLabel(partnerPayable, currency)}
                  hint="Earned minus settled"
                  tone="amber"
                  fill={moneyFill(partnerPayable, partnerPayable + dash.collectedMinor)}
                />
              </Link>
            ) : null}
            {seeCrm ? (
              <Link href={`/${orgSlug}/crm`} className="block">
                <SoftStatCard
                  label="Pipeline"
                  value={
                    seeMoney
                      ? moneyLabel(pipelineValue, currency)
                      : String(openLeads.length)
                  }
                  hint={
                    seeMoney
                      ? `${openLeads.length} open leads`
                      : openLeads.length === 1
                        ? "Open lead"
                        : "Open leads"
                  }
                  tone="violet"
                  badge={openLeads.length ? `${openLeads.length} open` : undefined}
                />
              </Link>
            ) : seeMoney ? (
              <Link href={`/${orgSlug}/finance`} className="block">
                <SoftStatCard
                  label="Open charges"
                  value={String(dash.openChargeCount)}
                  hint="Still outstanding"
                  tone="violet"
                />
              </Link>
            ) : null}
          </div>

          {seeMoney && finance != null ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl lane-inset p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">Projects</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Collected, due, and unbilled by project
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
                <ProjectMoneyCurves
                  rows={projectRows.slice(0, 8).map(({ project, money }) => {
                    const remainingMinor =
                      money.remainingMinor > money.outstandingMinor
                        ? money.remainingMinor - money.outstandingMinor
                        : BigInt(0);
                    return {
                      id: project.id,
                      label: project.name,
                      href: `/${orgSlug}/projects/${project.id}`,
                      meta: moneyLabel(money.outstandingMinor, project.currency),
                      collected: Number(money.collectedMinor),
                      due: Number(money.outstandingMinor),
                      remaining: Number(remainingMinor),
                      collectedLabel: moneyLabel(money.collectedMinor, project.currency),
                      dueLabel: moneyLabel(money.outstandingMinor, project.currency),
                      remainingLabel: moneyLabel(remainingMinor, project.currency),
                    };
                  })}
                />
              )}
            </div>

            <div className="flex min-h-0 flex-col rounded-2xl lane-inset p-5">
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
                        className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm transition-colors duration-150 hover:bg-muted/70"
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
            </div>
          </div>
          ) : null}

          {seeCrm && openLeads.length > 0 ? (
            <div className="rounded-2xl lane-inset p-5">
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
                    className="rounded-xl bg-card px-3.5 py-3.5 ring-1 ring-white/10"
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
            </div>
          ) : null}

          {(seeMoney || recentActivities.length > 0) ? (
          <div className="rounded-2xl lane-inset p-5">
            <p className="text-base font-semibold tracking-tight">Recent activity</p>
            {recentActivities.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {seeMoney
                  ? "Charges and receipts land here."
                  : "Client and project updates land here."}
              </p>
            ) : (
              <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-72">
                {recentActivities.map((row) => (
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
          </div>
          ) : null}
        </>
      )}
      </PageShell>
    </WorkSurface>
  );
}
