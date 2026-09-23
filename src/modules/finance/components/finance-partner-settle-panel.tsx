import Link from "next/link";
import { AvatarMark, SoftCard } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import {
  PartnerSharesDetailDialog,
  type PartnerSharesChargeDetail,
  type PartnerSharesMonthDetail,
  type PartnerSharesPartnerDetail,
} from "@/modules/finance/components/finance-partner-shares-dialog";
import { moneyLabel } from "@/modules/finance/ledger";
import { RecordSettlementDialog } from "@/modules/partners/components/partner-forms";
import type {
  FinancePartnerMonthStrip,
  FinancePartnerPayable,
} from "@/modules/partners/queries";
import type { PartnerRecord } from "@/modules/partners/types";
import { formatMoney } from "@/shared/money";

function settleAmount(amountMinor: bigint, currency: FinancePartnerPayable["currency"]) {
  return formatMoney({ amountMinor, currency }).replace(/[^\d.]/g, "");
}

export function FinancePartnerSettlePanel({
  orgSlug,
  partners,
  payables,
  canWrite,
  month,
  shareCharges = [],
}: {
  orgSlug: string;
  partners: PartnerRecord[];
  payables: FinancePartnerPayable[];
  canWrite: boolean;
  month?: FinancePartnerMonthStrip | null;
  /** Preformatted charge split rows for the details dialog. */
  shareCharges?: PartnerSharesChargeDetail[];
}) {
  if (!month && payables.length === 0 && shareCharges.length === 0) return null;

  const monthDetail: PartnerSharesMonthDetail | null = month
    ? {
        earnedLabel: moneyLabel(month.earnedMinor, month.currency),
        settledLabel: moneyLabel(month.settledMinor, month.currency),
        payableLabel: moneyLabel(month.payableMinor, month.currency),
        earnedValue: Number(month.earnedMinor),
        settledValue: Number(month.settledMinor),
        payableValue: Number(month.payableMinor),
      }
    : null;

  const partnerDetails: PartnerSharesPartnerDetail[] = payables.map((row) => ({
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    earnedLabel: moneyLabel(row.earnedMinor, row.currency),
    settledLabel: moneyLabel(row.settledMinor, row.currency),
    payableLabel: moneyLabel(row.payableMinor, row.currency),
    earnedValue: Number(row.earnedMinor),
    settledValue: Number(row.settledMinor),
    payableValue: Number(row.payableMinor),
  }));

  const showDetailsCta =
    Boolean(monthDetail) || partnerDetails.length > 0 || shareCharges.length > 0;

  return (
    <div id="partner-settle" className="scroll-mt-4">
      <SoftCard>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 px-5 py-4">
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold tracking-tight">
              Partner shares
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {month
                ? "Earned this month · settle what you still owe"
                : "Client money is collected — settle partner shares from here"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showDetailsCta ? (
              <PartnerSharesDetailDialog
                month={monthDetail}
                partners={partnerDetails}
                charges={shareCharges}
              />
            ) : null}
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${orgSlug}/partners`} />}
            >
              Open Partners
            </Button>
          </div>
        </div>

        {month ? (
          <div className="grid divide-y divide-border/20 border-b border-border/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Partners earned
              </p>
              <p className="mt-2 font-heading text-xl leading-none font-semibold tabular-nums tracking-tight">
                {moneyLabel(month.earnedMinor, month.currency)}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Settled
              </p>
              <p className="mt-2 font-heading text-xl leading-none font-semibold tabular-nums tracking-tight">
                {moneyLabel(month.settledMinor, month.currency)}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Still to pay
              </p>
              <p className="mt-2 font-heading text-xl leading-none font-semibold tabular-nums tracking-tight">
                {moneyLabel(month.payableMinor, month.currency)}
              </p>
            </div>
          </div>
        ) : null}

        {payables.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No partner balances waiting to settle.
          </p>
        ) : (
          <ul className="divide-y divide-border/15">
            {payables.map((row) => (
              <li
                key={row.partnerId}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4"
              >
                <AvatarMark name={row.partnerName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.partnerName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Earned {moneyLabel(row.earnedMinor, row.currency)} · settled{" "}
                    {moneyLabel(row.settledMinor, row.currency)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {moneyLabel(row.payableMinor, row.currency)}
                </p>
                {canWrite ? (
                  <RecordSettlementDialog
                    orgSlug={orgSlug}
                    partners={partners}
                    defaultCurrency={row.currency}
                    defaultPartnerId={row.partnerId}
                    defaultAmount={settleAmount(row.payableMinor, row.currency)}
                    triggerLabel="Settle"
                    triggerVariant="default"
                    triggerSize="sm"
                    triggerIcon={null}
                    triggerIconOnly={false}
                    triggerAriaLabel={`Settle ${row.partnerName}`}
                  />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
      </SoftCard>
    </div>
  );
}
