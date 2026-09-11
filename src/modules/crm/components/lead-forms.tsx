"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import {
  HiddenDocFields,
  RichEditor,
} from "@/components/editor/rich-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  convertLeadToClientAction,
  createLeadAction,
  updateLeadAction,
} from "@/modules/crm/actions";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadRecord,
} from "@/modules/crm/types";
import { formatMajorInput } from "@/shared/money";
import type { JSONContent } from "@tiptap/react";

export function CreateLeadDialog({
  orgSlug,
  defaultOpen = false,
  defaultCurrency = "USD",
}: {
  orgSlug: string;
  defaultOpen?: boolean;
  defaultCurrency?: "USD" | "INR";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notesDoc, setNotesDoc] = useState<JSONContent | null>(null);
  const [notesPlain, setNotesPlain] = useState("");

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    if (defaultOpen) router.replace(`/${orgSlug}/crm`);
  }

  return (
    <ActionSheet
      title="New lead"
      description="Track the deal before it becomes a client."
      triggerLabel="New lead"
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
            const result = await createLeadAction(orgSlug, formData);
            if (result.error) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            toast.success("Lead created");
            close();
            router.push(`/${orgSlug}/crm?lead=${result.id}`);
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor="name" required>
          <Input id="name" name="name" required placeholder="Deal or contact name" />
        </Field>
        <Field label="Company" htmlFor="company">
          <Input id="company" name="company" placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage" htmlFor="stage">
            <NativeSelect id="stage" name="stage" defaultValue="new">
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Currency" htmlFor="currency">
            <NativeSelect id="currency" name="currency" defaultValue={defaultCurrency}>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Estimated value" htmlFor="estimated_value">
          <Input id="estimated_value" name="estimated_value" inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Close on" htmlFor="close_on">
          <Input id="close_on" name="close_on" type="date" />
        </Field>
        <Field label="Contact" htmlFor="contact_name">
          <Input id="contact_name" name="contact_name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" />
          </Field>
        </div>
        <Field label="WhatsApp" htmlFor="whatsapp">
          <Input id="whatsapp" name="whatsapp" />
        </Field>
        <Field label="Source" htmlFor="source">
          <Input id="source" name="source" placeholder="Referral, Upwork…" />
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Comma-separated">
          <Input id="tags" name="tags" placeholder="retainer, design" />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <RichEditor
            value={notesDoc}
            onChange={(doc, plain) => {
              setNotesDoc(doc);
              setNotesPlain(plain);
            }}
            placeholder="Internal context…"
          />
          <HiddenDocFields name="notes" doc={notesDoc} plain={notesPlain} />
        </Field>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Create lead"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function LeadDetailSheet({
  orgSlug,
  lead,
  open,
  onOpenChange,
  canWrite,
}: {
  orgSlug: string;
  lead: LeadRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notesDoc, setNotesDoc] = useState<JSONContent | null>(
    (lead?.notesDoc as JSONContent | null) ?? null,
  );
  const [notesPlain, setNotesPlain] = useState(lead?.notes ?? "");

  useEffect(() => {
    setNotesDoc((lead?.notesDoc as JSONContent | null) ?? null);
    setNotesPlain(lead?.notes ?? "");
  }, [lead]);

  if (!lead) return null;

  return (
    <ActionSheet
      title={lead.name}
      description={lead.company ?? "Lead"}
      hideTrigger
      open={open}
      onOpenChange={onOpenChange}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          if (!canWrite) return;
          start(async () => {
            const result = await updateLeadAction(orgSlug, lead.id, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Lead updated");
            onOpenChange(false);
            router.replace(`/${orgSlug}/crm`);
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor="edit_name" required>
          <Input id="edit_name" name="name" required defaultValue={lead.name} disabled={!canWrite} />
        </Field>
        <Field label="Company" htmlFor="edit_company">
          <Input id="edit_company" name="company" defaultValue={lead.company ?? ""} disabled={!canWrite} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage" htmlFor="edit_stage">
            <NativeSelect
              id="edit_stage"
              name="stage"
              defaultValue={lead.stage}
              disabled={!canWrite}
            >
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Currency" htmlFor="edit_currency">
            <NativeSelect
              id="edit_currency"
              name="currency"
              defaultValue={lead.currency}
              disabled={!canWrite}
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Estimated value" htmlFor="edit_estimated_value">
          <Input
            id="edit_estimated_value"
            name="estimated_value"
            inputMode="decimal"
            defaultValue={
              lead.estimatedValueMinor != null
                ? formatMajorInput(lead.estimatedValueMinor, lead.currency)
                : ""
            }
            disabled={!canWrite}
          />
        </Field>
        <Field label="Close on" htmlFor="edit_close_on">
          <Input
            id="edit_close_on"
            name="close_on"
            type="date"
            defaultValue={lead.closeOn ?? ""}
            disabled={!canWrite}
          />
        </Field>
        <Field label="Contact" htmlFor="edit_contact_name">
          <Input
            id="edit_contact_name"
            name="contact_name"
            defaultValue={lead.contactName ?? ""}
            disabled={!canWrite}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" htmlFor="edit_email">
            <Input
              id="edit_email"
              name="email"
              type="email"
              defaultValue={lead.email ?? ""}
              disabled={!canWrite}
            />
          </Field>
          <Field label="Phone" htmlFor="edit_phone">
            <Input id="edit_phone" name="phone" defaultValue={lead.phone ?? ""} disabled={!canWrite} />
          </Field>
        </div>
        <Field label="WhatsApp" htmlFor="edit_whatsapp">
          <Input
            id="edit_whatsapp"
            name="whatsapp"
            defaultValue={lead.whatsapp ?? ""}
            disabled={!canWrite}
          />
        </Field>
        <Field label="Source" htmlFor="edit_source">
          <Input id="edit_source" name="source" defaultValue={lead.source ?? ""} disabled={!canWrite} />
        </Field>
        <Field label="Tags" htmlFor="edit_tags">
          <Input id="edit_tags" name="tags" defaultValue={lead.tags.join(", ")} disabled={!canWrite} />
        </Field>
        <Field label="Notes" htmlFor="edit_notes">
          {canWrite ? (
            <>
              <RichEditor
                value={notesDoc}
                onChange={(doc, plain) => {
                  setNotesDoc(doc);
                  setNotesPlain(plain);
                }}
              />
              <HiddenDocFields name="notes" doc={notesDoc} plain={notesPlain} />
            </>
          ) : (
            <Textarea value={lead.notes ?? ""} readOnly />
          )}
        </Field>
        {canWrite ? (
          <div className="flex flex-col gap-3">
            {!lead.clientId ? (
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {lead.stage === "won" ? "Won — become a client" : "Ready to convert?"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Creates the client, contact, and a project from this lead. Lands you in delivery.
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="mt-3 w-full"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const fd = new FormData();
                      fd.set("create_project", "1");
                      const result = await convertLeadToClientAction(orgSlug, lead.id, fd);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Became a client");
                      onOpenChange(false);
                      if (result.projectId) {
                        router.push(`/${orgSlug}/projects/${result.projectId}`);
                      } else {
                        router.push(
                          `/${orgSlug}/clients/${result.clientId}?new=project`,
                        );
                      }
                      router.refresh();
                    });
                  }}
                >
                  Become a client
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/${orgSlug}/clients/${lead.clientId}`)}
              >
                Open client
              </Button>
            )}
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </form>
    </ActionSheet>
  );
}
