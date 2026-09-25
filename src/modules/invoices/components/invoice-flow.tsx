"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  Ban,
  Check,
  CircleDollarSign,
  FileCheck2,
  Mail,
  PartyPopper,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDay } from "@/modules/finance/presentation";
import {
  issueInvoiceAction,
  markInvoiceSentAction,
  recordInvoicePaymentAction,
  sendInvoiceEmailAction,
} from "@/modules/invoices/actions";
import {
  INVOICE_PAYMENT_METHOD_LABELS,
  INVOICE_PAYMENT_METHODS,
  type InvoiceDisplayStatus,
  type InvoicePayment,
  type InvoiceRecord,
} from "@/modules/invoices/types";
import { invoiceSubtotalMinor } from "@/modules/invoices/totals";
import { formatMoney, fromMinor } from "@/shared/money";

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "issued", label: "Issued" },
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
] as const;

function reachedStep(invoice: InvoiceRecord, status: InvoiceDisplayStatus): number {
  if (status === "paid") return 3;
  if (invoice.sentAt || status === "sent" || status === "partially_paid") return 2;
  if (invoice.issuedAt) return 1;
  return 0;
}

export function InvoiceSteps({
  invoice,
  status,
}: {
  invoice: InvoiceRecord;
  status: InvoiceDisplayStatus;
}) {
  const reached = reachedStep(invoice, status);
  const voided = status === "void";
  return (
    <ol className="flex items-center gap-1.5" aria-label="Invoice progress">
      {STEPS.map((step, index) => {
        const done = !voided && index < reached;
        const current = !voided && index === reached;
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                done && "bg-emerald-500 text-white",
                current &&
                  (status === "paid"
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground ring-4 ring-primary/15"),
                !done && !current && "bg-muted text-muted-foreground",
              )}
            >
              {done || (current && status === "paid") ? <Check className="size-3" /> : index + 1}
            </span>
            <span
              className={cn(
                "truncate text-xs",
                current ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  "h-px min-w-3 flex-1",
                  done ? "bg-emerald-500/60" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function IssueInvoiceButton({
  orgSlug,
  invoiceId,
  disabled,
  className,
}: {
  orgSlug: string;
  invoiceId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDouble, setConfirmDouble] = useState(false);
  return (
    <Button
      type="button"
      className={cn("gap-2", className)}
      disabled={pending || disabled}
      onClick={() => {
        start(async () => {
          const fd = new FormData();
          if (confirmDouble) fd.set("confirm_double", "1");
          const result = await issueInvoiceAction(orgSlug, invoiceId, fd);
          if (result.needsConfirmDouble) {
            setConfirmDouble(true);
            toast.error(result.error);
            return;
          }
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`Issued ${result.number ?? "invoice"}`);
          setConfirmDouble(false);
          router.refresh();
        });
      }}
    >
      <FileCheck2 className="size-4" />
      {confirmDouble ? "Issue anyway (double bill)" : pending ? "Issuing…" : "Issue invoice"}
    </Button>
  );
}

export function InvoiceNextStep({
  orgSlug,
  invoice,
  status,
  paidMinor,
  canWrite,
  canRecordPayment,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  status: InvoiceDisplayStatus;
  paidMinor: bigint;
  canWrite: boolean;
  canRecordPayment: boolean;
}) {
  const total = invoiceSubtotalMinor(invoice.lines);
  const balance = total > paidMinor ? total - paidMinor : BigInt(0);
  const money = (amountMinor: bigint) => formatMoney({ amountMinor, currency: invoice.currency });

  if (status === "void") {
    return (
      <StepCard icon={Ban} tone="muted" title="Voided">
        This invoice was cancelled and its ledger charges were voided.
      </StepCard>
    );
  }

  if (status === "paid") {
    return (
      <StepCard icon={PartyPopper} tone="success" title="Paid in full">
        {money(total)} received
        {invoice.paidAt ? ` · ${formatDay(invoice.paidAt.slice(0, 10))}` : ""}. Nothing left to do.
      </StepCard>
    );
  }

  if (status === "draft") {
    return (
      <StepCard
        icon={FileCheck2}
        title="Next: issue the invoice"
        action={
          canWrite ? (
            <IssueInvoiceButton
              orgSlug={orgSlug}
              invoiceId={invoice.id}
              disabled={invoice.lines.length === 0}
              className="w-full"
            />
          ) : null
        }
      >
        {invoice.lines.length === 0
          ? "Add at least one line item first."
          : "Issuing assigns the invoice number, locks the details and adds the amount to the client's balance."}
      </StepCard>
    );
  }

  if (status === "issued") {
    return (
      <StepCard
        icon={Send}
        title="Next: send it to the client"
        action={
          canWrite ? (
            <div className="grid gap-2">
              <SendInvoiceDialog orgSlug={orgSlug} invoice={invoice} balanceLabel={money(balance)} />
              <MarkSentButton orgSlug={orgSlug} invoiceId={invoice.id} />
            </div>
          ) : null
        }
      >
        Email the PDF straight from here, or mark it as sent if you shared it another way.
      </StepCard>
    );
  }

  return (
    <StepCard
      icon={status === "overdue" ? AlarmClock : CircleDollarSign}
      tone={status === "overdue" ? "warning" : "default"}
      title={
        status === "overdue"
          ? "Overdue: follow up"
          : paidMinor > BigInt(0)
            ? "Partially paid"
            : "Waiting for payment"
      }
      action={
        <div className="grid gap-2">
          {canRecordPayment ? (
            <RecordPaymentDialog
              orgSlug={orgSlug}
              invoice={invoice}
              balanceMinor={balance}
            />
          ) : null}
          {canWrite ? (
            <SendInvoiceDialog
              orgSlug={orgSlug}
              invoice={invoice}
              balanceLabel={money(balance)}
              reminder
            />
          ) : null}
        </div>
      }
    >
      {money(balance)} outstanding
      {invoice.dueOn
        ? status === "overdue"
          ? `, due ${formatDay(invoice.dueOn)}`
          : ` · due ${formatDay(invoice.dueOn)}`
        : ""}
      . Record payments as they arrive; the status updates automatically.
    </StepCard>
  );
}

function StepCard({
  icon: Icon,
  title,
  tone = "default",
  action,
  children,
}: {
  icon: typeof Send;
  title: string;
  tone?: "default" | "success" | "warning" | "muted";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-2xl border p-4",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/[0.06]",
        tone === "warning" && "border-amber-500/40 bg-amber-500/[0.07]",
        tone === "muted" && "border-border/60 bg-muted/40",
        tone === "default" && "border-primary/25 bg-primary/[0.04]",
      )}
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-xl",
            tone === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            tone === "warning" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            tone === "muted" && "bg-muted text-muted-foreground",
            tone === "default" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function MarkSentButton({ orgSlug, invoiceId }: { orgSlug: string; invoiceId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await markInvoiceSentAction(orgSlug, invoiceId);
          if (result.error) toast.error(result.error);
          else {
            toast.success("Marked as sent");
            router.refresh();
          }
        });
      }}
    >
      I sent it another way
    </Button>
  );
}

export function SendInvoiceDialog({
  orgSlug,
  invoice,
  balanceLabel,
  reminder = false,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  balanceLabel: string;
  reminder?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant={reminder ? "outline" : "default"}
        className="w-full gap-2"
        onClick={() => setOpen(true)}
      >
        <Mail className="size-4" />
        {reminder ? "Send reminder" : "Email invoice"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reminder ? "Send a payment reminder" : `Email ${invoice.number}`}</DialogTitle>
            <DialogDescription>
              The PDF is attached. {balanceLabel} due
              {invoice.dueOn ? ` by ${formatDay(invoice.dueOn)}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            action={(formData) => {
              if (reminder) formData.set("kind", "reminder");
              start(async () => {
                const result = await sendInvoiceEmailAction(orgSlug, invoice.id, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success(reminder ? `Reminder sent to ${result.to}` : `Emailed ${result.to}`);
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="To" htmlFor="send_to" required>
              <Input
                id="send_to"
                name="to"
                type="email"
                required
                defaultValue={invoice.billTo?.email ?? ""}
                placeholder="billing@client.com"
                autoComplete="off"
                data-1p-ignore
              />
            </Field>
            <Field
              label="Message"
              htmlFor="send_message"
              hint={reminder ? undefined : "Leave empty to use the invoice notes."}
            >
              <Textarea
                id="send_message"
                name="message"
                rows={4}
                className="resize-none"
                placeholder={
                  reminder
                    ? "Just a quick nudge on this one. Let us know if you have any questions."
                    : "Thanks for working with us!"
                }
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="gap-2">
                <Send className="size-4" />
                {pending ? "Sending…" : reminder ? "Send reminder" : "Send invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RecordPaymentDialog({
  orgSlug,
  invoice,
  balanceMinor,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  balanceMinor: bigint;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button type="button" className="w-full gap-2" onClick={() => setOpen(true)}>
        <CircleDollarSign className="size-4" />
        Record payment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {formatMoney({ amountMinor: balanceMinor, currency: invoice.currency })} is still due on{" "}
              {invoice.number}. Partial payments are fine.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            autoComplete="off"
            action={(formData) => {
              start(async () => {
                const result = await recordInvoicePaymentAction(orgSlug, invoice.id, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.fullyPaid ? "Invoice paid in full" : "Payment recorded");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${invoice.currency})`} htmlFor="pay_amount" required>
                <Input
                  id="pay_amount"
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={fromMinor(balanceMinor, invoice.currency)}
                />
              </Field>
              <Field label="Received on" htmlFor="pay_date" required>
                <Input id="pay_date" name="paid_on" type="date" required defaultValue={today} max={today} />
              </Field>
            </div>
            <Field label="Method" htmlFor="pay_method">
              <NativeSelect id="pay_method" name="method" defaultValue="bank">
                {INVOICE_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {INVOICE_PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Reference" htmlFor="pay_reference" hint="Transaction ID, cheque number, etc.">
              <Input id="pay_reference" name="reference" placeholder="UTR / Txn ID" data-1p-ignore />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoicePaymentsList({
  invoice,
  payments,
  paidMinor,
}: {
  invoice: InvoiceRecord;
  payments: InvoicePayment[];
  paidMinor: bigint;
}) {
  const money = (amountMinor: bigint) => formatMoney({ amountMinor, currency: invoice.currency });
  if (payments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {invoice.issuedAt ? "No payments recorded yet." : "Payments can be recorded once the invoice is issued."}
      </p>
    );
  }
  return (
    <div className="grid gap-1.5">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className={cn(
            "flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm",
            payment.status === "void" && "opacity-60",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className={cn("font-medium", payment.status === "void" && "line-through")}>
              {formatDay(payment.paidOn)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {INVOICE_PAYMENT_METHOD_LABELS[payment.method as keyof typeof INVOICE_PAYMENT_METHOD_LABELS] ??
                payment.method}
              {payment.reference ? ` · ${payment.reference}` : ""}
              {payment.status === "void" ? " · voided" : ""}
            </p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">{money(payment.appliedMinor)}</span>
        </div>
      ))}
      <div className="flex justify-between px-3 pt-1 text-xs text-muted-foreground">
        <span>Total received</span>
        <span className="font-semibold text-foreground tabular-nums">{money(paidMinor)}</span>
      </div>
    </div>
  );
}
