"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, Download, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addInvoiceLineAction,
  applyInvoiceTemplateAction,
  createDraftInvoiceAction,
  deleteInvoiceLineAction,
  updateInvoiceAction,
  updateInvoiceBillToAction,
  updateInvoiceLineAction,
  voidInvoiceAction,
} from "@/modules/invoices/actions";
import { useReportInvoiceBusy } from "@/modules/invoices/components/invoice-busy";
import { ExtraFieldsEditor } from "@/modules/invoices/components/extra-fields-editor";
import { IssueInvoiceButton } from "@/modules/invoices/components/invoice-flow";
import { InvoiceLayoutThumb } from "@/modules/invoices/components/layout-thumb";
import { percentFieldToBps } from "@/modules/invoices/components/tax-field";
import { INVOICE_LAYOUT_SPECS } from "@/modules/invoices/layouts";
import type { BillingContact, LineSuggestion } from "@/modules/invoices/queries";
import type { InvoiceTemplate } from "@/modules/invoices/templates";
import type { InvoiceBillTo, InvoiceLine, InvoiceRecord } from "@/modules/invoices/types";
import { lineTotalMinor } from "@/modules/invoices/totals";
import { formatMoney, fromMinor, type IsoCurrency } from "@/shared/money";

export function CreateInvoiceDialog({
  orgSlug,
  clients,
  templates = [],
  defaultDueOn,
  defaultTaxBps = 0,
  defaultOpen = false,
  defaultClientId,
}: {
  orgSlug: string;
  clients: { id: string; name: string; currency: string }[];
  templates?: InvoiceTemplate[];
  defaultDueOn?: string;
  defaultTaxBps?: number;
  defaultOpen?: boolean;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const [firstLine, setFirstLine] = useState(false);
  const defaultTemplateId =
    templates.find((row) => row.isDefault)?.id ?? templates[0]?.id ?? "";

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    if (defaultOpen) router.replace(`/${orgSlug}/invoices`);
  }

  return (
    <ActionSheet
      title="New invoice"
      description="Billing details, terms and payment details fill in from the client and your defaults."
      triggerLabel="New invoice"
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          percentFieldToBps(formData, "tax_percent", "tax_bps");
          start(async () => {
            const result = await createDraftInvoiceAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Draft invoice created");
            close();
            router.push(`/${orgSlug}/invoices/${result.id}`);
          });
        }}
      >
        <Field label="Client" htmlFor="client_id" required>
          <NativeSelect
            id="client_id"
            name="client_id"
            required
            defaultValue={defaultClientId ?? ""}
          >
            <option value="">Select…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {templates.length > 0 ? (
          <Field label="Template" htmlFor="template_id">
            <NativeSelect
              id="template_id"
              name="template_id"
              defaultValue={defaultTemplateId}
            >
              <option value="">Org defaults</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault ? " (default)" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due on" htmlFor="due_on">
            <Input
              id="due_on"
              name="due_on"
              type="date"
              defaultValue={defaultDueOn ?? ""}
            />
          </Field>
          <Field label="Reference / PO" htmlFor="reference">
            <Input id="reference" name="reference" placeholder="Optional" autoComplete="off" />
          </Field>
        </div>
        {firstLine ? (
          <div className="grid gap-2 rounded-xl bg-muted/40 p-3">
            <Input
              id="description"
              name="description"
              aria-label="First line description"
              placeholder="First line item, e.g. Kickoff"
              autoComplete="off"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                name="quantity"
                aria-label="Quantity"
                type="number"
                step="0.001"
                defaultValue="1"
              />
              <Input name="unit_amount" aria-label="Rate" inputMode="decimal" placeholder="Rate" />
              <Input
                name="tax_percent"
                aria-label="Tax %"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={defaultTaxBps / 100}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFirstLine(true)}
            className="inline-flex items-center gap-1.5 justify-self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add a first line item
          </button>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function AddInvoiceLineForm({
  orgSlug,
  invoiceId,
  currency,
  defaultTaxBps = 0,
  suggestions = [],
}: {
  orgSlug: string;
  invoiceId: string;
  currency: IsoCurrency;
  defaultTaxBps?: number;
  suggestions?: LineSuggestion[];
}) {
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const defaultTax = String(defaultTaxBps / 100);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rate, setRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState(defaultTax);
  const [more, setMore] = useState(false);
  const recent = suggestions.filter((item) => item.forClient).slice(0, 4);
  const listId = `line-suggestions-${invoiceId}`;

  function applySuggestion(item: LineSuggestion) {
    setDescription(item.description);
    setRate(String(fromMinor(BigInt(item.unitAmountMinor), currency)));
    setTax(String(item.taxBps / 100));
  }

  function reset() {
    setDescription("");
    setQuantity("1");
    setRate("");
    setDiscount("");
    setTax(defaultTax);
  }

  return (
    <form
      className="grid gap-2 rounded-xl border border-dashed border-border/70 p-3"
      autoComplete="off"
      action={(formData) => {
        percentFieldToBps(formData, "tax_percent", "tax_bps");
        start(async () => {
          const result = await addInvoiceLineAction(orgSlug, invoiceId, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Line added");
          reset();
        });
      }}
    >
      {recent.length > 0 && !description ? (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-muted-foreground">Billed before:</span>
          {recent.map((item) => (
            <button
              key={item.description}
              type="button"
              onClick={() => applySuggestion(item)}
              className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-primary/10 hover:text-primary"
              title={`${item.description} · ${formatMoney({ amountMinor: BigInt(item.unitAmountMinor), currency })}`}
            >
              {item.description.split("\n")[0]}
            </button>
          ))}
        </div>
      ) : null}
      <Input
        name="description"
        aria-label="Item description"
        placeholder="Item or service, e.g. Design sprint"
        required
        list={suggestions.length ? listId : undefined}
        value={description}
        onChange={(event) => {
          const next = event.target.value;
          setDescription(next);
          const match = suggestions.find(
            (item) => item.description.toLowerCase() === next.trim().toLowerCase(),
          );
          if (match && !rate) {
            setRate(String(fromMinor(BigInt(match.unitAmountMinor), currency)));
            setTax(String(match.taxBps / 100));
          }
        }}
        data-1p-ignore
      />
      {suggestions.length ? (
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item.description} value={item.description}>
              {formatMoney({ amountMinor: BigInt(item.unitAmountMinor), currency })}
            </option>
          ))}
        </datalist>
      ) : null}
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-2">
        <Input
          name="quantity"
          aria-label="Quantity"
          type="number"
          step="0.001"
          min={0}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <Input
          name="unit_amount"
          aria-label="Rate"
          inputMode="decimal"
          placeholder="Rate"
          required
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />
        <Button type="submit" disabled={pending} className="gap-1.5">
          <Plus className="size-4" />
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {more ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Discount" htmlFor={`${listId}-discount`}>
            <Input
              id={`${listId}-discount`}
              name="discount"
              inputMode="decimal"
              placeholder="0.00"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </Field>
          <Field label="Tax %" htmlFor={`${listId}-tax`}>
            <Input
              id={`${listId}-tax`}
              name="tax_percent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={tax}
              onChange={(event) => setTax(event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="discount" value={discount} />
          <input type="hidden" name="tax_percent" value={tax} />
          <button
            type="button"
            onClick={() => setMore(true)}
            className="justify-self-start text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {Number(tax) > 0 ? `Tax ${tax}%` : "No tax"}
            {discount ? ` · discount ${discount}` : ""} · <span className="underline">change</span>
          </button>
        </>
      )}
    </form>
  );
}

export function InvoiceLineEditor({
  orgSlug,
  invoice,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
}) {
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (invoice.issuedAt || invoice.status !== "draft") return null;

  if (invoice.lines.length === 0) {
    return <p className="text-xs text-muted-foreground">No line items yet. Add the first one below.</p>;
  }

  return (
    <div className="space-y-1.5">
      {invoice.lines.map((line) =>
        editingId === line.id ? (
          <LineEditRow
            key={line.id}
            orgSlug={orgSlug}
            invoice={invoice}
            line={line}
            pending={pending}
            onCancel={() => setEditingId(null)}
            onSave={(formData) => {
              percentFieldToBps(formData, "tax_percent", "tax_bps");
              start(async () => {
                const result = await updateInvoiceLineAction(
                  orgSlug,
                  invoice.id,
                  line.id,
                  formData,
                );
                if (result.error) toast.error(result.error);
                else {
                  toast.success("Line updated");
                  setEditingId(null);
                }
              });
            }}
          />
        ) : (
          <div
            key={line.id}
            className="group flex items-center gap-2 rounded-2xl bg-muted/40 py-2 pr-1.5 pl-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{line.description}</p>
              <p className="text-xs text-muted-foreground">
                {line.quantity} ×{" "}
                {formatMoney({
                  amountMinor: line.unitAmountMinor,
                  currency: invoice.currency,
                })}
                {line.discountMinor > BigInt(0)
                  ? ` − ${formatMoney({ amountMinor: line.discountMinor, currency: invoice.currency })}`
                  : ""}
                {line.taxBps > 0 ? ` · ${line.taxBps / 100}% tax` : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney({ amountMinor: lineTotalMinor(line), currency: invoice.currency })}
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Edit ${line.description}`}
              onClick={() => setEditingId(line.id)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${line.description}`}
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await deleteInvoiceLineAction(orgSlug, invoice.id, line.id);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success("Line removed");
                  }
                });
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      )}
    </div>
  );
}

