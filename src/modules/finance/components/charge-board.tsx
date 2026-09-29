import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/studio/meter";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { voidChargeAction } from "@/modules/finance/actions";
import { LedgerMenu } from "@/modules/finance/components/ledger-menu";
import { ChargeCollectButton } from "@/modules/finance/components/charge-collect-button";
import {
  moneyLabel,
  type AllocationRow,
  type ChargeView,
  type PaymentRow,
} from "@/modules/finance/ledger";
import {
  CANCEL_CHARGE_COPY,
  canCancelCharge,
  chargeLife,
  chargeLifeLabel,
  formatDay,
  groupChargesByClient,
  paidRatio,
} from "@/modules/finance/presentation";

export function ChargeRows({
  orgSlug,
  charges,
  canWrite,
  showCancelled = false,
  activeChargeId,
  allocations = [],
  payments = [],
}: {
  orgSlug: string;
  charges: ChargeView[];
  canWrite: boolean;
  showCancelled?: boolean;
  activeChargeId?: string;
  allocations?: AllocationRow[];
  payments?: PaymentRow[];
}) {
  const visible = showCancelled
    ? charges
    : charges.filter((charge) => charge.status !== "void");
  if (visible.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted-foreground">No open charges.</p>;
  }
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const datesByCharge = new Map<string, Set<string>>();
  for (const allocation of allocations) {
    const payment = paymentById.get(allocation.paymentId);
    if (!payment || payment.status !== "posted" || payment.kind !== "receipt") continue;
    const dates = datesByCharge.get(allocation.chargeId) ?? new Set<string>();
    dates.add(payment.paidOn);
    datesByCharge.set(allocation.chargeId, dates);
  }

  return (
    <ul className="space-y-1 p-2">
      {visible.map((charge) => {
        const life = chargeLife(charge);
        const stillDue = charge.outstandingMinor > BigInt(0);
        const paymentDates = [...(datesByCharge.get(charge.id) ?? [])].sort();
        return (
          <li
            key={charge.id}
            className={cn(
              "rounded-2xl px-3 py-3",
              life === "cancelled" ? "opacity-60" : "hover:bg-muted/70",
              charge.id === activeChargeId && "bg-muted",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={life}>{chargeLifeLabel(life)}</StatusChip>
                  <span className="truncate text-sm font-medium">
                    {charge.memo || "Untitled charge"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Charged {formatDay(charge.chargedOn)}
                  {charge.dueOn ? ` · due ${formatDay(charge.dueOn)}` : ""}
                  {charge.source !== "manual" ? ` · ${charge.source.replaceAll("_", " ")}` : ""}
                  {paymentDates.length > 0
                    ? ` · paid ${paymentDates.map(formatDay).join(", ")}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-sm font-semibold tabular-nums">
                  {life === "cancelled"
                    ? "Cancelled"
                    : stillDue
                      ? moneyLabel(charge.outstandingMinor, charge.currency)
                      : "Paid"}
                </span>
                {canWrite && stillDue ? (
                  <ChargeCollectButton
                    orgSlug={orgSlug}
                    clientId={charge.clientId}
                    chargeId={charge.id}
                    amountMinor={charge.outstandingMinor}
                    currency={charge.currency}
                    memo={charge.memo || "Untitled charge"}
                    chargedOn={charge.chargedOn}
                    grossMinor={charge.grossMinor}
                    netMinor={charge.netMinor}
                    collectedMinor={charge.allocatedMinor}
                  />
                ) : null}
                {canWrite && canCancelCharge(charge) ? (
                  <LedgerMenu
                    label="Cancel charge"
                    confirm={CANCEL_CHARGE_COPY}
                    action={voidChargeAction.bind(null, orgSlug, charge.id)}
                  />
                ) : null}
              </div>
            </div>
            <div className="mt-2">
              <Meter
                value={paidRatio(charge)}
                tone={life === "overdue" ? "overdue" : life === "paid" ? "paid" : "default"}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
              {[
                ["Total price", charge.grossMinor],
                ["Fee deducted", charge.grossMinor - charge.netMinor],
                ["Distributable", charge.netMinor],
                ["Collected", charge.allocatedMinor],
                ["Remaining", charge.outstandingMinor],
              ].map(([label, amount]) => (
                <div key={String(label)} className="min-w-0">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
                  <p className="mt-0.5 truncate text-xs font-medium tabular-nums">
                    {moneyLabel(amount as bigint, charge.currency)}
                  </p>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Dense ledger-style charge grid (spreadsheet-like scan). */
export function ChargeSheet({
  orgSlug,
  charges,
  canWrite,
  showCancelled = false,
  collectHref,
  activeChargeId,
  clientName,
  showRecorded = false,
}: {
  orgSlug: string;
  charges: ChargeView[];
  canWrite: boolean;
  showCancelled?: boolean;
  collectHref?: (chargeId: string) => string;
  activeChargeId?: string;
  clientName?: (clientId: string) => string;
  showRecorded?: boolean;
}) {
  const visible = showCancelled
    ? charges
    : charges.filter((charge) => charge.status !== "void");

  if (visible.length === 0) {
    return <p className="px-5 py-8 text-sm text-muted-foreground">No charges in this sheet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[58rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/20 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {clientName ? <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Client</th> : null}
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Charge</th>
            {showRecorded ? <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Recorded</th> : null}
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Charged</th>
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Due</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Gross</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Fee deducted</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Distributable</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Paid</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Left</th>
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Status</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5"> </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((charge) => {
            const life = chargeLife(charge);
            const stillDue = charge.outstandingMinor > BigInt(0);
            return (
              <tr
                key={charge.id}
                className={cn(
                  "border-b border-border/15",
                  life === "cancelled" && "opacity-50",
                  charge.id === activeChargeId && "bg-muted/70",
                  life === "overdue" &&
                    charge.id !== activeChargeId &&
                    "bg-amber-50/40 dark:bg-amber-950/20",
                )}
              >
                {clientName ? (
                  <td className="whitespace-nowrap px-4 py-4 sm:px-5 sm:py-5">
                    <Link
                      href={`/${orgSlug}/clients/${charge.clientId}`}
                      className="font-medium hover:underline"
                    >
                      {clientName(charge.clientId)}
                    </Link>
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-4 py-4 font-medium sm:px-5 sm:py-5">
                  {charge.memo || "Untitled charge"}
                </td>
                {showRecorded ? (
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                    {formatDay(charge.createdAt.slice(0, 10))}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                  {formatDay(charge.chargedOn)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                  {charge.dueOn ? formatDay(charge.dueOn) : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-muted-foreground sm:px-5 sm:py-5">
                  {moneyLabel(charge.grossMinor, charge.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-muted-foreground sm:px-5 sm:py-5">
                  {moneyLabel(charge.grossMinor - charge.netMinor, charge.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums sm:px-5 sm:py-5">
                  {moneyLabel(charge.netMinor, charge.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-muted-foreground sm:px-5 sm:py-5">
                  {moneyLabel(charge.allocatedMinor, charge.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-base font-semibold tabular-nums tracking-tight sm:px-5 sm:py-5">
                  {life === "cancelled"
                    ? "-"
                    : stillDue
                      ? moneyLabel(charge.outstandingMinor, charge.currency)
                      : moneyLabel(BigInt(0), charge.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 sm:px-5 sm:py-5">
                  <StatusChip tone={life}>{chargeLifeLabel(life)}</StatusChip>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right sm:px-5 sm:py-5">
                  <div className="inline-flex items-center justify-end gap-0.5">
                    {canWrite && stillDue && collectHref ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={collectHref(charge.id)} />}
                      >
                        Collect
                      </Button>
                    ) : null}
                    {canWrite && canCancelCharge(charge) ? (
                      <LedgerMenu
                        label="Cancel charge"
                        confirm={CANCEL_CHARGE_COPY}
                        action={voidChargeAction.bind(null, orgSlug, charge.id)}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChargeBoard({
  orgSlug,
  charges,
  names,
  canWrite,
  groupByClient = true,
  showCancelled = false,
}: {
  orgSlug: string;
  charges: ChargeView[];
  names: Map<string, string>;
  clientOptions?: { id: string; name: string; currency: string }[];
  canWrite: boolean;
  groupByClient?: boolean;
  showCancelled?: boolean;
}) {
  const visible = showCancelled
    ? charges
    : charges.filter((charge) => charge.status !== "void");

  if (visible.length === 0) {
    return <p className="px-1 py-8 text-sm text-muted-foreground">No charges yet.</p>;
  }

  if (!groupByClient) {
    return (
      <ChargeRows
        orgSlug={orgSlug}
        charges={visible}
        canWrite={canWrite}
        showCancelled={showCancelled}
      />
    );
  }

  const groups = groupChargesByClient(visible, names);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.clientId}>
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <Link
              href={`/${orgSlug}/clients/${group.clientId}`}
              className="text-sm font-medium hover:text-lane-blue"
            >
              {group.name}
            </Link>
            <p className="text-sm tabular-nums text-muted-foreground">
              {group.outstandingMinor > BigInt(0)
                ? moneyLabel(group.outstandingMinor, group.currency)
                : "Settled"}
            </p>
          </div>
          <ChargeRows
            orgSlug={orgSlug}
            charges={group.charges}
            canWrite={canWrite}
            showCancelled={showCancelled}
          />
        </section>
      ))}
    </div>
  );
}
