"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { TypeToConfirmDialog, useTypeToConfirm } from "@/components/studio/type-to-confirm";
import {
  HiddenDocFields,
  RichEditor,
} from "@/components/editor/rich-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  convertLeadToClientAction,
  createLeadAction,
  deleteLeadAction,
  updateLeadAction,
} from "@/modules/crm/actions";
import { setCrmUrl } from "@/modules/crm/components/crm-url";
import {
  isWonStage,
  type LeadRecord,
  type LeadStageRecord,
} from "@/modules/crm/types";
import {
  listLeadFilesAction,
  softDeleteFileAction,
  uploadFileAction,
} from "@/modules/files/actions";
import { FileAttachmentPreview } from "@/modules/files/components/file-viewer";
import type { FileRecord } from "@/modules/files/queries";
import { formatMajorInput } from "@/shared/money";

function FormSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function AttachDropzone({
  disabled,
  busy,
  compact,
  onFiles,
}: {
  disabled?: boolean;
  busy?: boolean;
  /** Slimmer once files exist, so the list stays the focus. */
  compact?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        const dropped = Array.from(event.dataTransfer.files);
        if (dropped.length > 0) onFiles(dropped);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-center transition-colors",
        compact ? "px-4 py-3" : "px-4 py-7",
        dragging
          ? "border-primary/60 bg-primary/10"
          : "border-border/70 bg-muted/20 hover:border-border hover:bg-muted/40",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span className={cn("flex items-center gap-2 text-sm", dragging ? "text-foreground" : "text-muted-foreground")}>
        <UploadCloud className="size-4" />
        {busy ? (
          "Uploading…"
        ) : dragging ? (
          "Drop to attach"
        ) : (
          <span>
            Drop files or <span className="font-medium text-foreground">browse</span>
          </span>
        )}
      </span>
      {compact ? null : (
        <span className="text-xs text-muted-foreground/80">
          Proposals, briefs, screenshots. Up to 12 MB each.
        </span>
      )}
      <input
        type="file"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (picked.length > 0) onFiles(picked);
        }}
      />
    </label>
  );
}

async function uploadLeadFiles(orgSlug: string, leadId: string, files: File[]) {
  let failed = 0;
  for (const file of files) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("entity_type", "lead");
    fd.set("entity_id", leadId);
    const result = await uploadFileAction(orgSlug, fd);
    if (result.error) {
      failed += 1;
      toast.error(`${file.name}: ${result.error}`);
    }
  }
  return files.length - failed;
}

/** Live attachments for a saved lead. */
function LeadAttachments({
  orgSlug,
  leadId,
  canWrite,
}: {
  orgSlug: string;
  leadId: string;
  canWrite: boolean;
}) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void listLeadFilesAction(orgSlug, leadId)
      .then((rows) => {
        if (!cancelled) setFiles(rows);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, leadId]);

  return (
    <FormSection title="Attachments">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : files.length === 0 && !canWrite ? (
        <p className="text-sm text-muted-foreground">No attachments.</p>
      ) : files.length === 0 ? null : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <FileAttachmentPreview
              key={file.id}
              file={file}
              trailing={
                canWrite ? (
                  <button
                    type="button"
                    className="rounded-lg bg-card/90 p-1.5 text-muted-foreground shadow-sm ring-1 ring-foreground/8 hover:bg-card hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => {
                      start(async () => {
                        const result = await softDeleteFileAction(orgSlug, file.id);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        setFiles((prev) => prev.filter((row) => row.id !== file.id));
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null
              }
            />
          ))}
        </ul>
      )}
      {canWrite && !loading ? (
        <AttachDropzone
          disabled={pending}
          busy={pending}
          compact={files.length > 0}
          onFiles={(picked) => {
            start(async () => {
              const uploaded = await uploadLeadFiles(orgSlug, leadId, picked);
              if (uploaded > 0) {
                toast.success(uploaded === 1 ? "File attached" : `${uploaded} files attached`);
              }
              setFiles(await listLeadFilesAction(orgSlug, leadId));
            });
          }}
        />
      ) : null}
    </FormSection>
  );
}

