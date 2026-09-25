import {
  AvatarMark,
  FilterChip,
  FilterChips,
  SoftCard,
  StudioToolbar,
  WorkSurface,
} from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import {
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { Button } from "@/components/ui/button";
import { listProjectBoard } from "@/modules/delivery/queries";
import { moneyLabel } from "@/modules/finance/ledger";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
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
  requireModuleAccess(ctx, "partners");
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

  const needBoard = view === "balances";
  const [partners, balances, register, settlements, board, partnersByProjectId, pendingInvites] =
    await Promise.all([
      listPartners(orgSlug),
      loadPartnerBalances(orgSlug),
      view === "month"
        ? loadMonthlyPartnerRegister(orgSlug, month)
        : Promise.resolve([] as Awaited<ReturnType<typeof loadMonthlyPartnerRegister>>),
      view === "history"
        ? listPartnerSettlements(orgSlug)
        : Promise.resolve([] as Awaited<ReturnType<typeof listPartnerSettlements>>),
      needBoard
        ? listProjectBoard(orgSlug)
        : Promise.resolve([] as Awaited<ReturnType<typeof listProjectBoard>>),
      needBoard
        ? listProjectPartnersByProject(orgSlug).catch(
            () => ({}) as Record<string, PartnerRecord[]>,
          )
        : Promise.resolve({} as Record<string, PartnerRecord[]>),
      canInvite && view === "balances"
        ? listPendingInvitations(orgSlug).catch(() => [])
        : Promise.resolve([] as Awaited<ReturnType<typeof listPendingInvitations>>),
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
        triggerLabel="Settle"
        triggerVariant="default"
        triggerSize="sm"
      />
    );

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.partners.purpose}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {partners.length > 0 ? (
              <CreatePartnerDialog
                orgSlug={orgSlug}
                triggerVariant="outline"
                triggerSize="sm"
              />
            ) : null}
            {projects.length > 0 && partners.length > 0 ? (
              <ProjectSplitDialog
                orgSlug={orgSlug}
                projects={projects}
                partnersByProjectId={partnersByProjectId}
                currency={currency}
                triggerVariant="outline"
                triggerSize="sm"
              />
            ) : null}
            {primaryAction}
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
              canDelete={ctx.role === "owner" || ctx.role === "admin"}
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
                className="h-9 rounded-xl bg-muted px-3.5 text-sm outline-none ring-1 ring-border/40"
              />
              <Button type="submit" size="sm" variant="outline">
                Show
              </Button>
            </form>
            {register.length === 0 ? (
              <EmptyState
                fill
                title={JOURNEY.partners.emptyRegisterTitle}
                body={JOURNEY.partners.emptyRegisterBody}
              />
            ) : (
              <SoftCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b border-border/20 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                        <th className="px-5 py-3.5 font-semibold">Partner</th>
                        <th className="px-5 py-3.5 text-right font-semibold">Earned</th>
                        <th className="px-5 py-3.5 text-right font-semibold">Settled</th>
                        <th className="px-5 py-3.5 text-right font-semibold">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {register.map((row) => (
                        <tr
                          key={`${row.partnerId}-${row.currency}`}
                          className="border-b border-border/15"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <AvatarMark name={row.partnerName} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {row.partnerName}
                                </p>
                                <p className="text-xs text-muted-foreground">{row.currency}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums">
                            {moneyLabel(row.earnedMinor, row.currency)}
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">
                            {moneyLabel(row.settledMinor, row.currency)}
                          </td>
                          <td className="px-5 py-4 text-right font-medium tabular-nums">
                            {moneyLabel(row.pendingMinor, row.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SoftCard>
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
            <SoftCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border/20 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      <th className="px-5 py-3.5 font-semibold">Payout</th>
                      <th className="w-36 px-5 py-3.5 font-semibold">Date</th>
                      <th className="w-36 px-5 py-3.5 font-semibold">Method</th>
                      <th className="w-40 px-5 py-3.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((row) => {
                      const partner = partners.find((item) => item.id === row.partnerId);
                      return (
                        <tr key={row.id} className="border-b border-border/15">
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium">
                              {partner?.name ?? "Partner"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.memo || (row.status === "void" ? "Void" : "Settlement")}
                            </p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                            {row.settledOn}
                          </td>
                          <td className="px-5 py-4 capitalize text-muted-foreground">
                            {row.method}
                          </td>
                          <td className="px-5 py-4 text-right font-medium tabular-nums">
                            {moneyLabel(row.amountMinor, row.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SoftCard>
          )
        ) : null}
      </IndexBody>
    </WorkSurface>
  );
}