function LineEditRow({
  invoice,
  line,
  pending,
  onCancel,
  onSave,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  line: InvoiceLine;
  pending: boolean;
  onCancel: () => void;
  onSave: (formData: FormData) => void;
}) {
  return (
    <form
      className="grid gap-2 lane-inset p-3"
      action={(formData) => onSave(formData)}
    >
      <Input
        name="description"
        aria-label="Description"
        required
        defaultValue={line.description}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Qty" htmlFor={`qty-${line.id}`}>
          <Input
            id={`qty-${line.id}`}
            name="quantity"
            type="number"
            step="0.001"
            defaultValue={line.quantity}
          />
        </Field>
        <Field label="Rate" htmlFor={`rate-${line.id}`}>
          <Input
            id={`rate-${line.id}`}
            name="unit_amount"
            inputMode="decimal"
            defaultValue={fromMinor(line.unitAmountMinor, invoice.currency)}
          />
        </Field>
        <Field label="Discount" htmlFor={`discount-${line.id}`}>
          <Input
            id={`discount-${line.id}`}
            name="discount"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={
              line.discountMinor > BigInt(0)
                ? fromMinor(line.discountMinor, invoice.currency)
                : ""
            }
          />
        </Field>
        <Field label="Tax %" htmlFor={`tax-${line.id}`}>
          <Input
            id={`tax-${line.id}`}
            name="tax_percent"
            type="number"
            step="0.01"
            min={0}
            max={100}
            defaultValue={line.taxBps / 100}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function InvoiceActions({
  orgSlug,
  invoice,
  canWrite,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const issued = Boolean(invoice.issuedAt);
  const isDraft = invoice.status === "draft" && !issued;

  if (!canWrite) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {isDraft ? (
        <IssueInvoiceButton
          orgSlug={orgSlug}
          invoiceId={invoice.id}
          disabled={invoice.lines.length === 0}
        />
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={() => {
          window.open(`/${orgSlug}/invoices/${invoice.id}/pdf`, "_blank");
        }}
      >
        <Download className="size-4" />
        PDF
      </Button>

      {invoice.status !== "void" && invoice.status !== "paid" && invoice.status !== "partially_paid" ? (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Void ${invoice.number}? This can't be undone.`)) return;
            start(async () => {
              const result = await voidInvoiceAction(orgSlug, invoice.id);
              if (result.error) toast.error(result.error);
              else toast.success("Invoice voided");
            });
          }}
        >
          Void
        </Button>
      ) : null}
    </div>
  );
}

const BILL_TO_FIELD_SUGGESTIONS = ["Place of supply", "Vendor code", "PAN", "Cost center"];

export function BillToForm({
  orgSlug,
  invoice,
  clientName,
  contacts = [],
  clientBilling = null,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  clientName: string;
  contacts?: BillingContact[];
  clientBilling?: InvoiceBillTo | null;
}) {
  const hasClientDefault = Boolean(clientBilling?.name);
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const bill = invoice.billTo;
  const [values, setValues] = useState({
    name: bill?.name || clientName,
    contactName: bill?.contactName ?? "",
    email: bill?.email ?? "",
    phone: bill?.phone ?? "",
    taxId: bill?.taxId ?? "",
    address: bill?.address ?? "",
  });
  const [extras, setExtras] = useState(bill?.extras ?? []);
  const [extrasKey, setExtrasKey] = useState(0);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const usable = contacts.filter((contact) => contact.name || contact.email);
  const clientDiffers =
    clientBilling?.name &&
    JSON.stringify({ ...values, extras }) !==
      JSON.stringify({
        name: clientBilling.name,
        contactName: clientBilling.contactName,
        email: clientBilling.email,
        phone: clientBilling.phone,
        taxId: clientBilling.taxId,
        address: clientBilling.address,
        extras: clientBilling.extras,
      });

  function applyClientBilling() {
    if (!clientBilling) return;
    setValues({
      name: clientBilling.name,
      contactName: clientBilling.contactName,
      email: clientBilling.email,
      phone: clientBilling.phone,
      taxId: clientBilling.taxId,
      address: clientBilling.address,
    });
    setExtras(clientBilling.extras);
    setExtrasKey((key) => key + 1);
  }

  return (
    <form
      className="grid gap-3"
      autoComplete="off"
      action={(formData) => {
        start(async () => {
          const result = await updateInvoiceBillToAction(orgSlug, invoice.id, formData);
          if (result.error) toast.error(result.error);
          else {
            toast.success(
              "savedToClient" in result && result.savedToClient
                ? "Saved, and remembered for this client"
                : "Billed-to details saved",
            );
          }
        });
      }}
    >
      {clientDiffers ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-2.5 py-2 text-[11px] text-muted-foreground ring-1 ring-primary/15">
          <span className="min-w-0">{clientName}&apos;s saved billing details differ from this invoice.</span>
          <button
            type="button"
            onClick={applyClientBilling}
            className="shrink-0 font-semibold text-primary hover:underline"
          >
            Use them
          </button>
        </div>
      ) : null}
      {usable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Fill from contact:</span>
          {usable.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() =>
                setValues((current) => ({
                  ...current,
                  contactName: contact.name ?? current.contactName,
                  email: contact.email ?? current.email,
                  phone: contact.phone ?? current.phone,
                }))
              }
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <UserRound className="size-3" />
              {contact.name || contact.email}
            </button>
          ))}
        </div>
      ) : null}
      <Field label="Company or name" htmlFor="bill_to_name" required>
        <Input
          id="bill_to_name"
          name="bill_to_name"
          required
          value={values.name}
          onChange={set("name")}
          data-1p-ignore
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Attention" htmlFor="bill_to_contact">
          <Input
            id="bill_to_contact"
            name="bill_to_contact"
            value={values.contactName}
            onChange={set("contactName")}
            placeholder="Contact person"
            data-1p-ignore
          />
        </Field>
        <Field label="Tax ID" htmlFor="bill_to_tax_id">
          <Input
            id="bill_to_tax_id"
            name="bill_to_tax_id"
            value={values.taxId}
            onChange={set("taxId")}
            placeholder="GSTIN / VAT"
            data-1p-ignore
          />
        </Field>
        <Field label="Email" htmlFor="bill_to_email">
          <Input
            id="bill_to_email"
            name="bill_to_email"
            type="email"
            value={values.email}
            onChange={set("email")}
            placeholder="billing@client.com"
            data-1p-ignore
          />
        </Field>
        <Field label="Phone" htmlFor="bill_to_phone">
          <Input
            id="bill_to_phone"
            name="bill_to_phone"
            value={values.phone}
            onChange={set("phone")}
            data-1p-ignore
          />
        </Field>
      </div>
      <Field label="Billing address" htmlFor="bill_to_address">
        <Textarea
          id="bill_to_address"
          name="bill_to_address"
          rows={3}
          value={values.address}
          onChange={set("address")}
          placeholder={"Street\nCity, State ZIP\nCountry"}
          className="resize-none"
        />
      </Field>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">More details</p>
        <ExtraFieldsEditor
          key={extrasKey}
          prefix="bill_to_extra"
          initial={extras}
          suggestions={BILL_TO_FIELD_SUGGESTIONS}
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="save_to_client"
          defaultChecked={!hasClientDefault}
          className="mt-0.5 rounded border-input"
        />
        <span>
          {hasClientDefault ? "Update" : "Save as"} {clientName}&apos;s billing details, so future
          invoices fill in automatically
        </span>
      </label>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save billed to"}
      </Button>
    </form>
  );
}

