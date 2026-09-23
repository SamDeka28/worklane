import Link from "next/link";
import { PageShell, Workbench } from "@/components/studio/composer";
import {
  AvatarMark,
  FilterChip,
  FilterChips,
  NextStepCard,
  SoftCard,
  Stat,
  StudioToolbar,
  WorkSurface,
  moneyFill,
  type StatTone,
} from "@/components/studio/chrome";
import { DotStackChart } from "@/components/studio/charts";
import { MoneyDonut, MONEY_COLORS } from "@/components/studio/money-donut";
import { EmptyState } from "@/components/studio/empty-state";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { listClients } from "@/modules/clients/queries";
import { projectMoneyStats } from "@/modules/delivery/board";
import { listExpectedBillings, listProjectBoard } from "@/modules/delivery/queries";
import {
  CollectComposer,
  CreateChargeDialog,
} from "@/modules/finance/components/finance-forms";
import { ChargeSheet } from "@/modules/finance/components/charge-board";
import { PaymentSheet } from "@/modules/finance/components/payment-board";
import { moneyLabel, type ChargeView } from "@/modules/finance/ledger";
import {
  collectTargets,
  dueThisMonthMinor,
  formatDay,
  groupChargesByClient,
} from "@/modules/finance/presentation";
import {
  loadMonthlyStatement,
  loadMonthlyStatements,
  loadOrgFinance,
} from "@/modules/finance/queries";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { FinanceMonthPicker } from "@/modules/finance/components/finance-month-picker";
import { FinancePartnerSettlePanel } from "@/modules/finance/components/finance-partner-settle-panel";
import type { PartnerSharesChargeDetail } from "@/modules/finance/components/finance-partner-shares-dialog";
import { formatSplitVisualLines } from "@/modules/finance/components/partner-split-hint";
import {
  loadFinancePartnerFlow,
  listPartners,
  type FinancePartnerShare,
} from "@/modules/partners/queries";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney } from "@/shared/money";
import { cn } from "@/lib/utils";

