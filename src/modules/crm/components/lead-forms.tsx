"use client";

import { useEffect, useState, useTransition, type FocusEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActivityPanel, ActivityToggle } from "@/modules/history/components/activity-view";
import {
  AlertTriangle,
  Building2,
  FileText,
  LayoutGrid,
  MessageSquareText,
  NotebookPen,
  PartyPopper,
  Paperclip,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { ActionSheet } from "@/components/studio/action-sheet";
import { AvatarMark } from "@/components/studio/avatar-mark";
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
import { formatDay } from "@/modules/finance/presentation";
import {
  createLeadAction,
  deleteLeadAction,
  updateLeadAction,
} from "@/modules/crm/actions";
import { openLead, setCrmUrl } from "@/modules/crm/components/crm-url";
import { SheetTabs, tabPanelProps } from "@/components/studio/sheet-tabs";
import { shareRequest } from "@/lib/share-request";
import { LeadDocuments } from "@/modules/crm/components/lead-documents";
import { LeadEmailButton } from "@/modules/crm/components/lead-email-composer";
import type { LeadEmailSender } from "@/modules/crm/queries";
import { LeadNextStep, NextStepFields } from "@/modules/crm/components/lead-next-step";
import { ConvertLeadDialog } from "@/modules/crm/components/lead-outcome-dialogs";
import { LeadTimeline } from "@/modules/crm/components/lead-timeline";
import {
  assignLeadOwnerAction,
  findLeadDuplicatesAction,
  type DuplicateMatches,
} from "@/modules/crm/follow-actions";
import type { CrmSettings } from "@/modules/crm/settings";
import {
  isLostStage,
  isWonStage,
  type CrmMember,
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

export type LeadTab = "overview" | "timeline" | "notes" | "proposals";

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
    void shareRequest(`lead-files:${orgSlug}:${leadId}`, () => listLeadFilesAction(orgSlug, leadId))
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

function DuplicateHint({
  orgSlug,
  query,
  excludeLeadId,
  linkedClientId,
  onUseClient,
}: {
  orgSlug: string;
  query: { name: string; company: string; email: string; phone: string };
  excludeLeadId?: string;
  linkedClientId: string | null;
  onUseClient: (client: { id: string; name: string }) => void;
}) {
  const [matches, setMatches] = useState<DuplicateMatches | null>(null);
  const key = [query.name, query.company, query.email, query.phone].join("|");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void findLeadDuplicatesAction(orgSlug, { ...query, excludeLeadId }).then((result) => {
        if (!cancelled) setMatches(result);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, key, excludeLeadId]);

  if (!matches || (matches.leads.length === 0 && matches.clients.length === 0)) return null;

  return (
    <div className="rounded-2xl bg-amber-500/10 p-3.5 ring-1 ring-amber-500/25">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
        <AlertTriangle className="size-4" />
        This might already exist
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm">
        {matches.clients.map((client) => (
          <li key={client.id} className="flex flex-wrap items-center gap-2">
            <Building2 className="size-3.5 text-muted-foreground" />
            <Link
              href={`/${orgSlug}/clients/${client.id}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {client.name}
            </Link>
            <span className="text-xs text-muted-foreground">Client · {client.why}</span>
            {linkedClientId === client.id ? (
              <span className="ml-auto text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Linked as a deal
              </span>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="ml-auto"
                onClick={() => onUseClient(client)}
              >
                New deal for this client
              </Button>
            )}
          </li>
        ))}
        {matches.leads.map((match) => (
          <li key={match.id} className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-3.5 text-muted-foreground" />
            <button
              type="button"
              className="font-medium underline-offset-2 hover:underline"
              onClick={() => openLead(match.id)}
            >
              {match.name}
            </button>
            <span className="text-xs text-muted-foreground">
              Lead{match.company ? ` · ${match.company}` : ""} · {match.why}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OwnerPicker({
  orgSlug,
  lead,
  members,
  canWrite,
}: {
  orgSlug: string;
  lead: LeadRecord;
  members: CrmMember[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const owner = members.find((member) => member.userId === lead.ownerUserId);

  return (
    <FormSection title="Owner">
      <div className="flex items-center gap-2.5">
        {owner ? (
          <AvatarMark name={owner.name} src={owner.avatarUrl} size="sm" />
        ) : (
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-border text-[11px] text-muted-foreground">
            ?
          </span>
        )}
        <NativeSelect
          aria-label="Owner"
          value={lead.ownerUserId ?? ""}
          disabled={!canWrite || pending}
          onChange={(event) => {
            const next = event.target.value || null;
            start(async () => {
              const result = await assignLeadOwnerAction(orgSlug, lead.id, next);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(next ? "Owner updated" : "Owner removed");
              router.refresh();
            });
          }}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
          {lead.ownerUserId && !owner ? (
            <option value={lead.ownerUserId}>Former teammate</option>
          ) : null}
        </NativeSelect>
      </div>
    </FormSection>
  );
}

function LeadFormFields({
  orgSlug,
  idPrefix,
  lead,
  stages,
  defaultStage,
  defaultCurrency,
  showMoney,
  disabled,
  settings,
  members,
  currentUserId,
  prefillClient,
  leading,
  afterFields,
  attachments,
  aside,
  tab,
  tabIdPrefix = "lead",
  proposals,
}: {
  orgSlug: string;
  idPrefix: string;
  lead?: LeadRecord;
  stages: LeadStageRecord[];
  defaultStage?: string;
  defaultCurrency: "USD" | "INR";
  showMoney: boolean;
  disabled?: boolean;
  settings: CrmSettings;
  members: CrmMember[];
  currentUserId: string;
  prefillClient?: { id: string; name: string } | null;
  leading?: ReactNode;
  afterFields?: ReactNode;
  attachments: ReactNode;
  aside?: ReactNode;
  /** Splits a saved lead into tabs. Every panel stays mounted so the form submits all fields. */
  tab?: LeadTab;
  tabIdPrefix?: string;
  proposals?: ReactNode;
}) {
  const creating = !lead;
  const [notesDoc, setNotesDoc] = useState<JSONContent | null>(
    (lead?.notesDoc as JSONContent | null) ?? null,
  );
  const [notesPlain, setNotesPlain] = useState(lead?.notes ?? "");
  const [stage, setStage] = useState(lead?.stage ?? defaultStage ?? stages[0]?.slug ?? "new");
  const [dupQuery, setDupQuery] = useState({
    name: "",
    company: prefillClient?.name ?? "",
    email: "",
    phone: "",
  });
  const [linkedClient, setLinkedClient] = useState<{ id: string; name: string } | null>(
    prefillClient ?? null,
  );
  const id = (name: string) => `${idPrefix}_${name}`;
  const lost = isLostStage(stage, stages);
  const sourceListId = id("sources");

  const currency = lead?.currency ?? defaultCurrency;
  const trackDup = (key: keyof typeof dupQuery) =>
    creating
      ? (event: FocusEvent<HTMLInputElement>) => {
          const value = event.currentTarget.value.trim();
          setDupQuery((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
        }
      : undefined;

  const mainFields = (
    <>
      {creating && linkedClient ? (
        <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3.5 py-2.5 text-sm">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            New deal for <span className="font-semibold">{linkedClient.name}</span>
          </span>
          <button
            type="button"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => setLinkedClient(null)}
          >
            Unlink
          </button>
          <input type="hidden" name="client_id" value={linkedClient.id} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={id("name")} required>
          <Input
            id={id("name")}
            name="name"
            required
            placeholder="Deal or contact name"
            defaultValue={lead?.name ?? ""}
            disabled={disabled}
            onBlur={trackDup("name")}
          />
        </Field>
        <Field label="Company" htmlFor={id("company")}>
          <Input
            id={id("company")}
            name="company"
            defaultValue={lead?.company ?? prefillClient?.name ?? ""}
            disabled={disabled}
            onBlur={trackDup("company")}
          />
        </Field>
        <Field label="Stage" htmlFor={id("stage")}>
          <NativeSelect
            id={id("stage")}
            name="stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            disabled={disabled}
          >
            {stages.map((row) => (
              <option key={row.id} value={row.slug}>
                {row.name}
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
        {lost ? (
          <>
            <Field label="Why was it lost?" htmlFor={id("lost_reason")} required>
              <NativeSelect
                id={id("lost_reason")}
                name="lost_reason"
                defaultValue={lead?.lostReason ?? ""}
                required
                disabled={disabled}
              >
                <option value="" disabled>
                  Pick a reason
                </option>
                {[
                  ...settings.lostReasons,
                  ...(lead?.lostReason && !settings.lostReasons.includes(lead.lostReason)
                    ? [lead.lostReason]
                    : []),
                ].map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Loss note" htmlFor={id("lost_note")}>
              <Input
                id={id("lost_note")}
                name="lost_note"
                defaultValue={lead?.lostNote ?? ""}
                placeholder="Optional"
                disabled={disabled}
              />
            </Field>
          </>
        ) : null}
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

      {creating ? (
        <DuplicateHint
          orgSlug={orgSlug}
          query={dupQuery}
          linkedClientId={linkedClient?.id ?? null}
          onUseClient={setLinkedClient}
        />
      ) : null}

      {creating && !isWonStage(stage, stages) && !lost ? (
        <FormSection title="Next step">
          <NextStepFields idPrefix={idPrefix} />
        </FormSection>
      ) : null}
    </>
  );

  const notesSection = (
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
            placeholder="Background, requirements, who decides… Type @ to tag."
            minHeightClassName="min-h-32"
            orgSlug={orgSlug}
          />
          <HiddenDocFields name="notes" doc={notesDoc} plain={notesPlain} />
        </>
      )}
    </FormSection>
  );

  const asideContent = (
    <>
      {creating ? (
        <FormSection title="Owner">
          <NativeSelect
            aria-label="Owner"
            name="owner_user_id"
            defaultValue={currentUserId}
          >
            <option value="none">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === currentUserId ? `${member.name} (you)` : member.name}
              </option>
            ))}
          </NativeSelect>
        </FormSection>
      ) : null}

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
              onBlur={trackDup("email")}
            />
          </Field>
          <Field label="Phone" htmlFor={id("phone")}>
            <Input
              id={id("phone")}
              name="phone"
              type="tel"
              defaultValue={lead?.phone ?? ""}
              disabled={disabled}
              onBlur={trackDup("phone")}
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
              list={sourceListId}
              placeholder="Referral, LinkedIn…"
              defaultValue={lead?.source ?? ""}
              disabled={disabled}
              autoComplete="off"
            />
            <datalist id={sourceListId}>
              {settings.sources.map((source) => (
                <option key={source} value={source} />
              ))}
            </datalist>
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
    </>
  );

  const columns = (main: ReactNode) => (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12">
      <div className="min-w-0 space-y-8">{main}</div>
      <aside className="relative min-w-0 space-y-8 lg:before:pointer-events-none lg:before:absolute lg:before:top-1 lg:before:-left-6 lg:before:h-1/2 lg:before:w-px lg:before:bg-linear-to-b lg:before:from-border lg:before:via-border/60 lg:before:to-transparent lg:before:content-['']">
        {asideContent}
      </aside>
    </div>
  );

  if (!tab) {
    return columns(
      <>
        {leading}
        {mainFields}
        {afterFields}
        {notesSection}
        {attachments}
      </>,
    );
  }

  return (
    <>
      <div {...tabPanelProps(tabIdPrefix, "overview", tab === "overview")}>
        {columns(
          <>
            {leading}
            {mainFields}
          </>,
        )}
      </div>
      <div {...tabPanelProps(tabIdPrefix, "timeline", tab === "timeline")} className="max-w-3xl">
        {afterFields}
      </div>
      <div {...tabPanelProps(tabIdPrefix, "notes", tab === "notes")} className="max-w-3xl space-y-8">
        {notesSection}
        {attachments}
      </div>
      <div {...tabPanelProps(tabIdPrefix, "proposals", tab === "proposals")} className="max-w-3xl">
        {proposals}
      </div>
    </>
  );
}

export function CreateLeadDialog({
  orgSlug,
  stages,
  defaultCurrency = "USD",
  showMoney = true,
  settings,
  members,
  currentUserId,
  prefillClient,
}: {
  orgSlug: string;
  stages: LeadStageRecord[];
  defaultCurrency?: "USD" | "INR";
  showMoney?: boolean;
  settings: CrmSettings;
  members: CrmMember[];
  currentUserId: string;
  /** From `?client=`: open as a new deal for this existing client. */
  prefillClient?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("new") === "1";
  const requestedStage = searchParams.get("stage");
  const defaultStage =
    requestedStage && stages.some((stage) => stage.slug === requestedStage)
      ? requestedStage
      : undefined;
  const [open, setOpen] = useState(requested);
  const [formKey, setFormKey] = useState(0);
  const [queued, setQueued] = useState<File[]>([]);
  const [pending, start] = useTransition();
  const [syncedRequested, setSyncedRequested] = useState(requested);
  if (syncedRequested !== requested) {
    setSyncedRequested(requested);
    setOpen(requested);
  }

  function close() {
    setOpen(false);
    setCrmUrl({ new: null, stage: null, client: null });
  }

  return (
    <ActionSheet
      title={prefillClient ? `New deal for ${prefillClient.name}` : "New lead"}
      description="Track the deal before it becomes a client."
      triggerLabel="New lead"
      triggerIcon={<Sparkles />}
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
        key={`${formKey}:${defaultStage ?? ""}:${prefillClient?.id ?? ""}`}
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
            setCrmUrl({ new: null, stage: null, client: null, lead: result.id });
            router.refresh();
          });
        }}
      >
        <LeadFormFields
          orgSlug={orgSlug}
          idPrefix="new_lead"
          stages={stages}
          defaultStage={defaultStage}
          defaultCurrency={defaultCurrency}
          showMoney={showMoney}
          settings={settings}
          members={members}
          currentUserId={currentUserId}
          prefillClient={prefillClient}
          attachments={<QueuedAttachments files={queued} onChange={setQueued} />}
        />
      </form>
    </ActionSheet>
  );
}

function OutcomeBanner({
  lead,
  stages,
  acceptedProposal,
  canWrite,
  onConvert,
}: {
  lead: LeadRecord;
  stages: LeadStageRecord[];
  acceptedProposal: boolean;
  canWrite: boolean;
  onConvert: () => void;
}) {
  const won = isWonStage(lead.stage, stages);
  const lost = isLostStage(lead.stage, stages);

  if (lost) {
    return (
      <div className="rounded-2xl bg-muted/50 p-4 text-sm ring-1 ring-foreground/6">
        <p className="font-medium">
          Lost{lead.closedAt ? ` on ${formatDay(lead.closedAt.slice(0, 10))}` : ""}
          {lead.lostReason ? ` · ${lead.lostReason}` : ""}
        </p>
        {lead.lostNote ? <p className="mt-1 text-muted-foreground">{lead.lostNote}</p> : null}
      </div>
    );
  }
  if (won) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-500/10 p-4 text-sm ring-1 ring-emerald-500/25">
        <PartyPopper className="size-4 text-emerald-600 dark:text-emerald-400" />
        <p className="min-w-0 flex-1 font-medium">
          Won{lead.closedAt ? ` on ${formatDay(lead.closedAt.slice(0, 10))}` : ""}
        </p>
        {canWrite && !lead.clientId ? (
          <Button type="button" size="sm" onClick={onConvert}>
            Become a client
          </Button>
        ) : null}
      </div>
    );
  }
  if (acceptedProposal && canWrite) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-500/10 p-4 text-sm ring-1 ring-emerald-500/25">
        <PartyPopper className="size-4 text-emerald-600 dark:text-emerald-400" />
        <p className="min-w-0 flex-1 font-medium">The client accepted your proposal.</p>
        <Button type="button" size="sm" onClick={onConvert}>
          Mark as won
        </Button>
      </div>
    );
  }
  return null;
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
  settings,
  members,
  currentUserId,
  sender,
}: {
  orgSlug: string;
  lead: LeadRecord | null;
  stages: LeadStageRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  canDelete?: boolean;
  showMoney?: boolean;
  settings: CrmSettings;
  members: CrmMember[];
  currentUserId: string;
  sender: LeadEmailSender;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const confirmDelete = useTypeToConfirm();
  const [activityFor, setActivityFor] = useState<string | null>(null);
  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [acceptedProposal, setAcceptedProposal] = useState(false);
  const [tabFor, setTabFor] = useState<{ leadId: string; tab: LeadTab } | null>(null);
  const [seenFor, setSeenFor] = useState<{ leadId: string; tabs: LeadTab[] } | null>(null);

  if (!lead) return null;
  const showActivity = activityFor === lead.id;
  const tab: LeadTab = tabFor?.leadId === lead.id ? tabFor.tab : "overview";
  const seen = seenFor?.leadId === lead.id ? seenFor.tabs : [];
  const setTab = (next: LeadTab) => {
    setTabFor({ leadId: lead.id, tab: next });
    if (!seen.includes(next)) setSeenFor({ leadId: lead.id, tabs: [...seen, next] });
  };
  /** Tabs load their data the first time they're opened, then stay mounted. */
  const opened = (id: LeadTab) => tab === id || seen.includes(id);
  const tabIdPrefix = `lead-${lead.id.slice(0, 8)}`;

  const won = isWonStage(lead.stage, stages);
  const lost = isLostStage(lead.stage, stages);
  const formId = `edit-lead-${lead.id}`;
  const touchKey = `${lead.lastTouchedAt}:${lead.stage}:${lead.nextAction ?? ""}`;

  const clientCard = !canWrite ? null : lead.clientId ? (
    <div className="grid gap-2 rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">Linked client</p>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/${orgSlug}/clients/${lead.clientId}`)}
      >
        Open client
      </Button>
      {!won && !lost ? (
        <Button type="button" size="sm" className="w-full" onClick={() => setConvertFor(lead.id)}>
          Win and start project
        </Button>
      ) : null}
    </div>
  ) : lost ? null : (
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-sm font-medium">{won ? "Deal won" : "Ready to convert?"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Creates the client (or adds to an existing one) and a project from this lead.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full"
        variant={won ? "default" : "outline"}
        onClick={() => setConvertFor(lead.id)}
      >
        Become a client
      </Button>
    </div>
  );

  return (
    <ActionSheet
      title={lead.name}
      description={[lead.company, lead.contactName].filter(Boolean).join(" · ") || "Lead"}
      hideTrigger
      width="wide"
      open={open}
      onOpenChange={(next) => {
        if (!next) setActivityFor(null);
        onOpenChange(next);
      }}
      narrow={showActivity || tab !== "overview"}
      tabs={
        showActivity ? undefined : (
          <SheetTabs
            label="Lead sections"
            idPrefix={tabIdPrefix}
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Overview", icon: LayoutGrid },
              { id: "timeline", label: "Timeline", icon: MessageSquareText },
              { id: "notes", label: "Notes & files", icon: NotebookPen },
              { id: "proposals", label: "Proposals", icon: FileText },
            ]}
          />
        )
      }
      headerAction={
        <ActivityToggle
          active={showActivity}
          onToggle={() => setActivityFor(showActivity ? null : lead.id)}
        />
      }
      footer={
        canWrite && !showActivity ? (
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
              description="This permanently deletes the lead, its notes, timeline, and attachments. A client already created from it is kept. This can’t be undone."
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
        key={lead.id}
        hidden={showActivity}
        onInvalidCapture={() => setTab("overview")}
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
          settings={settings}
          members={members}
          currentUserId={currentUserId}
          tab={tab}
          tabIdPrefix={tabIdPrefix}
          leading={
            <>
              <OutcomeBanner
                lead={lead}
                stages={stages}
                acceptedProposal={acceptedProposal}
                canWrite={canWrite}
                onConvert={() => setConvertFor(lead.id)}
              />
              {canWrite && !lost ? (
                <div className="flex flex-wrap items-center gap-2">
                  <LeadEmailButton
                    orgSlug={orgSlug}
                    lead={lead}
                    stages={stages}
                    settings={settings}
                    sender={sender}
                  />
                </div>
              ) : null}
              {!won && !lost ? (
                <LeadNextStep
                  key={`${lead.id}:${lead.nextAction ?? ""}:${lead.nextActionOn ?? ""}`}
                  orgSlug={orgSlug}
                  lead={lead}
                  canWrite={canWrite}
                />
              ) : null}
            </>
          }
          afterFields={
            opened("timeline") ? (
              <LeadTimeline
                orgSlug={orgSlug}
                leadId={lead.id}
                canWrite={canWrite}
                canDelete={canDelete}
                currentUserId={currentUserId}
                refreshKey={touchKey}
                showTitle={false}
              />
            ) : null
          }
          attachments={
            opened("notes") ? (
              <LeadAttachments
                key={lead.id}
                orgSlug={orgSlug}
                leadId={lead.id}
                canWrite={canWrite}
              />
            ) : null
          }
          aside={
            <>
              <OwnerPicker
                orgSlug={orgSlug}
                lead={lead}
                members={members}
                canWrite={canWrite}
              />
              {clientCard}
            </>
          }
          proposals={
            <LeadDocuments
              key={lead.id}
              orgSlug={orgSlug}
              leadId={lead.id}
              leadName={lead.company?.trim() || lead.name}
              canWrite={canWrite}
              refreshKey={touchKey}
              onAccepted={setAcceptedProposal}
            />
          }
        />
      </form>
      {showActivity ? (
        <ActivityPanel
          orgSlug={orgSlug}
          entityType="lead"
          entityId={lead.id}
          currency={lead.currency}
          refreshKey={lead.updatedAt}
        />
      ) : null}
      {canWrite ? (
        <ConvertLeadDialog
          key={`convert-${lead.id}`}
          orgSlug={orgSlug}
          lead={lead}
          open={convertFor === lead.id}
          onOpenChange={(next) => setConvertFor(next ? lead.id : null)}
        />
      ) : null}
    </ActionSheet>
  );
}
