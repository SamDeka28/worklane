"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/studio/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { recordPaymentAction } from "@/modules/finance/actions";
import { moneyLabel } from "@/modules/finance/ledger";
import { formatDay } from "@/modules/finance/presentation";
import { formatMajorInput, type IsoCurrency } from "@/shared/money";

export function ChargeCollectButton({
  orgSlug,
  clientId,
  chargeId,
  amountMinor,
  currency,
  memo,
  chargedOn,
  grossMinor,
  netMinor,
  collectedMinor,
}: {
  orgSlug: string;
  clientId: string;
  chargeId: string;
  amountMinor: bigint;
  currency: IsoCurrency;
  memo: string;
  chargedOn: string;
  grossMinor: bigint;
  netMinor: bigint;
  collectedMinor: bigint;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <ActionSheet
      title="Record payment"
      description="Apply a client payment to this charge."
      triggerLabel="Collect"
      triggerVariant="outline"
      triggerSize="sm"
      open={open}
      onOpenChange={setOpen}
      >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await recordPaymentAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Payment recorded");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="charge_id" value={chargeId} />
        <input type="hidden" name="kind" value="receipt" />
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-muted/40 ring-1 ring-primary/20">
          <div className="border-b border-border/40 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Collecting for</p>
            <p className="mt-1 truncate text-sm font-semibold tracking-tight">{memo}</p>
            <p className="mt-1 text-xs text-muted-foreground">Milestone charge · billed {formatDay(chargedOn)}</p>
          </div>
          <div className="px-4 py-3.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Remaining to collect</p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                  {moneyLabel(amountMinor, currency)}
                </p>
              </div>
              <p className="pb-1 text-xs text-muted-foreground tabular-nums">
                {moneyLabel(collectedMinor, currency)} collected
              </p>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Charge collection progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={grossMinor > BigInt(0)
                ? Math.min(100, Number((collectedMinor * BigInt(100)) / grossMinor))
                : 0}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{
                  width: `${grossMinor > BigInt(0)
                    ? Math.min(100, Number((collectedMinor * BigInt(100)) / grossMinor))
                    : 0}%`,
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {[
                ["Total price", grossMinor],
                ["Platform fee", grossMinor - netMinor],
                ["After fee", netMinor],
                ["Collected", collectedMinor],
            ].map(([label, amount]) => (
              <div key={String(label)}>
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
                <p className="mt-0.5 text-xs font-medium tabular-nums">
                  {moneyLabel(amount as bigint, currency)}
                </p>
              </div>
            ))}
            </div>
          </div>
        </section>
        <Field label="Amount" htmlFor={`collect_amount_${chargeId}`}>
          <Input
            id={`collect_amount_${chargeId}`}
            name="amount"
            required
            inputMode="decimal"
            defaultValue={formatMajorInput(amountMinor, currency)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method" htmlFor={`collect_method_${chargeId}`}>
            <NativeSelect id={`collect_method_${chargeId}`} name="method" defaultValue="upwork">
              <option value="upwork">Upwork</option>
              <option value="bank">Bank</option>
              <option value="stripe">Stripe</option>
              <option value="other">Other</option>
            </NativeSelect>
          </Field>
          <Field label="Paid on" htmlFor={`collect_paid_on_${chargeId}`}>
            <Input
              id={`collect_paid_on_${chargeId}`}
              name="paid_on"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </Field>
        </div>
        <Field label="Reference" htmlFor={`collect_reference_${chargeId}`}>
          <Input id={`collect_reference_${chargeId}`} name="reference" placeholder="Optional" />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </form>
    </ActionSheet>
  );
}
