import Link from "next/link";
import { PageShell, Workbench } from "@/components/studio/composer";
import {
  AvatarMark,
  FilterChip,
  FilterChips,
  SoftCard,
  StudioToolbar,
  WorkSurface,
  moneyFill,
} from "@/components/studio/chrome";
import { DotStackChart, SoftStatCard } from "@/components/studio/charts";
import { MoneyDonut, MONEY_COLORS } from "@/components/studio/money-donut";
import { EmptyState } from "@/components/studio/empty-state";
import { Button } from "@/components/ui/button";
import { listClients } from "@/modules/clients/queries";
import { projectMoneyStats } from "@/modules/delivery/board";
import { listExpectedBillings, listProjectBoard } from "@/modules/delivery/queries";
import {
  CollectComposer,
  CreateChargeDialog,
} from "@/modules/finance/components/finance-forms";
import { ChargeSheet } from "@/modules/finance/components/charge-board";
import { PaymentSheet } from "@/modules/finance/components/payment-board";
import { moneyLabel } from "@/modules/finance/ledger";
import {
  collectTargets,
  dueThisMonthMinor,
  formatDay,
  groupChargesByClient,
} from "@/modules/finance/presentation";
import { loadMonthlyStatement, loadOrgFinance } from "@/modules/finance/queries";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney } from "@/shared/money";
import { cn } from "@/lib/utils";

