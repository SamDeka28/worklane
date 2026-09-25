"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { SoftDocField } from "@/components/editor/soft-doc-field";
import { ActionSheet } from "@/components/studio/action-sheet";
import { DangerZone } from "@/components/studio/type-to-confirm";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  addContactAction,
  archiveClientAction,
  createClientAction,
  deleteClientAction,
  updateClientAction,
  updateClientBillingAction,
} from "@/modules/clients/actions";
import { ExtraFieldsEditor } from "@/modules/invoices/components/extra-fields-editor";
import type { InvoiceBillTo } from "@/modules/invoices/types";

export function CreateClientDialog({
  orgSlug,
  defaultOpen = false,
  hideTrigger = false,
  returnHref,
}: {
  orgSlug: string;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    if (defaultOpen) {
      router.replace(returnHref ?? `/${orgSlug}/clients`);
    }
  }

  return (
    <ActionSheet
      title="New client"
      description="One record. Contacts attach here."
      triggerLabel="New client"
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
            const result = await createClientAction(orgSlug, formData);
            if (result.error) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            toast.success("Client created");
            close();
            router.push(`/${orgSlug}/clients/${result.id}`);
            router.refresh();
          });
        }}
      >
        <Field label="Kind" htmlFor="kind">
          <NativeSelect id="kind" name="kind" defaultValue="company">
            <option value="company">Company</option>
            <option value="person">Person</option>
          </NativeSelect>
        </Field>
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required placeholder="Latisha, RNPL…" />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <NativeSelect id="currency" name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </NativeSelect>
        </Field>
        <SoftDocField
          label="Internal notes"
          name="notes"
          orgSlug={orgSlug}
          placeholder="Private, never shown on the portal"
        />
        <p className="text-xs text-muted-foreground">Primary contact (optional)</p>
        <Field label="Contact name" htmlFor="contact_name">
          <Input id="contact_name" name="contact_name" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp">
            <Input id="whatsapp" name="whatsapp" />
          </Field>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Create client"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function EditClientForm({
  orgSlug,
  clientId,
  name,
  kind,
  notes,
  notesDoc,
}: {
  orgSlug: string;
  clientId: string;
  name: string;
  kind: string;
  notes: string | null;
  notesDoc?: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      action={(formData) => {
        start(async () => {
          const result = await updateClientAction(orgSlug, clientId, formData);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
            return;
          }
          toast.success("Saved");
          router.refresh();
        });
      }}
    >
      <Field label="Kind" htmlFor="kind">
        <NativeSelect id="kind" name="kind" defaultValue={kind}>
          <option value="company">Company</option>
          <option value="person">Person</option>
        </NativeSelect>
      </Field>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={name} />
      </Field>
      <SoftDocField
        label="Internal notes"
        name="notes"
        orgSlug={orgSlug}
        initialDoc={notesDoc}
        initialPlain={notes}
        placeholder="Private, never shown on the portal"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function AddContactForm({ orgSlug, clientId }: { orgSlug: string; clientId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-end gap-2"
      action={(formData) => {
        start(async () => {
          const result = await addContactAction(orgSlug, clientId, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Contact added");
          formRef.current?.reset();
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-36 flex-1 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Name</span>
        <Input name="contact_name" />
      </label>
      <label className="flex min-w-36 flex-1 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Email</span>
        <Input name="email" type="email" />
      </label>
      <label className="flex w-32 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Phone</span>
        <Input name="phone" />
      </label>
      <label className="flex w-32 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">WhatsApp</span>
        <Input name="whatsapp" />
      </label>
      <label className="flex h-8 items-center gap-2 text-sm">
        <input type="checkbox" name="is_primary" className="size-4 rounded border-input" />
        Primary
      </label>
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

export function ClientOverflow({
  orgSlug,
  clientId,
  onEditProfile,
  onNewProject,
  onNewCharge,
}: {
  orgSlug: string;
  clientId: string;
  onEditProfile?: () => void;
  onNewProject?: () => void;
  onNewCharge?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="More" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEditProfile ? (
          <DropdownMenuItem onClick={onEditProfile}>Edit profile</DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => router.push(`/${orgSlug}/clients/${clientId}?edit=1`)}
          >
            Edit profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            onNewProject
              ? onNewProject()
              : router.push(`/${orgSlug}/clients/${clientId}?new=project`)
          }
        >
          New project
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            onNewCharge
              ? onNewCharge()
              : router.push(`/${orgSlug}/clients/${clientId}?new=charge`)
          }
        >
          New charge
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Archive this client? It leaves the active list.")) return;
            start(async () => {
              const result = await archiveClientAction(orgSlug, clientId);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Archived");
              router.push(`/${orgSlug}/clients`);
              router.refresh();
            });
          }}
        >
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EditClientSheet({
  orgSlug,
  clientId,
  name,
  kind,
  notes,
  notesDoc,
  open,
  onOpenChange,
  canDelete = false,
}: {
  orgSlug: string;
  clientId: string;
  name: string;
  kind: string;
  notes: string | null;
  notesDoc?: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete?: boolean;
}) {
  const router = useRouter();
  return (
    <ActionSheet
      title="Edit profile"
      description="Name, kind, and internal notes."
      hideTrigger
      open={open}
      onOpenChange={onOpenChange}
    >
      <EditClientForm
        orgSlug={orgSlug}
        clientId={clientId}
        name={name}
        kind={kind}
        notes={notes}
        notesDoc={notesDoc}
      />
      {canDelete ? (
        <DangerZone
          className="mt-8"
          heading="Delete client"
          summary="Only possible when the client has no projects, charges, invoices, or payments."
          buttonLabel="Delete client"
          title={`Delete ${name}?`}
          description="This permanently deletes the client and its contacts. Leads and documents linked to it are kept but unlinked. This can’t be undone."
          confirmValue={name}
          actionLabel="Delete this client"
          onConfirm={() => deleteClientAction(orgSlug, clientId, name)}
          onDone={() => {
            toast.success(`Deleted ${name}`);
            onOpenChange(false);
            router.replace(`/${orgSlug}/clients`);
            router.refresh();
          }}
        />
      ) : null}
    </ActionSheet>
  );
}

export function AddContactSheet({
  orgSlug,
  clientId,
  open,
  onOpenChange,
  defaultOpen = false,
}: {
  orgSlug: string;
  clientId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  useEffect(() => {
    if (!controlled) setInternalOpen(defaultOpen);
  }, [defaultOpen, controlled]);

  return (
    <ActionSheet
      title="Add contact"
      description="Who you reach for this client."
      triggerLabel="Add contact"
      triggerVariant="outline"
      hideTrigger={controlled}
      open={isOpen}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await addContactAction(orgSlug, clientId, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Contact added");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor="sheet_contact_name">
          <Input id="sheet_contact_name" name="contact_name" />
        </Field>
        <Field label="Email" htmlFor="sheet_email">
          <Input id="sheet_email" name="email" type="email" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" htmlFor="sheet_phone">
            <Input id="sheet_phone" name="phone" />
          </Field>
          <Field label="WhatsApp" htmlFor="sheet_whatsapp">
            <Input id="sheet_whatsapp" name="whatsapp" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_primary" className="size-4 rounded border-input" />
          Primary
        </label>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Adding…" : "Add contact"}
        </Button>
      </form>
    </ActionSheet>
  );
}

const BILLING_FIELD_SUGGESTIONS = ["Place of supply", "Vendor code", "PAN", "Cost center"];

/** Edits the client's saved billing profile, which pre-fills "Billed to" on new invoices. */
export function EditClientBillingSheet({
  orgSlug,
  clientId,
  initial,
  hasSaved,
}: {
  orgSlug: string;
  clientId: string;
  initial: InvoiceBillTo;
  hasSaved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <ActionSheet
      title="Billing details"
      description="Used as the Billed to block on new invoices for this client. Existing invoices keep what they were issued with."
      triggerLabel={hasSaved ? "Edit" : "Add"}
      triggerVariant="ghost"
      triggerSize="sm"
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await updateClientBillingAction(orgSlug, clientId, formData);
            if ("error" in result && result.error) {
              toast.error(result.error);
              return;
            }
            const drafts = ("draftsUpdated" in result ? result.draftsUpdated : 0) ?? 0;
            toast.success(
              drafts > 0
                ? `Billing details saved and applied to ${drafts} draft invoice${drafts === 1 ? "" : "s"}`
                : "Billing details saved",
            );
            setOpen(false);
          });
        }}
      >
        <Field label="Company or legal name" htmlFor="client_bill_name">
          <Input id="client_bill_name" name="bill_to_name" defaultValue={initial.name} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Attention" htmlFor="client_bill_contact">
            <Input
              id="client_bill_contact"
              name="bill_to_contact"
              defaultValue={initial.contactName}
              placeholder="Accounts payable"
            />
          </Field>
          <Field label="Tax ID" htmlFor="client_bill_tax">
            <Input
              id="client_bill_tax"
              name="bill_to_tax_id"
              defaultValue={initial.taxId}
              placeholder="GSTIN, VAT, EIN…"
            />
          </Field>
          <Field label="Billing email" htmlFor="client_bill_email">
            <Input
              id="client_bill_email"
              name="bill_to_email"
              type="email"
              defaultValue={initial.email}
            />
          </Field>
          <Field label="Phone" htmlFor="client_bill_phone">
            <Input id="client_bill_phone" name="bill_to_phone" defaultValue={initial.phone} />
          </Field>
        </div>
        <Field label="Billing address" htmlFor="client_bill_address">
          <Textarea
            id="client_bill_address"
            name="bill_to_address"
            rows={3}
            defaultValue={initial.address}
          />
        </Field>
        <div className="grid gap-1.5">
          <p className="text-sm font-semibold tracking-tight">Other details</p>
          <p className="text-xs text-muted-foreground/80">
            Printed under the address, e.g. PAN or vendor code.
          </p>
          <ExtraFieldsEditor
            prefix="bill_to_extra"
            initial={initial.extras}
            suggestions={BILLING_FIELD_SUGGESTIONS}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save billing details"}
        </Button>
      </form>
    </ActionSheet>
  );
}