function partnerShareChargeDetailsFrom(
  charges: ChargeView[],
  byChargeId: Record<string, FinancePartnerShare[]>,
  names: Map<string, string>,
): PartnerSharesChargeDetail[] {
  return charges.flatMap((charge) => {
    const lines = byChargeId[charge.id] ?? [];
    if (lines.length === 0) return [];
    return [
      {
        chargeId: charge.id,
        memo: charge.memo || "Untitled charge",
        clientName: names.get(charge.clientId) ?? "Client",
        grossLabel: moneyLabel(charge.grossMinor, charge.currency),
        lines: formatSplitVisualLines(lines),
      },
    ];
  });
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

function FinanceHero({
  label,
  value,
  hint,
  footnote,
  doNext,
}: {
  label: string;
  value: string;
  hint?: string;
  footnote?: string;
  doNext?: ReactNode;
}) {
  return (
    <div className="shrink-0 space-y-3">
      <SoftCard className="px-4 py-4 sm:px-5 sm:py-4">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1.5 font-heading text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          {value}
        </p>
        {hint ? <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p> : null}
        {footnote ? (
          <p className="mt-1 text-xs text-muted-foreground/90">{footnote}</p>
        ) : null}
      </SoftCard>
      {doNext}
    </div>
  );
}

function FinanceSecondary({
  items,
}: {
  items: {
    label: string;
    value: string;
    hint?: string;
    tone?: StatTone;
    fill?: number;
    badge?: string;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        "grid shrink-0 gap-3",
        items.length === 1 ? "max-w-sm" : "sm:grid-cols-2",
      )}
    >
      {items.map((item) => (
        <Stat
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          tone={item.tone}
          fill={item.fill}
          badge={item.badge}
          variant="strip"
        />
      ))}
    </div>
  );
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
  const needBoard = view === "ledger";
  const needTrends = view === "ledger";
  const needStatement = view === "month";
  /** Ledger insight + upcoming table + month wrap “ready to bill”. Not receipts. */
  const needExpected = view === "ledger" || view === "upcoming" || view === "month";
  const needPartners =
    Boolean(ctx.org.modules.partners) &&
    (view === "ledger" || view === "month" || view === "receipts");

  const [clients, finance, board, expectedBillings, trendStatements, statement] =
    await Promise.all([
      listClients(orgSlug),
      loadOrgFinance(orgSlug),
      needBoard
        ? listProjectBoard(orgSlug)
        : Promise.resolve([] as Awaited<ReturnType<typeof listProjectBoard>>),
      needExpected
        ? listExpectedBillings(orgSlug).catch(() => [])
        : Promise.resolve([] as Awaited<ReturnType<typeof listExpectedBillings>>),
      needTrends
        ? loadMonthlyStatements(orgSlug, trendMonths)
        : Promise.resolve(
            [] as Awaited<ReturnType<typeof loadMonthlyStatements>>,
          ),
      needStatement
        ? loadMonthlyStatement(orgSlug, month)
        : Promise.resolve(null),
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

  const tabs = [
    { id: "ledger", href: `/${orgSlug}/finance`, label: "Collect", active: view === "ledger" },
    {
      id: "upcoming",
      href: `/${orgSlug}/finance?view=upcoming`,
      label: "To bill",
      active: view === "upcoming",
    },
    {
      id: "receipts",
      href: `/${orgSlug}/finance?view=receipts`,
      label: "Money in",
      active: view === "receipts",
    },
    {
      id: "month",
      href: `/${orgSlug}/finance?view=month&month=${month}`,
      label: "Month wrap",
      active: view === "month",
    },
  ] as const;

  const emptyPartnerFlow = {
    byChargeId: {} as Record<string, FinancePartnerShare[]>,
    byPaymentId: {} as Record<string, FinancePartnerShare[]>,
    month: null as Awaited<ReturnType<typeof loadFinancePartnerFlow>>["month"],
    payables: [] as Awaited<ReturnType<typeof loadFinancePartnerFlow>>["payables"],
  };

  const [partnerFlow, partnerRoster] = needPartners
    ? await Promise.all([
        loadFinancePartnerFlow(orgSlug, {
          chargeIds:
            view === "ledger" || view === "month"
              ? (view === "month" ? monthCharges : liveCharges).map((charge) => charge.id)
              : [],
          paymentIds:
            view === "receipts" || view === "month"
              ? (view === "month" ? monthPayments : postedPayments).map((payment) => payment.id)
              : [],
          month: view === "month" ? month : undefined,
          includePayables: true,
        }).catch(() => emptyPartnerFlow),
        listPartners(orgSlug).catch(() => []),
      ])
    : [emptyPartnerFlow, [] as Awaited<ReturnType<typeof listPartners>>];

  const partnerShareChargeDetails = partnerShareChargeDetailsFrom(
    view === "month" ? monthCharges : liveCharges,
    partnerFlow.byChargeId,
    clientName,
  );

  const overdueMinor = finance.snapshot.overdueMinor;
  const dueMinor = finance.snapshot.outstandingMinor;
  const hasOverdue = overdueMinor > BigInt(0);
  const ledgerHeroLabel = hasOverdue ? "Past due" : "Clients owe";
  const ledgerHeroValue = moneyLabel(hasOverdue ? overdueMinor : dueMinor, currency);
  const ledgerHeroHint = hasOverdue
    ? "Past due. Record payment first"
    : "Open charges waiting for payment";

  const ledgerDoNext = (() => {
    if (hasOverdue) {
      return (
        <NextStepCard
          title={`Collect past due · ${moneyLabel(overdueMinor, currency)}`}
          body="Past-due charges need attention before anything else."
          action={
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={`/${orgSlug}/finance?filter=overdue`} />}
            >
              Collect
            </Button>
          }
        />
      );
    }
    if (dueMinor > BigInt(0)) {
      return (
        <NextStepCard
          title={`Collect · ${moneyLabel(dueMinor, currency)}`}
          body="Pick someone who owes you and record a payment."
          action={
            <Button size="sm" nativeButton={false} render={<Link href={`/${orgSlug}/finance`} />}>
              Collect
            </Button>
          }
        />
      );
    }
    if (finance.snapshot.unallocatedMinor > BigInt(0)) {
      return (
        <NextStepCard
          title={`Apply leftover · ${moneyLabel(finance.snapshot.unallocatedMinor, currency)}`}
          body="Payment not applied yet. Open Money in or apply it on Collect."
          action={
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={`/${orgSlug}/finance?view=receipts`} />}
            >
              Money in
            </Button>
          }
        />
      );
    }
    if (expectedBillings.length > 0) {
      return (
        <NextStepCard
          title={`Bill next · ${expectedBillings.length} milestones`}
          body="Nothing to collect. Turn milestones into charges on To bill."
          action={
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={`/${orgSlug}/finance?view=upcoming`} />}
            >
              To bill
            </Button>
          }
        />
      );
    }
    if (partnerFlow.payables.length > 0) {
      const totalPayable = partnerFlow.payables.reduce(
        (sum, row) => sum + row.payableMinor,
        BigInt(0),
      );
      const currencyForPay = partnerFlow.payables[0]?.currency ?? currency;
      return (
        <NextStepCard
          title={`Settle partners · ${moneyLabel(totalPayable, currencyForPay)}`}
          body="Clients are caught up. Pay out partner shares below."
          action={
            <Button size="sm" nativeButton={false} render={<Link href="#partner-settle" />}>
              Settle
            </Button>
          }
        />
      );
    }
    return null;
  })();

  const receiptsDoNext =
    finance.snapshot.unallocatedMinor > BigInt(0) ? (
      <NextStepCard
        title={`Apply leftover · ${moneyLabel(finance.snapshot.unallocatedMinor, currency)}`}
        body="Payment not applied. Assign it against open charges on Collect."
        action={
          <Button size="sm" nativeButton={false} render={<Link href={`/${orgSlug}/finance`} />}>
            Collect
          </Button>
        }
      />
    ) : dueMinor > BigInt(0) ? (
      <NextStepCard
        title={`Collect · ${moneyLabel(dueMinor, currency)}`}
        body="Open charges still need a payment."
        action={
          <Button size="sm" nativeButton={false} render={<Link href={`/${orgSlug}/finance`} />}>
            Collect
          </Button>
        }
      />
    ) : null;

  const insightBand = (
    <div className="grid shrink-0 gap-4 lg:grid-cols-2">
      <SoftCard className="p-5">
        <p className="text-sm font-semibold tracking-tight">Money mix</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Paid to you vs clients owe vs still unbilled on contracts
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
                label: `Paid to you · ${moneyLabel(finance.snapshot.collectedMinor, currency)}`,
                value: Number(finance.snapshot.collectedMinor),
                color: MONEY_COLORS.collected,
              },
              {
                key: "due",
                label: `Clients owe · ${moneyLabel(finance.snapshot.outstandingMinor, currency)}`,
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
            rows={trendMonths.map((key) => {
              const row = trendStatements.find((item) => item.yearMonth === key);
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
        purpose={JOURNEY.finance.purpose}
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
                triggerLabel="Add charge"
                triggerVariant="default"
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

      <p className="shrink-0 border-b border-border/30 px-5 py-2.5 text-xs text-muted-foreground">
        <Link href={`/${orgSlug}/finance?view=upcoming`} className="hover:text-foreground hover:underline">
          Bill work
        </Link>
        {" → "}
        <Link href={`/${orgSlug}/finance`} className="hover:text-foreground hover:underline">
          Record payment
        </Link>
        {ctx.org.modules.partners ? (
          <>
            {" → "}
            <Link href={`/${orgSlug}/partners`} className="hover:text-foreground hover:underline">
              Partners share
            </Link>
          </>
        ) : null}
        {" → Done"}
      </p>

      {view === "ledger" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <FinanceHero
            label={ledgerHeroLabel}
            value={ledgerHeroValue}
            hint={ledgerHeroHint}
            doNext={ledgerDoNext}
          />
          <FinanceSecondary
            items={[
              {
                label: "Paid to you",
                value: moneyLabel(finance.snapshot.collectedMinor, currency),
                hint: "Payments applied to charges",
                tone: "emerald",
                fill: moneyFill(
                  finance.snapshot.collectedMinor,
                  finance.snapshot.billedMinor,
                ),
              },
              {
                label: "Payment not applied",
                value: moneyLabel(finance.snapshot.unallocatedMinor, currency),
                hint: "Leftover credit waiting to apply",
                tone: "slate",
                fill: moneyFill(
                  finance.snapshot.unallocatedMinor,
                  finance.snapshot.collectedMinor + finance.snapshot.unallocatedMinor,
                ),
              },
            ]}
          />

          <Workbench className="min-h-[min(70vh,42rem)] flex-col gap-3 md:flex-row">
            <SoftCard className="flex max-h-52 w-full shrink-0 flex-col md:max-h-none md:w-72">
              <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
                <div>
                  <p className="text-sm font-semibold tracking-tight">Who owes you</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {owingGroups.length} open
                  </p>
                </div>
                <div className="flex gap-1">
                  <FilterChip href={`/${orgSlug}/finance`} active={!overdueOnly}>
                    All
                  </FilterChip>
                  <FilterChip href={`/${orgSlug}/finance?filter=overdue`} active={overdueOnly}>
                    Past due
                  </FilterChip>
                </div>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {owingGroups.length === 0 ? (
                  <li className="px-3 py-8 text-sm text-muted-foreground">
                    {overdueOnly ? "Nothing past due." : "Caught up."}
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
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
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
                    {selectedGroup?.name ?? selectedClient?.name ?? "Pick someone who owes you"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedGroup
                      ? `${moneyLabel(selectedGroup.outstandingMinor, selectedGroup.currency)} still to collect`
                      : "Pick someone who owes you, then record a payment"}
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
                    body={
                      expectedBillings.length > 0
                        ? "Nothing to collect. Bill upcoming milestones when ready."
                        : JOURNEY.finance.emptyCollectBody
                    }
                    actionHref={
                      expectedBillings.length > 0
                        ? `/${orgSlug}/finance?view=upcoming`
                        : ctx.canWrite
                          ? `/${orgSlug}/finance?new=charge`
                          : undefined
                    }
                    actionLabel={
                      expectedBillings.length > 0
                        ? "To bill"
                        : ctx.canWrite
                          ? "Add charge"
                          : undefined
                    }
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

          {partnerFlow.payables.length > 0 ? (
            <FinancePartnerSettlePanel
              orgSlug={orgSlug}
              partners={partnerRoster}
              payables={partnerFlow.payables}
              canWrite={ctx.canWrite}
              shareCharges={partnerShareChargeDetails}
            />
          ) : null}

          {insightBand}
        </PageShell>
      ) : null}

      {view === "receipts" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          <FinanceHero
            label="Paid to you"
            value={moneyLabel(finance.snapshot.collectedMinor, currency)}
            hint="Payments applied to charges"
            doNext={receiptsDoNext}
          />
          <FinanceSecondary
            items={[
              {
                label: "Payment not applied",
                value: moneyLabel(finance.snapshot.unallocatedMinor, currency),
                hint: "Leftover credit waiting to apply",
                tone: "slate",
                fill: moneyFill(
                  finance.snapshot.unallocatedMinor,
                  finance.snapshot.collectedMinor + finance.snapshot.unallocatedMinor,
                ),
              },
            ]}
          />
          <SoftCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border/20 px-5 py-3.5">
              <p className="font-heading text-lg font-semibold tracking-tight">Money in</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Payments and refunds · {postedPayments.length} rows
                {finance.snapshot.unallocatedMinor > BigInt(0)
                  ? ` · ${moneyLabel(finance.snapshot.unallocatedMinor, currency)} not applied`
                  : ""}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {postedPayments.length === 0 ? (
                <EmptyState
                  fill
                  title={JOURNEY.finance.emptyReceiptsTitle}
                  body={JOURNEY.finance.emptyReceiptsBody}
                  actionHref={`/${orgSlug}/finance`}
                  actionLabel={JOURNEY.finance.emptyReceiptsCta}
                />
              ) : (
                <PaymentSheet
                  orgSlug={orgSlug}
                  payments={finance.payments}
                  names={clientName}
                  canWrite={ctx.canWrite}
                  allocations={finance.allocations}
                  charges={finance.charges}
                />
              )}
            </div>
          </SoftCard>
        </PageShell>
      ) : null}

      {view === "upcoming" ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-stretch">
            <SoftCard className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Ready to bill · {upcomingMonthLabel}
                </p>
                <p className="mt-1 font-heading text-2xl leading-none font-semibold tracking-tight tabular-nums">
                  {moneyLabel(expectedNextMonthMinor, currency)}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Unbilled milestones due next month · {expectedBillings.length} rows
                </p>
              </div>
              <div className="hidden h-10 w-px bg-border/40 sm:block" />
              <div className="hidden min-w-38 sm:block">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Next 2 months
                </p>
                <p className="mt-1 font-heading text-lg leading-none font-semibold tabular-nums tracking-tight">
                  {moneyLabel(cycleTotalMinor, currency)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {monthLabel} + {upcomingMonthLabel}
                </p>
              </div>
              {expectedBillings.length > 0 ? (
                <Button
                  size="sm"
                  className="shrink-0"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/${orgSlug}/projects/${expectedBillings[0].projectId}?tab=milestones&bill=${expectedBillings[0].milestoneId}`}
                    />
                  }
                >
                  Bill next
                </Button>
              ) : null}
            </SoftCard>
          </div>

          <SoftCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-border/20 px-5 py-3">
              <div className="min-w-0">
                <p className="font-heading text-base font-semibold tracking-tight">To bill</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Bill posts a charge to Collect · then record payment
                </p>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {expectedBillings.length} milestones
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto">
              {expectedBillings.length === 0 ? (
                <EmptyState
                  fill
                  title={JOURNEY.finance.emptyUpcomingTitle}
                  body={JOURNEY.finance.emptyUpcomingBody}
                  actionHref={`/${orgSlug}/projects`}
                  actionLabel={JOURNEY.finance.emptyUpcomingCta}
                />
              ) : (
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border/20 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Due</th>
                      <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Client</th>
                      <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Project</th>
                      <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Milestone</th>
                      <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Expected</th>
                      <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expectedBillings.map((row) => (
                      <tr key={row.milestoneId} className="border-b border-border/15">
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                          {formatDay(row.dueOn)}
                          {inMonth(row.dueOn, upcomingMonth) ? (
                            <span className="ml-2 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                              next month
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                          <Link
                            href={`/${orgSlug}/clients/${row.clientId}`}
                            className="hover:underline"
                          >
                            {row.clientName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                          <Link
                            href={`/${orgSlug}/projects/${row.projectId}`}
                            className="hover:underline"
                          >
                            {row.projectName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                          {row.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-base font-semibold tabular-nums tracking-tight sm:px-5 sm:py-5">
                          {moneyLabel(row.amountMinor, row.currency)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right sm:px-5 sm:py-5">
                          <Button
                            size="sm"
                            variant="outline"
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
              )}
            </div>
          </SoftCard>
        </PageShell>
      ) : null}

      {view === "month" && statement ? (
        <PageShell className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-lg font-semibold tracking-tight">
                {monthLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Closing picture · started at{" "}
                {moneyLabel(statement.opening, statement.currency)}
              </p>
            </div>
            <FinanceMonthPicker orgSlug={orgSlug} value={month} />
          </div>

          <SoftCard>
            <div className="grid divide-y divide-border/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Still open at month end
                </p>
                <p className="mt-2 font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums">
                  {moneyLabel(statement.closing, statement.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ready to bill {moneyLabel(expectedThisMonthMinor, currency)}
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Charged
                </p>
                <p className="mt-2 font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums">
                  {moneyLabel(statement.newCharges, statement.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {monthCharges.length} posted this month
                </p>
              </div>
              <div className="px-5 py-5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Paid to you
                </p>
                <p className="mt-2 font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums">
                  {moneyLabel(statement.payments, statement.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {monthPayments.length} payments in
                </p>
              </div>
            </div>
          </SoftCard>

          {partnerFlow.month || partnerFlow.payables.length > 0 ? (
            <FinancePartnerSettlePanel
              orgSlug={orgSlug}
              partners={partnerRoster}
              payables={partnerFlow.payables}
              canWrite={ctx.canWrite}
              month={partnerFlow.month}
              shareCharges={partnerShareChargeDetails}
            />
          ) : null}

          {expectedThisMonth.length > 0 ? (
            <SoftCard className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 px-5 py-3.5">
                <div>
                  <p className="font-heading text-base font-semibold tracking-tight">
                    Ready to bill
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Unbilled milestones: Bill posts them to Collect
                  </p>
                </div>
                <p className="font-heading text-lg font-semibold tabular-nums tracking-tight">
                  {moneyLabel(expectedThisMonthMinor, currency)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/20 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="px-4 py-3 font-semibold">Due</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Milestone</th>
                      <th className="px-4 py-3 text-right font-semibold">Expected</th>
                      <th className="px-4 py-3 text-right font-semibold"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expectedThisMonth.map((row) => (
                      <tr key={row.milestoneId} className="border-b border-border/15">
                        <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                          {formatDay(row.dueOn)}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{row.clientName}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          <span>{row.name}</span>
                          <span className="ml-1 text-xs">· {row.projectName}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-base font-semibold tabular-nums">
                          {moneyLabel(row.amountMinor, row.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
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
            </SoftCard>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <SoftCard className="overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/20 px-5 py-3.5">
                <div>
                  <p className="font-heading text-base font-semibold tracking-tight">
                    Charges
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {monthCharges.length} posted
                  </p>
                </div>
                <p className="font-heading text-lg font-semibold tabular-nums tracking-tight">
                  {moneyLabel(statement.newCharges, currency)}
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
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/20 px-5 py-3.5">
                <div>
                  <p className="font-heading text-base font-semibold tracking-tight">
                    Money in
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {monthPayments.length} posted
                  </p>
                </div>
                <p className="font-heading text-lg font-semibold tabular-nums tracking-tight">
                  {moneyLabel(statement.payments, currency)}
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
