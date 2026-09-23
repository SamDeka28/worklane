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

function MoneyMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums tracking-tight text-foreground/85">
        {value}
      </span>
    </span>
  );
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
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/20 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold tracking-tight">
              Partner shares
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {month
                ? "Earned this month. Settle what you still owe."
                : "Client money is collected. Settle partner shares from here."}
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
          <div className="grid grid-cols-3 divide-x divide-border/20 border-b border-border/20">
            <div className="px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-[11px]">
                Earned
              </p>
              <p className="mt-1.5 font-heading text-sm leading-none font-semibold tabular-nums tracking-tight sm:mt-2 sm:text-xl">
                {moneyLabel(month.earnedMinor, month.currency)}
              </p>
            </div>
            <div className="px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-[11px]">
                Settled
              </p>
              <p className="mt-1.5 font-heading text-sm leading-none font-semibold tabular-nums tracking-tight sm:mt-2 sm:text-xl">
                {moneyLabel(month.settledMinor, month.currency)}
              </p>
            </div>
            <div className="px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-[11px]">
                To pay
              </p>
              <p className="mt-1.5 font-heading text-sm leading-none font-semibold tabular-nums tracking-tight sm:mt-2 sm:text-xl">
                {moneyLabel(month.payableMinor, month.currency)}
              </p>
            </div>
          </div>
        ) : null}

        {payables.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            No partner balances waiting to settle.
          </p>
        ) : (
          <ul className="divide-y divide-border/15">
            {payables.map((row) => (
              <li
                key={row.partnerId}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-4 sm:px-5 sm:py-5"
              >
                <AvatarMark name={row.partnerName} size="sm" />
                <div className="min-w-0 space-y-2">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {row.partnerName}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    <MoneyMeta
                      label="Earned"
                      value={moneyLabel(row.earnedMinor, row.currency)}
                    />
                    <MoneyMeta
                      label="Settled"
                      value={moneyLabel(row.settledMinor, row.currency)}
                    />
                  </div>
                  {canWrite ? (
                    <div className="pt-0.5 sm:hidden">
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
                    </div>
                  ) : null}
                </div>
                <p className="pt-0.5 text-base font-semibold tabular-nums tracking-tight">
                  {moneyLabel(row.payableMinor, row.currency)}
                </p>
                {canWrite ? (
                  <div className="hidden pt-0.5 sm:block">
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
                  </div>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            ))}
          </ul>
        )}
      </SoftCard>
    </div>
  );
}