/** Files picked before the lead exists; uploaded right after create. */
function QueuedAttachments({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <FormSection title="Attachments">
      {files.length === 0 ? null : (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm ring-1 ring-foreground/6"
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <AttachDropzone
        compact={files.length > 0}
        onFiles={(picked) => onChange([...files, ...picked])}
      />
    </FormSection>
  );
}

function LeadFormFields({
  orgSlug,
  idPrefix,
  lead,
  stages,
  defaultCurrency,
  showMoney,
  disabled,
  attachments,
  aside,
}: {
  orgSlug: string;
  idPrefix: string;
  lead?: LeadRecord;
  stages: LeadStageRecord[];
  defaultCurrency: "USD" | "INR";
  showMoney: boolean;
  disabled?: boolean;
  attachments: ReactNode;
  aside?: ReactNode;
}) {
  const [notesDoc, setNotesDoc] = useState<JSONContent | null>(
    (lead?.notesDoc as JSONContent | null) ?? null,
  );
  const [notesPlain, setNotesPlain] = useState(lead?.notes ?? "");
  const id = (name: string) => `${idPrefix}_${name}`;

  const currency = lead?.currency ?? defaultCurrency;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12">
      <div className="min-w-0 space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor={id("name")} required>
            <Input
              id={id("name")}
              name="name"
              required
              placeholder="Deal or contact name"
              defaultValue={lead?.name ?? ""}
              disabled={disabled}
            />
          </Field>
          <Field label="Company" htmlFor={id("company")}>
            <Input
              id={id("company")}
              name="company"
              defaultValue={lead?.company ?? ""}
              disabled={disabled}
            />
          </Field>
          <Field label="Stage" htmlFor={id("stage")}>
            <NativeSelect
              id={id("stage")}
              name="stage"
              defaultValue={lead?.stage ?? stages[0]?.slug ?? "new"}
              disabled={disabled}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.slug}>
                  {stage.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Expected close" htmlFor={id("close_on")}>
            <Input
              id={id("close_on")}
              name="close_on"
              type="date"
              defaultValue={lead?.closeOn ?? ""}
              disabled={disabled}
            />
          </Field>
          {showMoney ? (
            <Field label="Estimated value" htmlFor={id("estimated_value")} className="sm:col-span-2">
              <div className="flex gap-2">
                <NativeSelect
                  aria-label="Currency"
                  name="currency"
                  defaultValue={currency}
                  disabled={disabled}
                  className="w-24 shrink-0"
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </NativeSelect>
                <Input
                  id={id("estimated_value")}
                  name="estimated_value"
                  inputMode="decimal"
                  placeholder="0.00"
                  defaultValue={
                    lead?.estimatedValueMinor != null
                      ? formatMajorInput(lead.estimatedValueMinor, lead.currency)
                      : ""
                  }
                  disabled={disabled}
                  className="min-w-0 flex-1"
                />
              </div>
            </Field>
          ) : (
            <input type="hidden" name="currency" value={currency} />
          )}
        </div>

        <FormSection title="Notes">
          {disabled ? (
            <Textarea value={lead?.notes ?? ""} readOnly />
          ) : (
            <>
              <RichEditor
                value={notesDoc}
                onChange={(doc, plain) => {
                  setNotesDoc(doc);
                  setNotesPlain(plain);
                }}
                placeholder="Call notes, context, next steps… Type @ to tag."
                minHeightClassName="min-h-40"
                orgSlug={orgSlug}
              />
              <HiddenDocFields name="notes" doc={notesDoc} plain={notesPlain} />
            </>
          )}
        </FormSection>

        {attachments}
      </div>

      <aside className="relative min-w-0 space-y-8 lg:before:pointer-events-none lg:before:absolute lg:before:top-1 lg:before:-left-6 lg:before:h-1/2 lg:before:w-px lg:before:bg-linear-to-b lg:before:from-border lg:before:via-border/60 lg:before:to-transparent lg:before:content-['']">
        <FormSection title="Contact">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Person" htmlFor={id("contact_name")}>
              <Input
                id={id("contact_name")}
                name="contact_name"
                defaultValue={lead?.contactName ?? ""}
                disabled={disabled}
              />
            </Field>
            <Field label="Email" htmlFor={id("email")}>
              <Input
                id={id("email")}
                name="email"
                type="email"
                defaultValue={lead?.email ?? ""}
                disabled={disabled}
              />
            </Field>
            <Field label="Phone" htmlFor={id("phone")}>
              <Input
                id={id("phone")}
                name="phone"
                type="tel"
                defaultValue={lead?.phone ?? ""}
                disabled={disabled}
              />
            </Field>
            <Field label="WhatsApp" htmlFor={id("whatsapp")}>
              <Input
                id={id("whatsapp")}
                name="whatsapp"
                type="tel"
                defaultValue={lead?.whatsapp ?? ""}
                disabled={disabled}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Source">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Came from" htmlFor={id("source")}>
              <Input
                id={id("source")}
                name="source"
                placeholder="Referral, Upwork…"
                defaultValue={lead?.source ?? ""}
                disabled={disabled}
              />
            </Field>
            <Field label="Tags" htmlFor={id("tags")}>
              <Input
                id={id("tags")}
                name="tags"
                placeholder="retainer, design"
                defaultValue={lead?.tags.join(", ") ?? ""}
                disabled={disabled}
              />
            </Field>
          </div>
        </FormSection>

        {aside}
      </aside>
    </div>
  );
}

export function CreateLeadDialog({
  orgSlug,
  stages,
  defaultOpen = false,
  defaultCurrency = "USD",
  showMoney = true,
}: {
  orgSlug: string;
  stages: LeadStageRecord[];
  defaultOpen?: boolean;
  defaultCurrency?: "USD" | "INR";
  showMoney?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [formKey, setFormKey] = useState(0);
  const [queued, setQueued] = useState<File[]>([]);
  const [pending, start] = useTransition();
  const [syncedDefaultOpen, setSyncedDefaultOpen] = useState(defaultOpen);
  if (syncedDefaultOpen !== defaultOpen) {
    setSyncedDefaultOpen(defaultOpen);
    setOpen(defaultOpen);
  }

  function close() {
    setOpen(false);
    if (defaultOpen) setCrmUrl({ new: null });
  }

  return (
    <ActionSheet
      title="New lead"
      description="Track the deal before it becomes a client."
      triggerLabel="New lead"
      width="wide"
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="create-lead-form" disabled={pending}>
            {pending ? "Saving…" : "Create lead"}
          </Button>
        </div>
      }
    >
      <form
        id="create-lead-form"
        key={formKey}
        action={(formData) => {
          start(async () => {
            const result = await createLeadAction(orgSlug, formData);
            if (result.error || !result.id) {
              toast.error(result.error ?? "Could not create lead");
              return;
            }
            if (queued.length > 0) await uploadLeadFiles(orgSlug, result.id, queued);
            toast.success("Lead created");
            setQueued([]);
            setFormKey((key) => key + 1);
            setOpen(false);
            setCrmUrl({ new: null, lead: result.id });
            router.refresh();
          });
        }}
      >
        <LeadFormFields
          orgSlug={orgSlug}
          idPrefix="new_lead"
          stages={stages}
          defaultCurrency={defaultCurrency}
          showMoney={showMoney}
          attachments={<QueuedAttachments files={queued} onChange={setQueued} />}
        />
      </form>
    </ActionSheet>
  );
}

export function LeadDetailSheet({
  orgSlug,
  lead,
  stages,
  open,
  onOpenChange,
  canWrite,
  canDelete = false,
  showMoney = true,
}: {
  orgSlug: string;
  lead: LeadRecord | null;
  stages: LeadStageRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  canDelete?: boolean;
  showMoney?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const confirmDelete = useTypeToConfirm();

  if (!lead) return null;

  const won = isWonStage(lead.stage, stages);
  const formId = `edit-lead-${lead.id}`;

  const convertCard = !canWrite ? null : !lead.clientId ? (
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">{won ? "Deal won" : "Ready to convert?"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Creates the client and a project from this lead.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full"
        variant={won ? "default" : "outline"}
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
            router.push(
              result.projectId
                ? `/${orgSlug}/projects/${result.projectId}`
                : `/${orgSlug}/clients/${result.clientId}?new=project`,
            );
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
      className="w-full"
      onClick={() => router.push(`/${orgSlug}/clients/${lead.clientId}`)}
    >
      Open client
    </Button>
  );

  return (
    <ActionSheet
      title={lead.name}
      description={lead.company ?? "Lead"}
      hideTrigger
      width="wide"
      open={open}
      onOpenChange={onOpenChange}
      footer={
        canWrite ? (
          <div className="flex items-center gap-2">
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={confirmDelete.open}
                disabled={pending}
              >
                <Trash2 />
                Delete
              </Button>
            ) : null}
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <TypeToConfirmDialog
              {...confirmDelete.dialogProps}
              title={`Delete ${lead.name}?`}
              description="This permanently deletes the lead, its notes, and attachments. A client already created from it is kept. This can’t be undone."
              confirmValue={lead.name}
              actionLabel="Delete this lead"
              onConfirm={() => deleteLeadAction(orgSlug, lead.id, lead.name)}
              onDone={() => {
                toast.success(`Deleted ${lead.name}`);
                onOpenChange(false);
                router.refresh();
              }}
            />
          </div>
        ) : undefined
      }
    >
      <form
        id={formId}
        key={`${lead.id}:${lead.updatedAt}`}
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
            router.refresh();
          });
        }}
      >
        <LeadFormFields
          orgSlug={orgSlug}
          idPrefix={`lead_${lead.id.slice(0, 8)}`}
          lead={lead}
          stages={stages}
          defaultCurrency={lead.currency}
          showMoney={showMoney}
          disabled={!canWrite}
          attachments={
            <LeadAttachments
              key={lead.id}
              orgSlug={orgSlug}
              leadId={lead.id}
              canWrite={canWrite}
            />
          }
          aside={convertCard}
        />
      </form>
    </ActionSheet>
  );
}
