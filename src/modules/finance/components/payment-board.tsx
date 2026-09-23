import Link from "next/link";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { voidPaymentAction } from "@/modules/finance/actions";
import { LedgerMenu } from "@/modules/finance/components/ledger-menu";
import {
  moneyLabel,
  type AllocationRow,
  type ChargeView,
  type PaymentRow,
} from "@/modules/finance/ledger";
import {
  UNDO_RECEIPT_COPY,
  formatDay,
  paymentLabel,
  receiptAppliedLabels,
} from "@/modules/finance/presentation";

export function PaymentBoard({
  orgSlug,
  payments,
  names,
  canWrite,
  showClient = true,
  allocations = [],
  charges = [],
}: {
  orgSlug: string;
  payments: PaymentRow[];
  names: Map<string, string>;
  canWrite: boolean;
  showClient?: boolean;
  allocations?: AllocationRow[];
  charges?: Pick<ChargeView, "id" | "memo" | "source" | "currency">[];
}) {
  if (payments.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted-foreground">No money in yet.</p>;
  }

  return (
    <ul className="space-y-1 p-2">
      {payments.map((payment) => {
        const cancelled = payment.status === "void";
        const applied = receiptAppliedLabels(payment.id, allocations, charges);
        return (
          <li
            key={payment.id}
            className={
              cancelled
                ? "flex items-center gap-3 rounded-2xl px-3 py-3 opacity-60"
                : "flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/70"
            }
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={cancelled ? "cancelled" : "paid"}>
                  {cancelled ? "Cancelled" : payment.kind === "refund" ? "Refund" : "Received"}
                </StatusChip>
                {showClient ? (
                  <Link
                    href={`/${orgSlug}/clients/${payment.clientId}`}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {names.get(payment.clientId) ?? "Client"}
                  </Link>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDay(payment.paidOn)} · {paymentLabel(payment)}
                {payment.reference ? ` · ${payment.reference}` : ""}
              </p>
              {applied.length > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Applied to {applied.join(" · ")}
                </p>
              ) : null}
            </div>
            <p className="text-sm font-medium tabular-nums">
              {moneyLabel(payment.amountMinor, payment.currency)}
            </p>
            {canWrite && payment.status === "posted" ? (
              <LedgerMenu
                label={payment.kind === "refund" ? "Cancel refund" : "Undo receipt"}
                confirm={UNDO_RECEIPT_COPY}
                action={voidPaymentAction.bind(null, orgSlug, payment.id)}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Dense receipt ledger grid. */
export function PaymentSheet({
  orgSlug,
  payments,
  names,
  canWrite,
  allocations = [],
  charges = [],
}: {
  orgSlug: string;
  payments: PaymentRow[];
  names: Map<string, string>;
  canWrite: boolean;
  allocations?: AllocationRow[];
  charges?: Pick<ChargeView, "id" | "memo" | "source" | "currency">[];
}) {
  if (payments.length === 0) {
    return <p className="px-5 py-8 text-sm text-muted-foreground">No money in this sheet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/20 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Date</th>
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Client</th>
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Kind</th>
            <th className="whitespace-nowrap px-4 py-4 font-semibold sm:px-5">Applied to</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5">Amount</th>
            <th className="whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5"> </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const cancelled = payment.status === "void";
            const applied = receiptAppliedLabels(payment.id, allocations, charges);
            return (
              <tr
                key={payment.id}
                className={cn("border-b border-border/15", cancelled && "opacity-50")}
              >
                <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                  {formatDay(payment.paidOn)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                  <Link
                    href={`/${orgSlug}/clients/${payment.clientId}`}
                    className="hover:underline"
                  >
                    {names.get(payment.clientId) ?? "Client"}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-4 sm:px-5 sm:py-5">
                  <StatusChip tone={cancelled ? "cancelled" : "paid"}>
                    {cancelled
                      ? "Cancelled"
                      : payment.kind === "refund"
                        ? "Refund"
                        : paymentLabel(payment)}
                  </StatusChip>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-muted-foreground sm:px-5 sm:py-5">
                  {applied.length > 0 ? applied.join(" · ") : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-base font-semibold tabular-nums tracking-tight sm:px-5 sm:py-5">
                  {moneyLabel(payment.amountMinor, payment.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right sm:px-5 sm:py-5">
                  {canWrite && payment.status === "posted" ? (
                    <LedgerMenu
                      label={payment.kind === "refund" ? "Cancel refund" : "Undo receipt"}
                      confirm={UNDO_RECEIPT_COPY}
                      action={voidPaymentAction.bind(null, orgSlug, payment.id)}
                    />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