function monthKeys(count: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function nextMonthKey(from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthShort(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

function inMonth(isoDay: string, month: string) {
  return isoDay.slice(0, 7) === month;
}

function resolveFinanceView(
  raw: string | undefined,
): "ledger" | "receipts" | "month" | "upcoming" {
  if (raw === "receipts" || raw === "month" || raw === "upcoming") return raw;
  return "ledger";
}

export default async function FinancePage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/finance">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "finance");
  const view = resolveFinanceView(typeof query.view === "string" ? query.view : undefined);
  const overdueOnly = query.filter === "overdue";
  const showCancelled = query.show === "cancelled";
  const month =
    typeof query.month === "string" && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : new Date().toISOString().slice(0, 7);
  const trendMonths = monthKeys(6);
  const upcomingMonth = nextMonthKey();

  const [clients, finance, statement, board, expectedBillings, ...trendStatements] =
    await Promise.all([
      listClients(orgSlug),
      loadOrgFinance(orgSlug),
      loadMonthlyStatement(orgSlug, month),
      listProjectBoard(orgSlug),
      listExpectedBillings(orgSlug).catch(() => []),
      ...trendMonths.map((key) => loadMonthlyStatement(orgSlug, key)),
    ]);

  const clientName = new Map(clients.map((client) => [client.id, client.name]));
  const clientOptions = clients.map((client) => ({
    id: client.id,
    name: client.name,
    currency: client.currency,
  }));

  const liveCharges = finance.charges.filter((charge) => charge.status !== "void");
  const owingSource = overdueOnly
    ? liveCharges.filter((charge) => charge.overdue && charge.outstandingMinor > BigInt(0))
    : liveCharges.filter((charge) => charge.outstandingMinor > BigInt(0));
  const owingGroups = groupChargesByClient(owingSource, clientName);
  const selectedId =
    (typeof query.client === "string" &&
    owingGroups.some((group) => group.clientId === query.client)
      ? query.client
      : null) ??
    owingGroups[0]?.clientId ??
    (typeof query.client === "string" ? query.client : undefined);
  const selectedGroup = owingGroups.find((group) => group.clientId === selectedId);
  const selectedCharges = selectedId
    ? finance.charges.filter((charge) => {
        if (charge.clientId !== selectedId) return false;
        if (showCancelled) return true;
        return charge.status !== "void" && charge.outstandingMinor > BigInt(0);
      })
    : [];
  const postedPayments = finance.payments.filter((row) => row.status === "posted");
  const selectedClient = clients.find((client) => client.id === selectedId);
  const selectedChargeId = typeof query.charge === "string" ? query.charge : undefined;
  const collectItems = collectTargets(
    selectedId
      ? finance.charges.filter((charge) => charge.clientId === selectedId)
      : [],
  );
  const returnHref = selectedId
    ? `/${orgSlug}/finance?client=${selectedId}${overdueOnly ? "&filter=overdue" : ""}`
    : `/${orgSlug}/finance`;
  const monthLabel = formatDay(`${month}-01`).replace(/ \d+,/, "");
  const monthDueMinor = dueThisMonthMinor(liveCharges);

  const projectRows = board
    .map((row) => {
      const projectCharges = finance.charges.filter(
        (charge) => charge.projectId === row.project.id,
      );
      const money = projectMoneyStats(row.project, projectCharges);
      return { project: row.project, money };
    })
    .filter(
      (row) =>
        row.money.totalPriceMinor > BigInt(0) ||
        row.money.outstandingMinor > BigInt(0) ||
        row.money.collectedMinor > BigInt(0),
    );

  const orgRemaining = projectRows.reduce(
    (sum, row) => sum + row.money.remainingMinor,
    BigInt(0),
  );
  const unbilledMinor =
    orgRemaining > finance.snapshot.outstandingMinor
      ? orgRemaining - finance.snapshot.outstandingMinor
      : BigInt(0);
  const currency = finance.snapshot.currency;

  const monthCharges = liveCharges
    .filter((charge) => inMonth(charge.chargedOn, month))
    .sort((a, b) => b.chargedOn.localeCompare(a.chargedOn));
  const monthPayments = postedPayments
    .filter((payment) => inMonth(payment.paidOn, month))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  const expectedThisMonth = expectedBillings.filter((row) => inMonth(row.dueOn, month));
  const expectedNextMonth = expectedBillings.filter((row) =>
    inMonth(row.dueOn, upcomingMonth),
  );
  const expectedThisMonthMinor = expectedThisMonth.reduce(
    (sum, row) => sum + row.amountMinor,
    BigInt(0),
  );
  const expectedNextMonthMinor = expectedNextMonth.reduce(
    (sum, row) => sum + row.amountMinor,
    BigInt(0),
  );

  const chargesDueNextMonth = liveCharges
    .filter(
      (charge) =>
        charge.outstandingMinor > BigInt(0) &&
        charge.dueOn != null &&
        inMonth(charge.dueOn, upcomingMonth),
    )
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));

  const cycleExpectedMinor = expectedThisMonthMinor + expectedNextMonthMinor;
  const cyclePostedDueMinor =
    monthDueMinor +
    chargesDueNextMonth.reduce((sum, row) => sum + row.outstandingMinor, BigInt(0));
  const cycleTotalMinor = cycleExpectedMinor + cyclePostedDueMinor;
  const upcomingMonthLabel = monthShort(upcomingMonth);

  const thisMonthChargeRows = liveCharges
    .filter(
      (charge) =>
        inMonth(charge.chargedOn, month) ||
        (charge.dueOn != null && inMonth(charge.dueOn, month)),
    )
    .sort((a, b) => {
      const aDay = a.dueOn ?? a.chargedOn;
      const bDay = b.dueOn ?? b.chargedOn;
      return aDay.localeCompare(bDay);
    });

  const thisMonthBreakdownRows: {
    id: string;
    date: string;
    clientId: string;
    clientName: string;
    projectId: string | null;
    projectName: string | null;
    label: string;
    kind: "charge" | "expected";
    collectedMinor: bigint;
    dueMinor: bigint;
    currency: "USD" | "INR";
    href: string;
    actionLabel: string;
  }[] = [];

  for (const charge of thisMonthChargeRows) {
    const projectMeta = charge.projectId
      ? board.find((row) => row.project.id === charge.projectId)?.project
      : null;
    thisMonthBreakdownRows.push({
      id: `charge-${charge.id}`,
      date: charge.dueOn ?? charge.chargedOn,
      clientId: charge.clientId,
      clientName: clientName.get(charge.clientId) ?? "Client",
      projectId: charge.projectId,
      projectName: projectMeta?.name ?? null,
      label: charge.memo || "Charge",
      kind: "charge",
      collectedMinor: charge.allocatedMinor,
      dueMinor: charge.outstandingMinor,
      currency: charge.currency,
      href:
        charge.outstandingMinor > BigInt(0)
          ? `/${orgSlug}/finance?client=${charge.clientId}&charge=${charge.id}#collect`
          : charge.projectId
            ? `/${orgSlug}/projects/${charge.projectId}?tab=charges`
            : `/${orgSlug}/clients/${charge.clientId}`,
      actionLabel: charge.outstandingMinor > BigInt(0) ? "Collect" : "Open",
    });
  }

  for (const row of expectedThisMonth) {
    thisMonthBreakdownRows.push({
      id: `expected-${row.milestoneId}`,
      date: row.dueOn,
      clientId: row.clientId,
      clientName: row.clientName,
      projectId: row.projectId,
      projectName: row.projectName,
      label: row.name,
      kind: "expected",
      collectedMinor: BigInt(0),
      dueMinor: row.amountMinor,
      currency: row.currency,
      href: `/${orgSlug}/projects/${row.projectId}?tab=milestones&bill=${row.milestoneId}`,
      actionLabel: "Bill",
    });
  }

  thisMonthBreakdownRows.sort((a, b) => {
    const byClient = a.clientName.localeCompare(b.clientName);
    if (byClient !== 0) return byClient;
    const byProject = (a.projectName ?? "").localeCompare(b.projectName ?? "");
    if (byProject !== 0) return byProject;
    return a.date.localeCompare(b.date);
  });

  const thisMonthBreakdownCollected = thisMonthBreakdownRows.reduce(
    (sum, row) => sum + row.collectedMinor,
    BigInt(0),
  );
  const thisMonthBreakdownDue = thisMonthBreakdownRows.reduce(
    (sum, row) => sum + row.dueMinor,
    BigInt(0),
  );

  const tabs = [
    { id: "ledger", href: `/${orgSlug}/finance`, label: "Ledger", active: view === "ledger" },
    {
      id: "upcoming",
      href: `/${orgSlug}/finance?view=upcoming`,
      label: "Upcoming",
      active: view === "upcoming",
    },
    {
      id: "receipts",
      href: `/${orgSlug}/finance?view=receipts`,
      label: "Receipts",
      active: view === "receipts",
    },
    {
      id: "month",
      href: `/${orgSlug}/finance?view=month&month=${month}`,
      label: "Month",
      active: view === "month",
    },
  ] as const;

  const insightStrip = (
    <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <SoftStatCard
        label="Due"
        value={moneyLabel(finance.snapshot.outstandingMinor, currency)}
        hint="Open on the ledger"
        tone="sky"
        fill={moneyFill(finance.snapshot.outstandingMinor, finance.snapshot.billedMinor)}
      />
      <SoftStatCard
        label="Overdue"
        value={moneyLabel(finance.snapshot.overdueMinor, currency)}
        hint="Past due date"
        tone="amber"
        badge={finance.snapshot.overdueMinor > BigInt(0) ? "Needs collect" : undefined}
        fill={moneyFill(finance.snapshot.overdueMinor, finance.snapshot.outstandingMinor)}
      />
      <SoftStatCard
        label="Collected"
        value={moneyLabel(finance.snapshot.collectedMinor, currency)}
        hint="Allocated receipts"
        tone="emerald"
        fill={moneyFill(finance.snapshot.collectedMinor, finance.snapshot.billedMinor)}
      />
      <SoftStatCard
        label="This cycle"
        value={moneyLabel(cycleTotalMinor, currency)}
        hint={`${monthLabel} + ${upcomingMonthLabel} · expected & due`}
        tone="violet"
        fill={moneyFill(
          cycleTotalMinor,
          cycleTotalMinor + finance.snapshot.outstandingMinor,
        )}
      />
      <SoftStatCard
        label="Next month"
        value={moneyLabel(expectedNextMonthMinor, currency)}
        hint={`${upcomingMonthLabel} unbilled milestones`}
        tone="sky"
        fill={moneyFill(
          expectedNextMonthMinor,
          expectedNextMonthMinor + finance.snapshot.outstandingMinor,
        )}
      />
      <SoftStatCard
        label="Unallocated"
        value={moneyLabel(finance.snapshot.unallocatedMinor, currency)}
        hint="Receipt credit not applied"
        tone="slate"
        fill={moneyFill(
          finance.snapshot.unallocatedMinor,
          finance.snapshot.collectedMinor + finance.snapshot.unallocatedMinor,
        )}
      />
    </div>
  );

  const insightBand = (
    <div className="grid shrink-0 gap-4 lg:grid-cols-2">
      <SoftCard className="p-5">
        <p className="text-sm font-semibold tracking-tight">Money mix</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Collected vs due vs still unbilled on contracts
        </p>
        <div className="mt-4">
          <MoneyDonut
            size="md"
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
                key: "unbilled",
                label: `Unbilled · ${moneyLabel(unbilledMinor, currency)}`,
                value: Number(unbilledMinor),
                color: MONEY_COLORS.remaining,
              },
            ]}
          />
        </div>
      </SoftCard>
      <SoftCard className="flex flex-col p-5">
        <p className="text-sm font-semibold tracking-tight">Collections</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Net receipts by month</p>
        <div className="mt-4 flex-1">
          <DotStackChart
            rows={trendMonths.map((key, index) => {
              const row = trendStatements[index];
              const collected = row?.payments ?? BigInt(0);
              return {
                id: key,
                label: monthShort(key),
                value: Number(collected),
                meta:
                  collected > BigInt(0)
                    ? formatMoney({ amountMinor: collected, currency })
                    : undefined,
              };
            })}
          />
        </div>
      </SoftCard>
    </div>
  );

  return (
    <WorkSurface>
      <StudioToolbar
        purpose="Ledger sheet — what’s owed, collected, and carried forward"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${orgSlug}/invoices`} />}
            >
              Invoices
            </Button>
            {ctx.canWrite ? (
              <CreateChargeDialog
                key={String(query.new)}
                orgSlug={orgSlug}
                clients={clientOptions}
                defaultClientId={selectedId}
                defaultOpen={query.new === "charge"}
                returnHref={returnHref}
                triggerVariant="outline"
              />
            ) : null}
          </div>
        }
      />

      <FilterChips className="border-b border-border/40">
        {tabs.map((item) => (
          <FilterChip key={item.id} href={item.href} active={item.active}>
            {item.label}
          </FilterChip>
        ))}
      </FilterChips>

      {view === "ledger" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-4">
          {insightStrip}

          <SoftCard className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-4 py-3">
              <div>
                <p className="font-heading text-lg font-semibold tracking-tight">
                  This month · {monthLabel}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Posted charges and expected milestones — collected vs still due
                </p>
              </div>
              <div className="text-right">
                <p className="font-heading text-xl font-semibold tabular-nums tracking-tight">
                  {moneyLabel(thisMonthBreakdownDue, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {moneyLabel(thisMonthBreakdownCollected, currency)} collected ·{" "}
                  {moneyLabel(thisMonthBreakdownDue, currency)} due
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {thisMonthBreakdownRows.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium">Nothing for {monthLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Charges charged or due this month, plus unbilled milestones due now, show
                    here.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/${orgSlug}/finance?view=upcoming`} />}
                    >
                      All upcoming
                    </Button>
                  </div>
                </div>
              ) : (
                <table className="w-full min-w-[48rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="px-3 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Client</th>
                      <th className="px-3 py-2.5 font-semibold">Project</th>
                      <th className="px-3 py-2.5 font-semibold">Item</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Collected</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Due</th>
                      <th className="px-3 py-2.5 text-right font-semibold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {thisMonthBreakdownRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/25">
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                          {formatDay(row.date)}
                          {row.kind === "expected" ? (
                            <span className="ml-2 text-[10px] font-medium text-amber-800">
                              expected
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/${orgSlug}/clients/${row.clientId}`}
                            className="font-medium hover:underline"
                          >
                            {row.clientName}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          {row.projectId && row.projectName ? (
                            <Link
                              href={`/${orgSlug}/projects/${row.projectId}`}
                              className="hover:underline"
                            >
                              {row.projectName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
                          {row.label}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {row.collectedMinor > BigInt(0)
                            ? moneyLabel(row.collectedMinor, row.currency)
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {row.dueMinor > BigInt(0)
                            ? moneyLabel(row.dueMinor, row.currency)
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            nativeButton={false}
                            render={<Link href={row.href} />}
                          >
                            {row.actionLabel}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/40 text-sm font-semibold">
                      <td className="px-3 py-2.5" colSpan={4}>
                        Total
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {moneyLabel(thisMonthBreakdownCollected, currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {moneyLabel(thisMonthBreakdownDue, currency)}
                      </td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </SoftCard>

          {insightBand}

          <Workbench className="min-h-[22rem] flex-col gap-3 md:flex-row">
            <SoftCard className="flex max-h-52 w-full shrink-0 flex-col md:max-h-none md:w-72">
              <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
                <div>
                  <p className="text-sm font-semibold tracking-tight">Clients owing</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {owingGroups.length} open
                  </p>
                </div>
                <div className="flex gap-1">
                  <FilterChip href={`/${orgSlug}/finance`} active={!overdueOnly}>
                    All
                  </FilterChip>
                  <FilterChip href={`/${orgSlug}/finance?filter=overdue`} active={overdueOnly}>
                    Overdue
                  </FilterChip>
                </div>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {owingGroups.length === 0 ? (
                  <li className="px-3 py-8 text-sm text-muted-foreground">
                    {overdueOnly ? "Nothing overdue." : "Caught up."}
                  </li>
                ) : (
                  owingGroups.map((group) => {
                    const href = `/${orgSlug}/finance?client=${group.clientId}${
                      overdueOnly ? "&filter=overdue" : ""
                    }`;
                    const active = group.clientId === selectedId;
                    return (
                      <li key={group.clientId}>
                        <Link
                          href={href}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                            active ? "bg-muted" : "hover:bg-muted/60",
                          )}
                        >
                          <AvatarMark name={group.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {moneyLabel(group.outstandingMinor, group.currency)}
                          </span>
                        </Link>
                      </li>
                    );
                  })
                )}
              </ul>
            </SoftCard>

            <SoftCard className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-heading text-lg font-semibold tracking-tight">
                    {selectedGroup?.name ?? selectedClient?.name ?? "Select a client"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedGroup
                      ? `${moneyLabel(selectedGroup.outstandingMinor, selectedGroup.currency)} due on the sheet`
                      : "Pick a client to collect against open charges"}
                  </p>
                </div>
                <Link
                  href={
                    showCancelled
                      ? returnHref
                      : returnHref.includes("?")
                        ? `${returnHref}&show=cancelled`
                        : `${returnHref}?show=cancelled`
                  }
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showCancelled ? "Hide cancelled" : "Show cancelled"}
                </Link>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {owingGroups.length === 0 && !selectedId ? (
                  <EmptyState
                    fill
                    title={JOURNEY.finance.emptyCollectTitle}
                    body={JOURNEY.finance.emptyCollectBody}
                    actionHref={ctx.canWrite ? `/${orgSlug}/finance?new=charge` : undefined}
                    actionLabel={ctx.canWrite ? "New charge" : undefined}
                  />
                ) : (
                  <ChargeSheet
                    orgSlug={orgSlug}
                    charges={selectedCharges}
                    canWrite={ctx.canWrite}
                    showCancelled={showCancelled}
                    activeChargeId={selectedChargeId}
                    collectHref={
                      selectedId
                        ? (chargeId) => {
                            const params = new URLSearchParams();
                            params.set("client", selectedId);
                            if (overdueOnly) params.set("filter", "overdue");
                            if (showCancelled) params.set("show", "cancelled");
                            params.set("charge", chargeId);
                            return `/${orgSlug}/finance?${params.toString()}#collect`;
                          }
                        : undefined
                    }
                  />
                )}
              </div>

              {ctx.canWrite ? (
                <CollectComposer
                  orgSlug={orgSlug}
                  clientId={selectedId}
                  disabled={!selectedId}
                  targets={collectItems}
                  defaultChargeId={selectedChargeId}
                />
              ) : null}
            </SoftCard>
          </Workbench>
        </PageShell>
      ) : null}

      {view === "receipts" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-4 pt-4">
          {insightStrip}
          <SoftCard className="min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="font-heading text-lg font-semibold tracking-tight">Receipt sheet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Posted receipts and refunds · {postedPayments.length} rows
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PaymentSheet
                orgSlug={orgSlug}
                payments={finance.payments}
                names={clientName}
                canWrite={ctx.canWrite}
                allocations={finance.allocations}
                charges={finance.charges}
              />
            </div>
          </SoftCard>
        </PageShell>
      ) : null}

      {view === "upcoming" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-4 pt-4">
          {insightStrip}
          <SoftCard className="min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="font-heading text-lg font-semibold tracking-tight">
                Upcoming billings
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Unbilled milestones by due date — expected cash, not posted charges yet. Bill from
                the project when ready.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {expectedBillings.length === 0 ? (
                <EmptyState
                  fill
                  title="No upcoming milestones"
                  body="Add due dates and amounts on unbilled milestones to forecast the next cycle."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                        <th className="px-3 py-2.5 font-semibold">Due</th>
                        <th className="px-3 py-2.5 font-semibold">Client</th>
                        <th className="px-3 py-2.5 font-semibold">Project</th>
                        <th className="px-3 py-2.5 font-semibold">Milestone</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Expected</th>
                        <th className="px-3 py-2.5 text-right font-semibold"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expectedBillings.map((row) => (
                        <tr key={row.milestoneId} className="border-b border-border/25">
                          <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                            {formatDay(row.dueOn)}
                            {inMonth(row.dueOn, upcomingMonth) ? (
                              <span className="ml-2 text-[10px] font-medium text-sky-800">
                                next month
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/${orgSlug}/clients/${row.clientId}`}
                              className="font-medium hover:underline"
                            >
                              {row.clientName}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/${orgSlug}/projects/${row.projectId}`}
                              className="hover:underline"
                            >
                              {row.projectName}
                            </Link>
                          </td>
                          <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
                            {row.name}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {moneyLabel(row.amountMinor, row.currency)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              nativeButton={false}
                              render={
                                <Link
                                  href={`/${orgSlug}/projects/${row.projectId}?tab=milestones&bill=${row.milestoneId}`}
                                />
                              }
                            >
                              Bill
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SoftCard>
        </PageShell>
      ) : null}

      {view === "month" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-4">
          <SoftCard className="shrink-0 p-5">
            <form className="mb-5 flex flex-wrap items-end gap-3">
              <input type="hidden" name="view" value="month" />
              <label className="text-sm text-muted-foreground">
                Month
                <input
                  type="month"
                  name="month"
                  defaultValue={month}
                  className="ml-2 h-9 rounded-full border border-input bg-transparent px-3 text-sm"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Show
              </button>
              <p className="text-sm text-muted-foreground">{monthLabel} carry-forward</p>
            </form>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SoftStatCard
                label="Opening"
                value={moneyLabel(statement.opening, statement.currency)}
                hint="Carried in"
                tone="slate"
              />
              <SoftStatCard
                label="Charged"
                value={moneyLabel(statement.newCharges, statement.currency)}
                hint="Posted this month"
                tone="sky"
              />
              <SoftStatCard
                label="Expected"
                value={moneyLabel(expectedThisMonthMinor, currency)}
                hint="Unbilled milestones due"
                tone="amber"
              />
              <SoftStatCard
                label="Collected"
                value={moneyLabel(statement.payments, statement.currency)}
                hint="Net receipts"
                tone="emerald"
              />
              <SoftStatCard
                label="Closing"
                value={moneyLabel(statement.closing, statement.currency)}
                hint="Ends the month"
                tone="violet"
              />
            </div>
          </SoftCard>

          <SoftCard className="overflow-hidden">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-sm font-semibold tracking-tight">
                Expected billings · {monthLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Milestones due this month that are not charged yet — bill to post them to the
                ledger
              </p>
            </div>
            {expectedThisMonth.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                No unbilled milestones due in {monthLabel}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="px-3 py-2.5 font-semibold">Due</th>
                      <th className="px-3 py-2.5 font-semibold">Client</th>
                      <th className="px-3 py-2.5 font-semibold">Milestone</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Expected</th>
                      <th className="px-3 py-2.5 text-right font-semibold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expectedThisMonth.map((row) => (
                      <tr key={row.milestoneId} className="border-b border-border/25">
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                          {formatDay(row.dueOn)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">{row.clientName}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{row.name}</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {row.projectName}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {moneyLabel(row.amountMinor, row.currency)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            nativeButton={false}
                            render={
                              <Link
                                href={`/${orgSlug}/projects/${row.projectId}?tab=milestones&bill=${row.milestoneId}`}
                              />
                            }
                          >
                            Bill
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SoftCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SoftCard className="overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3">
                <p className="text-sm font-semibold tracking-tight">Charges this month</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {monthCharges.length} posted · {moneyLabel(statement.newCharges, currency)}
                </p>
              </div>
              <ChargeSheet
                orgSlug={orgSlug}
                charges={monthCharges}
                canWrite={ctx.canWrite}
                clientName={(id) => clientName.get(id) ?? "Client"}
              />
            </SoftCard>
            <SoftCard className="overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3">
                <p className="text-sm font-semibold tracking-tight">Receipts this month</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {monthPayments.length} posted · {moneyLabel(statement.payments, currency)}
                </p>
              </div>
              <PaymentSheet
                orgSlug={orgSlug}
                payments={monthPayments}
                names={clientName}
                canWrite={ctx.canWrite}
                allocations={finance.allocations}
                charges={finance.charges}
              />
            </SoftCard>
          </div>
        </PageShell>
      ) : null}
    </WorkSurface>
  );
}
