"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { HiddenDocFields, RichEditor } from "@/components/editor/rich-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  addInvoiceLineAction,
  applyInvoiceTemplateAction,
  createDraftInvoiceAction,
  deleteInvoiceLineAction,
  issueInvoiceAction,
  markInvoiceSentAction,
  sendInvoiceEmailAction,
  updateInvoiceAction,
  updateInvoiceLineAction,
  voidInvoiceAction,
} from "@/modules/invoices/actions";
import type { InvoiceTemplate } from "@/modules/invoices/templates";
import type { InvoiceLine, InvoiceRecord } from "@/modules/invoices/types";
import { formatMoney, fromMinor } from "@/shared/money";

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
  const [memoDoc, setMemoDoc] = useState<JSONContent | null>(null);
  const [memoPlain, setMemoPlain] = useState("");
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
      description="Draft first. Issue creates ledger charges."
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
          start(async () => {
            const result = await createDraftInvoiceAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Draft invoice created");
            close();
            router.push(`/${orgSlug}/invoices/${result.id}`);
            router.refresh();
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
        <Field label="Due on" htmlFor="due_on">
          <Input
            id="due_on"
            name="due_on"
            type="date"
            defaultValue={defaultDueOn ?? ""}
          />
        </Field>
        <Field label="First line (optional)" htmlFor="description">
          <Input id="description" name="description" placeholder="Kickoff" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Qty" htmlFor="quantity">
            <Input id="quantity" name="quantity" type="number" step="0.001" defaultValue="1" />
          </Field>
          <Field label="Unit amount" htmlFor="unit_amount">
            <Input id="unit_amount" name="unit_amount" inputMode="decimal" placeholder="0.00" />
          </Field>
          <Field label="Tax bps" htmlFor="tax_bps">
            <Input id="tax_bps" name="tax_bps" type="number" defaultValue={defaultTaxBps} />
          </Field>
        </div>
        <Field label="Memo" htmlFor="memo">
          <RichEditor
            value={memoDoc}
            onChange={(doc, plain) => {
              setMemoDoc(doc);
              setMemoPlain(plain);
            }}
          />
          <HiddenDocFields name="memo" doc={memoDoc} plain={memoPlain} />
        </Field>
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
  defaultTaxBps = 0,
  compact = false,
}: {
  orgSlug: string;
  invoiceId: string;
  defaultTaxBps?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className={
        compact
          ? "grid gap-2"
          : "grid gap-3 lane-panel p-4"
      }
      action={(formData) => {
        start(async () => {
          const result = await addInvoiceLineAction(orgSlug, invoiceId, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Line added");
          router.refresh();
        });
      }}
    >
      {!compact ? <p className="text-sm font-medium">Add line</p> : null}
      <Field label="Description" htmlFor="line_description">
        <Input id="line_description" name="description" required />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Qty" htmlFor="line_qty">
          <Input id="line_qty" name="quantity" type="number" step="0.001" defaultValue="1" />
        </Field>
        <Field label="Amount" htmlFor="line_amount">
          <Input id="line_amount" name="unit_amount" inputMode="decimal" required />
        </Field>
        <Field label="Tax bps" htmlFor="line_tax">
          <Input id="line_tax" name="tax_bps" type="number" defaultValue={defaultTaxBps} />
        </Field>
      </div>
      <Button type="submit" disabled={pending} variant="outline" className="w-full">
        {pending ? "Adding…" : "Add line"}
      </Button>
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (invoice.issuedAt || invoice.status !== "draft") return null;

  return (
    <div className="space-y-2">
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
                  router.refresh();
                }
              });
            }}
          />
        ) : (
          <div
            key={line.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{line.description}</p>
              <p className="text-[11px] text-muted-foreground">
                {line.quantity} ×{" "}
                {formatMoney({
                  amountMinor: line.unitAmountMinor,
                  currency: invoice.currency,
                })}
                {line.taxBps > 0 ? ` · ${line.taxBps} bps` : ""}
              </p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(line.id)}>
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await deleteInvoiceLineAction(orgSlug, invoice.id, line.id);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success("Line removed");
                    router.refresh();
                  }
                });
              }}
            >
              Delete
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
      <Input name="description" required defaultValue={line.description} />
      <div className="grid grid-cols-3 gap-2">
        <Input name="quantity" type="number" step="0.001" defaultValue={line.quantity} />
        <Input
          name="unit_amount"
          inputMode="decimal"
          defaultValue={fromMinor(line.unitAmountMinor, invoice.currency)}
        />
        <Input name="tax_bps" type="number" defaultValue={line.taxBps} />
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDouble, setConfirmDouble] = useState(false);
  const issued = Boolean(invoice.issuedAt);
  const isDraft = invoice.status === "draft" && !issued;

  if (!canWrite) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {isDraft ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const fd = new FormData();
              if (confirmDouble) fd.set("confirm_double", "1");
              const result = await issueInvoiceAction(orgSlug, invoice.id, fd);
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
          {confirmDouble ? "Issue anyway (double bill)" : pending ? "Issuing…" : "Issue"}
        </Button>
      ) : null}

      {issued && invoice.status !== "void" ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await sendInvoiceEmailAction(orgSlug, invoice.id);
              if (result.error) {
                // Fallback to mailto if SMTP fails or no contact email
                const subject = encodeURIComponent(`Invoice ${invoice.number}`);
                const body = encodeURIComponent(
                  `Please find invoice ${invoice.number}.\n${window.location.origin}/${orgSlug}/invoices/${invoice.id}/pdf`,
                );
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
                const marked = await markInvoiceSentAction(orgSlug, invoice.id);
                if (marked.error) toast.error(result.error);
                else toast.message(result.error);
                router.refresh();
                return;
              }
              toast.success(`Emailed ${result.to}`);
              router.refresh();
            });
          }}
        >
          Send email
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          window.open(`/${orgSlug}/invoices/${invoice.id}/pdf`, "_blank");
        }}
      >
        PDF
      </Button>

      {invoice.status !== "void" ? (
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await voidInvoiceAction(orgSlug, invoice.id);
              if (result.error) toast.error(result.error);
              else toast.success("Invoice voided");
              router.refresh();
            });
          }}
        >
          Void
        </Button>
      ) : null}
    </div>
  );
}