function useInvoicePatch(orgSlug: string, invoiceId: string, success: string) {
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const submit = (formData: FormData) => {
    start(async () => {
      const result = await updateInvoiceAction(orgSlug, invoiceId, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(success);
      }
    });
  };
  return { pending, submit };
}

export function InvoiceDatesForm({ orgSlug, invoice }: { orgSlug: string; invoice: InvoiceRecord }) {
  const { pending, submit } = useInvoicePatch(orgSlug, invoice.id, "Dates saved");
  return (
    <form className="grid gap-3" action={submit}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Due date" htmlFor="due_on">
          <Input id="due_on" name="due_on" type="date" defaultValue={invoice.dueOn ?? ""} />
        </Field>
        <Field label="Reference / PO" htmlFor="reference">
          <Input
            id="reference"
            name="reference"
            defaultValue={invoice.reference ?? ""}
            placeholder="PO-1042"
            autoComplete="off"
          />
        </Field>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The issue date and invoice number are set when you issue.
      </p>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function InvoiceNotesForm({
  orgSlug,
  invoice,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
}) {
  const { pending, submit } = useInvoicePatch(orgSlug, invoice.id, "Saved");
  return (
    <form className="grid gap-3" action={submit}>
      <Field
        label="Payment details"
        htmlFor="payment_instructions"
        hint="Bank account, UPI ID or a payment link. Printed next to the totals."
      >
        <Textarea
          id="payment_instructions"
          name="payment_instructions"
          rows={4}
          defaultValue={invoice.paymentInstructions ?? ""}
          placeholder={"Bank: …\nAccount name: …\nAccount no.: …\nIFSC / SWIFT: …"}
          className="resize-none"
        />
      </Field>
      <Field label="Notes to client" htmlFor="memo">
        <Textarea
          id="memo"
          name="memo"
          rows={2}
          defaultValue={invoice.memo ?? ""}
          placeholder="Thanks for your business!"
          className="resize-none"
        />
      </Field>
      <Field label="Terms & conditions" htmlFor="terms">
        <Textarea
          id="terms"
          name="terms"
          rows={2}
          defaultValue={invoice.terms ?? ""}
          placeholder="Payment due within 14 days."
          className="resize-none"
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function InvoiceTemplatePicker({
  orgSlug,
  invoice,
  templates,
  defaultAccent,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  templates: InvoiceTemplate[];
  defaultAccent: string;
}) {
  const [pending, start] = useTransition();
  useReportInvoiceBusy(pending);
  const [selected, setSelected] = useOptimistic(invoice.templateId);
  const [applying, setApplying] = useState<string | null>(null);

  function apply(template: InvoiceTemplate) {
    setApplying(template.id);
    const toastId = toast.loading(`Applying ${template.name}…`);
    start(async () => {
      setSelected(template.id);
      const result = await applyInvoiceTemplateAction(orgSlug, invoice.id, template.id);
      setApplying(null);
      if (result.error) toast.error(result.error, { id: toastId });
      else toast.success(`${template.name} look applied`, { id: toastId });
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {templates.map((template) => {
        const active = selected === template.id;
        const loading = pending && applying === template.id;
        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={active}
            disabled={pending || active}
            title={INVOICE_LAYOUT_SPECS[template.layout].description}
            onClick={() => apply(template)}
            className={cn(
              "relative rounded-xl p-1.5 text-left ring-1 transition-all disabled:cursor-default",
              active ? "bg-primary/5 ring-2 ring-primary" : "ring-border/60 hover:ring-border",
              pending && !loading && !active && "opacity-50",
            )}
          >
            <span className="relative block">
              <InvoiceLayoutThumb
                layout={template.layout}
                accent={template.accentHex || defaultAccent}
                className="rounded-md"
              />
              {loading ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/55">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </span>
              ) : null}
            </span>
            <span className="mt-1.5 block truncate px-0.5 text-xs font-medium">{template.name}</span>
            {active && !loading ? (
              <span className="absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

