"use client";

import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Composer, ComposerBar } from "@/components/studio/composer";
import { composerControlClassName } from "@/components/studio/chrome";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { createChargeAction, recordPaymentAction } from "@/modules/finance/actions";
import type { CollectTarget } from "@/modules/finance/presentation";
import { formatMoney, netFromGross, parseMajorToMinor, type IsoCurrency } from "@/shared/money";

type ClientOption = { id: string; name: string; currency: string };

export function CreateChargeDialog({
  orgSlug,
  clients,
  defaultClientId,
  defaultGross,
  defaultFeeBps = "500",
  defaultMemo,
  defaultOpen = false,
  hideTrigger = false,
  returnHref,
  triggerLabel = "Add charge",
  triggerVariant = "outline",
  open: openProp,
  onOpenChange,
}: {
  orgSlug: string;
  clients: ClientOption[];
  defaultClientId?: string;
  defaultGross?: string;
  defaultFeeBps?: string;
  defaultMemo?: string;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  returnHref?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const [pending, start] = useTransition();
  const selected = defaultClientId ?? clients[0]?.id ?? "";
  const [clientId, setClientId] = useState(selected);
  const [gross, setGross] = useState(defaultGross ?? "");
  const [feeBps, setFeeBps] = useState(defaultFeeBps);
  const currency = (clients.find((client) => client.id === clientId)?.currency ??
    "USD") as IsoCurrency;

  const netLabel = useMemo(() => {
    try {
      if (!gross.trim()) return null;
      const grossMinor = parseMajorToMinor(gross, currency);
      return formatMoney({
        amountMinor: netFromGross(grossMinor, Number(feeBps) || 0),
        currency,
      });
    } catch {
      return null;
    }
  }, [gross, feeBps, currency]);

  useEffect(() => {
    if (!controlled) setUncontrolledOpen(defaultOpen);
  }, [defaultOpen, controlled]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  }

  function close() {
    setOpen(false);
    if (defaultOpen && !controlled) {
      router.replace(returnHref ?? `/${orgSlug}/finance`);
    }
  }

  useEffect(() => {
    setClientId(selected);
  }, [selected]);

  return (
    <ActionSheet
      title="Add charge"
      description="Gross in. Fee computes net on Collect."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      triggerDisabled={clients.length === 0}
      hideTrigger={hideTrigger}
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await createChargeAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Charge posted");
            close();
            router.refresh();
          });
        }}
      >
        <Field label="Client" htmlFor="client_id">
          <NativeSelect
            id="client_id"
            name="client_id"
            required
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Gross" htmlFor="gross">
          <Input
            id="gross"
            name="gross"
            required
            inputMode="decimal"
            placeholder="4500.00"
            value={gross}
            onChange={(event) => setGross(event.target.value)}
          />
        </Field>
        <Field label="Platform fee" htmlFor="fee_bps" hint={netLabel ? `Net ${netLabel}` : undefined}>
          <NativeSelect
            id="fee_bps"
            name="fee_bps"
            value={feeBps}
            onChange={(event) => setFeeBps(event.target.value)}
          >
            <option value="0">None (0%)</option>
            <option value="400">4%</option>
            <option value="500">5% Upwork</option>
            <option value="1300">13%</option>
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Charged on" htmlFor="charged_on">
            <Input
              id="charged_on"
              name="charged_on"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Due on" htmlFor="due_on">
            <Input id="due_on" name="due_on" type="date" />
          </Field>
        </div>
        <Field label="Memo" htmlFor="memo">
          <Input
            id="memo"
            name="memo"
            placeholder="June work, kickoff, retainer…"
            defaultValue={defaultMemo}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending || clients.length === 0}>
          {pending ? "Posting…" : "Post charge"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function RecordPaymentDialog({
  orgSlug,
  clients,
  defaultClientId,
  defaultOpen = false,
  hideTrigger = false,
  returnHref,
  triggerLabel = "Collect",
  triggerVariant = "outline",
  targets = [],
  defaultChargeId,
  defaultAmount,
}: {
  orgSlug: string;
  clients: ClientOption[];
  defaultClientId?: string;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  returnHref?: string;
  triggerLabel?: string;
  triggerVariant?: "outline" | "default" | "ghost";
  targets?: CollectTarget[];
  defaultChargeId?: string;
  defaultAmount?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const selected = defaultClientId ?? clients[0]?.id ?? "";

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    if (defaultOpen) {
      router.replace(returnHref ?? `/${orgSlug}/finance`);
    }
  }

  return (
    <ActionSheet
      title="Collect"
      description="Pick a billed milestone or charge. Leftover still fills older unpaid items."
      triggerLabel={triggerLabel}
      triggerIcon={<HandCoins />}
      triggerVariant={triggerVariant}
      triggerDisabled={clients.length === 0}
      hideTrigger={hideTrigger}
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <PaymentFields
        orgSlug={orgSlug}
        clients={clients}
        selected={selected}
        pending={pending}
        start={start}
        targets={targets}
        defaultChargeId={defaultChargeId}
        defaultAmount={defaultAmount}
        onDone={() => {
          close();
          router.refresh();
        }}
      />
    </ActionSheet>
  );
}

function PaymentFields({
  orgSlug,
  clients,
  selected,
  pending,
  start,
  onDone,
  compact = false,
  targets = [],
  defaultChargeId,
  defaultAmount,
}: {
  orgSlug: string;
  clients: ClientOption[];
  selected: string;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
  onDone: () => void;
  compact?: boolean;
  targets?: CollectTarget[];
  defaultChargeId?: string;
  defaultAmount?: string;
}) {
  const preferred =
    targets.find((target) => target.id === defaultChargeId)?.amount ?? defaultAmount ?? "";
  return (
    <form
      className={compact ? "flex flex-wrap items-end gap-2" : "grid gap-4"}
      action={(formData) => {
        start(async () => {
          const result = await recordPaymentAction(orgSlug, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.unallocatedMinor && result.unallocatedMinor !== "0") {
            toast.success("Collected: leftover is credit");
          } else {
            toast.success("Collected");
          }
          onDone();
        });
      }}
    >
      {compact ? (
        <>
          <input type="hidden" name="client_id" value={selected} />
          <input type="hidden" name="kind" value="receipt" />
          <label className="flex min-w-28 flex-1 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Amount</span>
            <Input
              name="amount"
              required
              inputMode="decimal"
              placeholder="300.00"
              defaultValue={preferred}
            />
          </label>
          <label className="flex w-32 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Method</span>
            <NativeSelect name="method" defaultValue="upwork">
              <option value="upwork">Upwork</option>
              <option value="bank">Bank</option>
              <option value="stripe">Stripe</option>
              <option value="other">Other</option>
            </NativeSelect>
          </label>
          <label className="flex w-36 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Paid on</span>
            <Input name="paid_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className="flex min-w-32 flex-1 flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Reference</span>
            <Input name="reference" placeholder="Upwork ID…" />
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={pending || !selected}>
            {pending ? "Collecting…" : "Collect"}
          </Button>
        </>
      ) : (
        <>
          <Field label="Client" htmlFor="pay_client_id">
            <NativeSelect id="pay_client_id" name="client_id" required defaultValue={selected}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Kind" htmlFor="kind">
            <NativeSelect id="kind" name="kind" defaultValue="receipt">
              <option value="receipt">Receipt</option>
              <option value="refund">Refund</option>
            </NativeSelect>
          </Field>
          <Field label="Apply to" htmlFor="charge_id">
            <NativeSelect id="charge_id" name="charge_id" defaultValue={defaultChargeId ?? ""}>
              <option value="">Oldest unpaid first</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Amount" htmlFor="amount">
            <Input
              id="amount"
              name="amount"
              required
              inputMode="decimal"
              placeholder="300.00"
              defaultValue={preferred}
            />
          </Field>
          <Field label="Method" htmlFor="method">
            <NativeSelect id="method" name="method" defaultValue="upwork">
              <option value="upwork">Upwork</option>
              <option value="bank">Bank</option>
              <option value="stripe">Stripe</option>
              <option value="other">Other</option>
            </NativeSelect>
          </Field>
          <Field label="Paid on" htmlFor="paid_on">
            <Input
              id="paid_on"
              name="paid_on"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Reference" htmlFor="reference">
            <Input id="reference" name="reference" placeholder="Upwork ID, transfer note…" />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending || clients.length === 0}>
            {pending ? "Collecting…" : "Collect"}
          </Button>
        </>
      )}
    </form>
  );
}