export function UpdateInvoiceForm({
  orgSlug,
  invoice,
  templates = [],
  compact = false,
}: {
  orgSlug: string;
  invoice: InvoiceRecord;
  templates?: InvoiceTemplate[];
  canWrite?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [termsDoc, setTermsDoc] = useState<JSONContent | null>(
    (invoice.termsDoc as JSONContent | null) ?? null,
  );
  const [termsPlain, setTermsPlain] = useState(invoice.terms ?? "");
  const [memoDoc, setMemoDoc] = useState<JSONContent | null>(
    (invoice.memoDoc as JSONContent | null) ?? null,
  );
  const [memoPlain, setMemoPlain] = useState(invoice.memo ?? "");

  if (invoice.issuedAt || invoice.status !== "draft") return null;

  return (
    <div className="grid gap-4">
      {templates.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">Template</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((template) => (
              <Button
                key={template.id}
                type="button"
                size="sm"
                variant={invoice.templateId === template.id ? "default" : "outline"}
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await applyInvoiceTemplateAction(
                      orgSlug,
                      invoice.id,
                      template.id,
                    );
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success(`Applied ${template.name}`);
                      router.refresh();
                    }
                  });
                }}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        className="grid gap-3"
        action={(formData) => {
          start(async () => {
            const result = await updateInvoiceAction(orgSlug, invoice.id, formData);
            if (result.error) toast.error(result.error);
            else {
              toast.success("Saved");
              router.refresh();
            }
          });
        }}
      >
        <Field label="Due on" htmlFor="due_on">
          <Input id="due_on" name="due_on" type="date" defaultValue={invoice.dueOn ?? ""} />
        </Field>
        {compact ? (
          <>
            <Field label="Terms" htmlFor="terms">
              <Textarea
                id="terms"
                name="terms"
                rows={3}
                defaultValue={invoice.terms ?? ""}
                className="resize-none"
              />
            </Field>
            <Field label="Memo" htmlFor="memo">
              <Textarea
                id="memo"
                name="memo"
                rows={3}
                defaultValue={invoice.memo ?? ""}
                className="resize-none"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Terms" htmlFor="terms">
              <RichEditor
                value={termsDoc}
                onChange={(doc, plain) => {
                  setTermsDoc(doc);
                  setTermsPlain(plain);
                }}
              />
              <HiddenDocFields name="terms" doc={termsDoc} plain={termsPlain} />
            </Field>
            <Field label="Memo" htmlFor="memo">
              <RichEditor
                value={memoDoc}
                onChange={(doc, plain) => {
                  setMemoDoc(doc);
                  setMemoPlain(plain);
                }}
              />
              <HiddenDocFields name="memo" doc={memoDoc} plain={memoPlain} />
            </Field>
          </>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          Save details
        </Button>
      </form>
    </div>
  );
}
