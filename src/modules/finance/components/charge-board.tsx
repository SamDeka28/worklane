import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/studio/meter";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { voidChargeAction } from "@/modules/finance/actions";
import { LedgerMenu } from "@/modules/finance/components/ledger-menu";
import { moneyLabel, type ChargeView } from "@/modules/finance/ledger";
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
  collectHref,
  activeChargeId,
}: {
  orgSlug: string;
  charges: ChargeView[];
  canWrite: boolean;
  showCancelled?: boolean;
  collectHref?: (chargeId: string) => string;
  activeChargeId?: string;
}) {
  const visible = showCancelled
    ? charges
    : charges.filter((charge) => charge.status !== "void");
  if (visible.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted-foreground">No open charges.</p>;
  }

  return (
    <ul className="space-y-1 p-2">
      {visible.map((charge) => {
        const life = chargeLife(charge);
        const stillDue = charge.outstandingMinor > BigInt(0);
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
                  {formatDay(charge.chargedOn)}
                  {charge.dueOn ? ` · due ${formatDay(charge.dueOn)}` : ""}
                  {charge.source !== "manual" ? ` · ${charge.source.replaceAll("_", " ")}` : ""}
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
                {canWrite && stillDue && collectHref ? (
                  <Button
                    size="sm"
                    variant="ghost"
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
            </div>
            <div className="mt-2">
              <Meter
                value={paidRatio(charge)}
                tone={life === "overdue" ? "overdue" : life === "paid" ? "paid" : "default"}
              />
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
}: {
  orgSlug: string;
  charges: ChargeView[];
  canWrite: boolean;
  showCancelled?: boolean;
  collectHref?: (chargeId: string) => string;
  activeChargeId?: string;
  clientName?: (clientId: string) => string;
}) {
  const visible = showCancelled
    ? charges
    : charges.filter((charge) => charge.status !== "void");

  if (visible.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted-foreground">No charges in this sheet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/40 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {clientName ? <th className="px-3 py-2.5 font-semibold">Client</th> : null}
            <th className="px-3 py-2.5 font-semibold">Charge</th>
            <th className="px-3 py-2.5 font-semibold">Charged</th>
            <th className="px-3 py-2.5 font-semibold">Due</th>
            <th className="px-3 py-2.5 text-right font-semibold">Gross</th>
            <th className="px-3 py-2.5 text-right font-semibold">Paid</th>
            <th className="px-3 py-2.5 text-right font-semibold">Left</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 text-right font-semibold"> </th>
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
                  "border-b border-border/25",
                  life === "cancelled" && "opacity-50",
                  charge.id === activeChargeId && "bg-sky-50/70",
                  life === "overdue" && charge.id !== activeChargeId && "bg-amber-50/40",
                )}
              >
                {clientName ? (
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/${orgSlug}/clients/${charge.clientId}`}
                      className="font-medium hover:underline"
                    >
                      {clientName(charge.clientId)}
                    </Link>
                  </td>
                ) : null}
                <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
                  {charge.memo || "Untitled charge"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {formatDay(charge.chargedOn)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {charge.dueOn ? formatDay(charge.dueOn) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {moneyLabel(charge.grossMinor, charge.currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {moneyLabel(charge.allocatedMinor, charge.currency)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {life === "cancelled"
                    ? "—"
                    : stillDue
                      ? moneyLabel(charge.outstandingMinor, charge.currency)
                      : moneyLabel(BigInt(0), charge.currency)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusChip tone={life}>{chargeLifeLabel(life)}</StatusChip>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex items-center justify-end gap-0.5">
                    {canWrite && stillDue && collectHref ? (
                      <Button
                        size="sm"
                        variant="ghost"
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
