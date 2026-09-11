import {
  AvatarMark,
  FilterChip,
  FilterChips,
  StudioToolbar,
  WorkSurface,
} from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { listProjectBoard } from "@/modules/delivery/queries";
import { moneyLabel } from "@/modules/finance/ledger";
import { requireOrg } from "@/modules/identity/org";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney } from "@/shared/money";
import {
  CreatePartnerDialog,
  ProjectSplitDialog,
  RecordSettlementDialog,
} from "@/modules/partners/components/partner-forms";
import { PartnersBalancesWorkbench } from "@/modules/partners/components/partners-balances-workbench";
import type { PartnerRecord } from "@/modules/partners/types";
import {
  listPartners,
  listPartnerSettlements,
  listProjectPartnersByProject,
  loadMonthlyPartnerRegister,
  loadPartnerBalances,
} from "@/modules/partners/queries";
import { listPendingInvitations } from "@/modules/team/actions";

export default async function PartnersPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/partners">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const canInvite = ctx.role === "owner" || ctx.role === "admin";
  const view =
    query.view === "month" || query.view === "history" || query.view === "register"
      ? query.view === "register"
        ? "month"
        : query.view
      : "balances";
  const month =
    typeof query.month === "string" && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : new Date().toISOString().slice(0, 7);
  const selectedId = typeof query.partner === "string" ? query.partner : undefined;

  const [partners, balances, register, settlements, board, partnersByProjectId, pendingInvites] =
    await Promise.all([
      listPartners(orgSlug),
      loadPartnerBalances(orgSlug),
      view === "month"
        ? loadMonthlyPartnerRegister(orgSlug, month)
        : Promise.resolve([]),
      view === "history"
        ? listPartnerSettlements(orgSlug)
        : Promise.resolve([]),
      listProjectBoard(orgSlug),
      listProjectPartnersByProject(orgSlug).catch(
        () => ({}) as Record<string, PartnerRecord[]>,
      ),
      canInvite ? listPendingInvitations(orgSlug).catch(() => []) : Promise.resolve([]),
    ]);
  const pendingPartnerInvites = pendingInvites.filter(
    (invite) => invite.role === "partner" || invite.partnerId,
  );

  const projects = board.map((row) => ({
    id: row.project.id,
    name: row.project.name,
    totalMinor: (row.project.contractedAmountMinor ?? BigInt(0)).toString(),
    feeBps: row.project.defaultFeeBps,
  }));
  const projectsByPartnerId: Record<string, { id: string; name: string }[]> = {};
  for (const row of board) {
    for (const partner of partnersByProjectId[row.project.id] ?? []) {
      const list = projectsByPartnerId[partner.id] ?? [];
      list.push({ id: row.project.id, name: row.project.name });
      projectsByPartnerId[partner.id] = list;
    }
  }

  const base = `/${orgSlug}/partners`;
  const currency = ctx.org.defaultCurrency;
  const totalPayable = balances.reduce((sum, row) => sum + row.payableMinor, BigInt(0));
  const totalEarned = balances.reduce((sum, row) => sum + row.earnedMinor, BigInt(0));
  const totalSettled = balances.reduce((sum, row) => sum + row.settledMinor, BigInt(0));
  const owingPartners = balances.filter((row) => row.payableMinor > BigInt(0));
  const settlePartner =
    balances.find((row) => row.partnerId === selectedId) ?? owingPartners[0] ?? balances[0];

  const balanceRows = balances.map((row) => ({
    partnerId: row.partnerId,
    name: row.name,
    kind: row.kind,
    currency: row.currency,
    earnedMinor: row.earnedMinor.toString(),
    settledMinor: row.settledMinor.toString(),
    payableMinor: row.payableMinor.toString(),
  }));

  const primaryAction =
    partners.length === 0 ? (
      <CreatePartnerDialog orgSlug={orgSlug} />
    ) : (
      <RecordSettlementDialog
        orgSlug={orgSlug}
        partners={partners}
        defaultCurrency={currency}
        defaultPartnerId={settlePartner?.partnerId}
        defaultAmount={
          settlePartner && settlePartner.payableMinor > BigInt(0)
            ? formatMoney({
                amountMinor: settlePartner.payableMinor,
                currency: settlePartner.currency,
              }).replace(/[^\d.]/g, "")
            : undefined
        }
        defaultOpen={query.settle === "1"}
      />
    );

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.partners.purpose}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {primaryAction}
            {partners.length > 0 ? (
              <CreatePartnerDialog orgSlug={orgSlug} triggerVariant="outline" />
            ) : null}
            {projects.length > 0 && partners.length > 0 ? (
              <ProjectSplitDialog
                orgSlug={orgSlug}
                projects={projects}
                partnersByProjectId={partnersByProjectId}
                currency={currency}
              />
            ) : null}
          </div>
        }
      />

      <FilterChips className="border-b border-border/40">
        <FilterChip href={`${base}?view=balances`} active={view === "balances"}>
          Balances
        </FilterChip>
        <FilterChip href={`${base}?view=month&month=${month}`} active={view === "month"}>
          This month
        </FilterChip>
        <FilterChip href={`${base}?view=history`} active={view === "history"}>
          Settlements
        </FilterChip>
      </FilterChips>

      <IndexBody>
        <SummaryStrip>
          <SummaryStat
            label="Payable"
            value={moneyLabel(totalPayable, currency)}
            hint={
              owingPartners.length
                ? `${owingPartners.length} partner${owingPartners.length === 1 ? "" : "s"} owed`
                : "Caught up"
            }
            tone={totalPayable > BigInt(0) ? "amber" : "emerald"}
          />
          <SummaryStat
            label="Earned"
            value={moneyLabel(totalEarned, currency)}
            hint="From project splits"
            tone="sky"
          />
          <SummaryStat
            label="Settled"
            value={moneyLabel(totalSettled, currency)}
            hint="Paid out"
            tone="emerald"
          />
          <SummaryStat
            label="Partners"
            value={String(partners.length)}
            hint={
              pendingPartnerInvites.length
                ? `${pendingPartnerInvites.length} invite${pendingPartnerInvites.length === 1 ? "" : "s"} pending`
                : "On the roster"
            }
            tone="slate"
          />
        </SummaryStrip>

        {view === "balances" ? (
          partners.length === 0 ? (
            <EmptyState
              fill
              title={JOURNEY.partners.emptyTitle}
              body={JOURNEY.partners.emptyBody}
            />
          ) : (
            <PartnersBalancesWorkbench
              orgSlug={orgSlug}
              balances={balanceRows}
              partners={partners}
              pendingInvites={pendingPartnerInvites}
              projectsByPartnerId={projectsByPartnerId}
              canWrite={ctx.canWrite}
              canInvite={canInvite}
              initialPartnerId={selectedId}
            />
          )
        ) : null}

        {view === "month" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <form className="flex shrink-0 flex-wrap items-center gap-2">
              <input type="hidden" name="view" value="month" />
              <input
                type="month"
                name="month"
                defaultValue={month}
                className="h-9 rounded-full bg-muted px-3.5 text-sm outline-none ring-1 ring-border/40"
              />
              <button
                type="submit"
                className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background"
              >
                Show
              </button>
            </form>
            {register.length === 0 ? (
              <EmptyState
                fill
                title={JOURNEY.partners.emptyRegisterTitle}
                body={JOURNEY.partners.emptyRegisterBody}
              />
            ) : (
              <DenseListPanel
                columns={
                  <>
                    <span>Partner</span>
                    <span className="text-right">Earned</span>
                    <span className="text-right">Settled</span>
                    <span className="text-right">Pending</span>
                    <span className="hidden sm:block" />
                  </>
                }
              >
                {register.map((row) => (
                  <DenseRow key={`${row.partnerId}-${row.currency}`}>
                    <DenseCell>
                      <div className="flex items-center gap-3">
                        <AvatarMark name={row.partnerName} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{row.partnerName}</p>
                          <p className="text-xs text-muted-foreground">{row.currency}</p>
                        </div>
                      </div>
                    </DenseCell>
                    <DenseCell align="right" className="text-sm">
                      {moneyLabel(row.earnedMinor, row.currency)}
                    </DenseCell>
                    <DenseCell align="right" className="text-sm text-muted-foreground">
                      {moneyLabel(row.settledMinor, row.currency)}
                    </DenseCell>
                    <DenseCell align="right" className="text-sm font-medium">
                      {moneyLabel(row.pendingMinor, row.currency)}
                    </DenseCell>
                    <DenseCell className="hidden sm:block" />
                  </DenseRow>
                ))}
              </DenseListPanel>
            )}
          </div>
        ) : null}

        {view === "history" ? (
          settlements.length === 0 ? (
            <EmptyState
              fill
              title="No settlements yet"
              body="When you pay a partner, the payout lands here."
              actionHref={ctx.canWrite ? `${base}?view=balances&settle=1` : undefined}
              actionLabel={ctx.canWrite ? "Settle" : undefined}
            />
          ) : (
            <DenseListPanel
              columns={
                <>
                  <span>Payout</span>
                  <span className="text-right">Date</span>
                  <span className="text-right">Method</span>
                  <span className="text-right">Amount</span>
                  <span className="hidden sm:block" />
                </>
              }
            >
              {settlements.map((row) => {
                const partner = partners.find((item) => item.id === row.partnerId);
                return (
                  <DenseRow key={row.id}>
                    <DenseCell>
                      <p className="text-sm font-medium">{partner?.name ?? "Partner"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.memo || (row.status === "void" ? "Void" : "Settlement")}
                      </p>
                    </DenseCell>
                    <DenseCell align="right" className="text-sm text-muted-foreground">
                      {row.settledOn}
                    </DenseCell>
                    <DenseCell align="right" className="text-sm capitalize text-muted-foreground">
                      {row.method}
                    </DenseCell>
                    <DenseCell align="right" className="text-sm font-medium">
                      {moneyLabel(row.amountMinor, row.currency)}
                    </DenseCell>
                    <DenseCell className="hidden sm:block" />
                  </DenseRow>
                );
              })}
            </DenseListPanel>
          )
        ) : null}
      </IndexBody>
    </WorkSurface>
  );
}