export function CollectComposer({
  orgSlug,
  clientId,
  disabled = false,
  targets = [],
  defaultChargeId,
}: {
  orgSlug: string;
  clientId?: string;
  disabled?: boolean;
  targets?: CollectTarget[];
  defaultChargeId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const initial = targets.some((target) => target.id === defaultChargeId) ? defaultChargeId : "";
  const [chargeId, setChargeId] = useState(initial ?? "");

  useEffect(() => {
    const next = targets.some((target) => target.id === defaultChargeId) ? defaultChargeId ?? "" : "";
    setChargeId(next);
    const target = targets.find((item) => item.id === next);
    if (target && amountRef.current && !amountRef.current.value) {
      amountRef.current.value = target.amount;
    }
  }, [defaultChargeId, targets]);

  return (
    <Composer>
      <div className="border-b border-border/40 px-3 py-2">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Record payment
        </p>
      </div>
      {disabled || !clientId ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          Pick someone who owes you
        </p>
      ) : (
        <ComposerBar prominent>
          <form
            id="collect"
            key={`${clientId}-${initial ?? ""}`}
            ref={formRef}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
            action={(formData) => {
              start(async () => {
                const result = await recordPaymentAction(orgSlug, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                if (result.unallocatedMinor && result.unallocatedMinor !== "0") {
                  toast.success("Recorded: leftover is payment not applied");
                } else {
                  toast.success("Payment recorded");
                }
                formRef.current?.reset();
                setChargeId("");
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="kind" value="receipt" />
            <NativeSelect
              name="charge_id"
              value={chargeId}
              onChange={(event) => {
                const next = event.target.value;
                setChargeId(next);
                const target = targets.find((item) => item.id === next);
                if (target && amountRef.current) {
                  amountRef.current.value = target.amount;
                }
              }}
              className={cn(composerControlClassName, "max-w-xs min-w-48 flex-1")}
              aria-label="Apply to charge"
            >
              <option value="">Oldest unpaid first</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
            <Input
              ref={amountRef}
              name="amount"
              required
              inputMode="decimal"
              placeholder="Amount"
              aria-label="Amount"
              defaultValue={targets.find((target) => target.id === chargeId)?.amount}
              className={cn(composerControlClassName, "w-28")}
            />
            <NativeSelect name="method" defaultValue="upwork" className={cn(composerControlClassName, "w-28")} aria-label="Method">
              <option value="upwork">Upwork</option>
              <option value="bank">Bank</option>
              <option value="stripe">Stripe</option>
              <option value="other">Other</option>
            </NativeSelect>
            <Input
              name="paid_on"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={cn(composerControlClassName, "w-36")}
              aria-label="Paid on"
            />
            <Input
              name="reference"
              placeholder="Reference"
              className={cn(composerControlClassName, "min-w-32 flex-1")}
            />
            <Button type="submit" disabled={pending} className="m-1">
              {pending ? "Recording…" : "Record"}
            </Button>
          </form>
        </ComposerBar>
      )}
    </Composer>
  );
}
