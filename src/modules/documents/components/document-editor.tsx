"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CopyPlus,
  Eye,
  FileText,
  FolderKanban,
  FolderPlus,
  LayoutTemplate,
  Link2,
  ListChecks,
  Lock,
  Mail,
  Pencil,
  PenLine,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentStudioEditor } from "@/components/editor/document-studio-editor";
import { HiddenDocFields, type MentionItem } from "@/components/editor/rich-editor";
import { StatusChip } from "@/components/studio/status-chip";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { MILESTONE_STATUS_LABEL } from "@/modules/delivery/milestone-life";
import type { BillingMode, MilestoneRecord, TaskRecord } from "@/modules/delivery/types";
import {
  cloneDocumentVersionAction,
  createProjectFromDocumentAction,
  createSowFromProposalAction,
  freezeDocumentVersionAction,
  markDocumentSentAction,
  saveDocumentVersionAction,
  updateDocumentLinksAction,
} from "@/modules/documents/actions";
import { DocumentCreateSheets } from "@/modules/documents/components/document-create-sheets";
import { DEFAULT_PAGE_MARGINS } from "@/modules/documents/components/document-page-ruler";
import {
  buildMilestoneTableDoc,
  buildTaskTableDoc,
  extractDocumentRefs,
} from "@/modules/documents/refs";
import {
  resolveDocumentForPreview,
  type PreviewCatalog,
} from "@/modules/documents/resolve-preview";
import { buildBasicDocumentTemplate } from "@/modules/documents/templates";
import type {
  DocumentKind,
  DocumentRecord,
  DocumentSignature,
  DocumentStatus,
  DocumentVersion,
} from "@/modules/documents/types";
import type { DocumentRefRow } from "@/modules/documents/queries";
import { formatDay } from "@/modules/finance/presentation";
import { moneyLabel } from "@/modules/finance/ledger";

type CatalogClient = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
};
type CatalogProject = {
  id: string;
  name: string;
  clientId: string;
  clientName?: string | null;
  status?: string;
  startsOn?: string | null;
  dueOn?: string | null;
  billingMode?: string;
};
type CatalogMilestone = Pick<
  MilestoneRecord,
  "id" | "name" | "status" | "dueOn" | "amountMinor"
>;
type CatalogTask = Pick<TaskRecord, "id" | "title" | "status" | "dueOn">;

export function DocumentEditor({
  orgSlug,
  document,
  version,
  versions = [],
  canWrite,
  clients,
  projects,
  milestones,
  tasks,
  refs,
  clientName,
  projectName,
  currency = "USD",
  signatures = [],
}: {
  orgSlug: string;
  document: DocumentRecord;
  version: DocumentVersion;
  versions?: Array<{
    id: string;
    versionNumber: number;
    status: DocumentVersion["status"];
  }>;
  canWrite: boolean;
  clients: CatalogClient[];
  projects: CatalogProject[];
  milestones: CatalogMilestone[];
  tasks: CatalogTask[];
  refs: DocumentRefRow[];
  clientName?: string | null;
  projectName?: string | null;
  currency?: "USD" | "INR";
  signatures?: Pick<DocumentSignature, "id" | "signerName" | "signerEmail" | "signedAt">[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const locked =
    Boolean(version.lockedAt) || version.status === "signed" || version.status === "accepted";
  const lockedAt =
    version.lockedAt ??
    (typeof version.snapshot?.frozenAt === "string" ? version.snapshot.frozenAt : null);
  const [doc, setDoc] = useState<JSONContent>(
    (locked && version.snapshot?.contentDoc
      ? (version.snapshot.contentDoc as JSONContent)
      : (version.contentDoc as JSONContent)) ?? { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [plain, setPlain] = useState("");
  const [title, setTitle] = useState(document.title);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [clientId, setClientId] = useState(document.clientId ?? "");
  const [projectId, setProjectId] = useState(document.projectId ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<
    "client" | "project" | "milestone" | "task" | null
  >(null);
  const [createName, setCreateName] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [margins, setMargins] = useState(DEFAULT_PAGE_MARGINS);
  const createResolver = useRef<((item: MentionItem | null) => void) | null>(null);

  const previewCatalog = useMemo((): PreviewCatalog => {
    return {
      clients,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        clientName: p.clientName ?? clients.find((c) => c.id === p.clientId)?.name ?? null,
        startsOn: p.startsOn,
        dueOn: p.dueOn,
      })),
      milestones,
      tasks,
      currency,
    };
  }, [clients, currency, milestones, projects, tasks]);

  const previewDoc = useMemo(
    () => resolveDocumentForPreview(doc, previewCatalog),
    [doc, previewCatalog],
  );

  const scopedProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.clientId === clientId) : projects),
    [clientId, projects],
  );

  const mentions = useMemo((): MentionItem[] => {
    const items: MentionItem[] = [
      ...clients.map((c) => ({ id: c.id, label: c.name, type: "client" })),
      ...scopedProjects.map((p) => ({ id: p.id, label: p.name, type: "project" })),
      ...milestones.map((m) => ({ id: m.id, label: m.name, type: "milestone" })),
      ...tasks.map((t) => ({ id: t.id, label: t.title, type: "task" })),
    ];
    if (canWrite && !locked) {
      items.push(
        { id: "__create__:client", label: "Create client", type: "client", create: true },
        { id: "__create__:project", label: "Create project", type: "project", create: true },
        { id: "__create__:milestone", label: "Create milestone", type: "milestone", create: true },
        { id: "__create__:task", label: "Create task", type: "task", create: true },
      );
    }
    return items;
  }, [canWrite, clients, locked, milestones, scopedProjects, tasks]);

  const closeCreateDialog = useCallback((result: MentionItem | null) => {
    setCreateOpen(false);
    setCreateType(null);
    createResolver.current?.(result);
    createResolver.current = null;
  }, []);

  const onCreateMention = useCallback(
    (type: string, query: string) =>
      new Promise<MentionItem | null>((resolve) => {
        createResolver.current = resolve;
        setCreateType(type as "client" | "project" | "milestone" | "task");
        setCreateName(query.trim());
        setCreateOpen(true);
      }),
    [],
  );

  const liveRefs = useMemo(() => extractDocumentRefs(doc), [doc]);

  function insertMilestoneTable() {
    if (!editor || milestones.length === 0) {
      toast.error("Link a project with milestones first");
      return;
    }
    const table = buildMilestoneTableDoc(
      milestones.map((m) => ({
        name: m.name,
        amount: m.amountMinor != null ? moneyLabel(m.amountMinor, currency) : "-",
        due: m.dueOn ? formatDay(m.dueOn) : "-",
        status: MILESTONE_STATUS_LABEL[m.status],
      })),
    );
    editor.chain().focus().insertContent(table).run();
  }

  function insertTaskTable() {
    if (!editor || tasks.length === 0) {
      toast.error("Link a project with tasks first");
      return;
    }
    const table = buildTaskTableDoc(
      tasks.map((t) => ({
        title: t.title,
        status: t.status,
        due: t.dueOn ? formatDay(t.dueOn) : "-",
      })),
    );
    editor.chain().focus().insertContent(table).run();
  }

  function applyStarterTemplate() {
    if (!canWrite || locked) return;
    const client = clients.find((c) => c.id === clientId);
    const project = projects.find((p) => p.id === projectId);
    const next = buildBasicDocumentTemplate({
      kind: document.kind,
      title: title.trim() || document.title,
      client: client ? { id: client.id, label: client.name, type: "client" } : null,
      project: project ? { id: project.id, label: project.name, type: "project" } : null,
    });
    setDoc(next);
    setPlain("");
    editor?.commands.setContent(next, { emitUpdate: false });
    toast.success("Designed template applied. Save when ready");
  }

  const displayClient =
    clients.find((c) => c.id === clientId)?.name ?? clientName ?? null;
  const displayProject =
    projects.find((p) => p.id === projectId)?.name ?? projectName ?? null;

  const railRefs = liveRefs.length > 0
    ? liveRefs.map((ref) => ({
        ...ref,
        label:
          refs.find((r) => r.entityType === ref.entityType && r.entityId === ref.entityId)
            ?.label ??
          ref.label ??
          mentions.find((m) => m.id === ref.entityId)?.label ??
          ref.entityId.slice(0, 8),
      }))
    : refs;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <DocumentCreateSheets
        key={`${createType}-${createOpen}`}
        orgSlug={orgSlug}
        documentId={document.id}
        createType={createType}
        seedName={createName}
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog(null);
          else setCreateOpen(true);
        }}
        onCreated={(item) => closeCreateDialog(item)}
        clients={clients}
        projectId={projectId}
        defaultClientId={clientId}
        billingMode={
          (projects.find((p) => p.id === projectId)?.billingMode as BillingMode) ?? "milestones"
        }
        milestones={milestones}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lane-inset">
        <form
          id="document-studio-form"
          className="flex min-h-0 flex-1 flex-col"
          action={(formData) => {
            start(async () => {
              const result = await saveDocumentVersionAction(orgSlug, version.id, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Draft saved: tags indexed");
              router.refresh();
            });
          }}
        >
          <div className="shrink-0 space-y-3 border-b border-border/40 bg-card px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Link
                  href={`/${orgSlug}/documents`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  Documents
                </Link>
                <input
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={!canWrite || locked || mode === "preview"}
                  className="block w-full min-w-0 bg-transparent font-heading text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 disabled:opacity-90 sm:text-2xl"
                  placeholder="Untitled document"
                />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div
                  className="inline-flex rounded-2xl bg-muted/70 p-1 ring-1 ring-border/40"
                  role="tablist"
                  aria-label="Editor mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "edit"}
                    disabled={!canWrite || locked}
                    onClick={() => setMode("edit")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                      mode === "edit"
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                      (!canWrite || locked) && "opacity-50",
                    )}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "preview"}
                    onClick={() => setMode("preview")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                      mode === "preview"
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </button>
                </div>
                {canWrite && !locked && mode === "edit" ? (
                  <Button type="submit" size="sm" disabled={pending} className="rounded-xl px-4">
                    {pending ? "Saving…" : "Save"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <StatusChip tone="planning">{KIND_LABEL[document.kind]}</StatusChip>
                <StatusChip tone={STATUS_TONE[document.status]}>
                  {STATUS_LABEL[document.status]}
                </StatusChip>
              </div>
              {versions.length > 1 ? (
                <div
                  className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
                  aria-label="Versions"
                >
                  {versions.map((row) => (
                    <Link
                      key={row.id}
                      href={`/${orgSlug}/documents/${document.id}?version=${row.id}`}
                      title={`Version ${row.versionNumber} · ${STATUS_LABEL[row.status]}`}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                        row.id === version.id
                          ? "bg-card text-foreground shadow-soft"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      v{row.versionNumber}
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-medium">Version {version.versionNumber}</span>
              )}
              {displayClient ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="truncate">{displayClient}</span>
                </span>
              ) : null}
              {displayProject ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
                  <FolderKanban className="size-3.5 shrink-0" />
                  {projectId ? (
                    <Link
                      href={`/${orgSlug}/projects/${projectId}`}
                      className="truncate hover:text-foreground hover:underline"
                    >
                      {displayProject}
                    </Link>
                  ) : (
                    <span className="truncate">{displayProject}</span>
                  )}
                </span>
              ) : null}
              {mode === "preview" ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                  <Eye className="size-3.5" />
                  Showing what the client sees
                </span>
              ) : null}
            </div>
          </div>

          <HiddenDocFields name="content" doc={doc} plain={plain} />
          <input type="hidden" name="content_doc" value={JSON.stringify(doc)} />

          <div className="min-h-0 flex-1 overflow-hidden">
            <DocumentStudioEditor
              value={mode === "preview" ? previewDoc : doc}
              editable={mode === "edit" && canWrite && !locked}
              orgSlug={orgSlug}
              entityType="document_version"
              entityId={version.id}
              mentions={mentions}
              onCreateMention={onCreateMention}
              onEditorReady={setEditor}
              pagePadding={margins}
              onPagePaddingChange={
                mode === "edit" && canWrite && !locked ? setMargins : undefined
              }
              placeholder="Write or paste from Word / Docs. Type @ to tag…"
              className="h-full"
              onChange={(next, nextPlain) => {
                if (mode === "preview") return;
                setDoc(next);
                setPlain(nextPlain);
              }}
            />
          </div>

          {locked ? (
            <p className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
              This version is locked. Start a new version to make changes.
            </p>
          ) : mode === "preview" && canWrite ? (
            <p className="border-t border-border/40 px-4 py-2 text-center text-xs text-muted-foreground">
              Preview expands @ tags into live data: switch to Edit to change the draft.
            </p>
          ) : null}
        </form>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto pb-2 lg:w-80 xl:w-[22rem]">
        <RailCard title="Linked to" description="Tags and tables pull live data from these records.">
          {canWrite && !locked ? (
            <div className="grid gap-3">
              <Field label="Client" htmlFor="studio_client">
                <NativeSelect
                  id="studio_client"
                  value={clientId}
                  disabled={pending}
                  onChange={(event) => {
                    const next = event.target.value;
                    setClientId(next);
                    setProjectId("");
                    start(async () => {
                      const result = await updateDocumentLinksAction(orgSlug, document.id, {
                        clientId: next || null,
                        projectId: null,
                      });
                      if (result.error) toast.error(result.error);
                      else router.refresh();
                    });
                  }}
                >
                  <option value="">No client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label="Project"
                htmlFor="studio_project"
                hint={clientId ? undefined : "Pick a client first"}
              >
                <NativeSelect
                  id="studio_project"
                  value={projectId}
                  disabled={pending || !clientId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setProjectId(next);
                    start(async () => {
                      const result = await updateDocumentLinksAction(orgSlug, document.id, {
                        projectId: next || null,
                      });
                      if (result.error) toast.error(result.error);
                      else {
                        if (result.clientId) setClientId(result.clientId);
                        router.refresh();
                      }
                    });
                  }}
                >
                  <option value="">No project</option>
                  {scopedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Client</dt>
                <dd className="truncate font-medium">{displayClient ?? "N/A"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Project</dt>
                <dd className="truncate font-medium">{displayProject ?? "N/A"}</dd>
              </div>
            </dl>
          )}
        </RailCard>

        {canWrite && !locked && mode === "edit" ? (
          <RailCard title="Insert">
            <div className="-mx-1.5 grid gap-0.5">
              <RailAction
                icon={LayoutTemplate}
                label="Designed template"
                hint={`Replaces the page with a ready-made ${KIND_LABEL[document.kind].toLowerCase()} layout`}
                disabled={pending}
                onClick={applyStarterTemplate}
              />
              <RailAction
                icon={Table2}
                label="Milestones table"
                hint={
                  milestones.length > 0
                    ? `${milestones.length} milestone${milestones.length === 1 ? "" : "s"} with amounts and due dates`
                    : projectId
                      ? "This project has no milestones yet"
                      : "Link a project to use its milestones"
                }
                disabled={pending || milestones.length === 0}
                onClick={insertMilestoneTable}
              />
              <RailAction
                icon={ListChecks}
                label="Tasks table"
                hint={
                  tasks.length > 0
                    ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} with status and due dates`
                    : projectId
                      ? "This project has no tasks yet"
                      : "Link a project to use its tasks"
                }
                disabled={pending || tasks.length === 0}
                onClick={insertTaskTable}
              />
            </div>
          </RailCard>
        ) : null}

        <RailCard
          title="Tags"
          description="Type @ in the page to tag a record. Preview swaps tags for live details."
        >
          {railRefs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
              No tags yet
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {railRefs.map((ref) => {
                const href =
                  ref.entityType === "project"
                    ? `/${orgSlug}/projects/${ref.entityId}`
                    : ref.entityType === "client"
                      ? `/${orgSlug}/clients/${ref.entityId}`
                      : projectId
                        ? `/${orgSlug}/projects/${projectId}?tab=${ref.entityType === "milestone" ? "milestones" : "work"}`
                        : null;
                return (
                  <li
                    key={`${ref.entityType}:${ref.entityId}`}
                    className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="w-16 shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {ref.entityType}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{ref.label}</span>
                    {href ? (
                      <Link
                        href={href}
                        aria-label={`Open ${ref.label}`}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </RailCard>

        {canWrite ? (
          <RailCard title="Share">
            <div className="-mx-1.5 grid gap-0.5">
              <RailAction
                icon={Mail}
                label="Send by email"
                hint="Opens your mail app and marks the document as sent"
                disabled={pending}
                onClick={() => {
                  const subject = encodeURIComponent(document.title);
                  const body = encodeURIComponent(`Please review: ${window.location.href}`);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  start(async () => {
                    await markDocumentSentAction(orgSlug, document.id);
                    router.refresh();
                  });
                }}
              />
              <RailAction
                icon={Link2}
                label="Copy link"
                hint="For teammates with access to this workspace"
                disabled={pending}
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied");
                }}
              />
              {!locked ? (
                <RailAction
                  icon={BadgeCheck}
                  label="Mark as accepted"
                  hint="Locks this version as the agreed copy"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await freezeDocumentVersionAction(
                        orgSlug,
                        version.id,
                        "accepted",
                      );
                      if (result.error) toast.error(result.error);
                      else {
                        toast.success("Marked as accepted. This version is now locked");
                        router.refresh();
                      }
                    });
                  }}
                />
              ) : (
                <RailAction
                  icon={CopyPlus}
                  label="Start a new version"
                  hint="Copies this version into an editable draft"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await cloneDocumentVersionAction(orgSlug, version.id);
                      if (result.error) toast.error(result.error);
                      else {
                        toast.success("New draft version created");
                        router.refresh();
                      }
                    });
                  }}
                />
              )}
              {document.kind === "proposal" ? (
                <RailAction
                  icon={FileText}
                  label="Create statement of work"
                  hint="Starts a SOW from this proposal"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await createSowFromProposalAction(orgSlug, document.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Statement of work created");
                      router.push(`/${orgSlug}/documents/${result.id}`);
                    });
                  }}
                />
              ) : null}
              {locked && !document.projectId ? (
                <RailAction
                  icon={FolderPlus}
                  label="Create project"
                  hint="Sets up a project from the agreed scope"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await createProjectFromDocumentAction(orgSlug, document.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Project created");
                      router.push(`/${orgSlug}/projects/${result.id}`);
                    });
                  }}
                />
              ) : null}
            </div>
          </RailCard>
        ) : null}

        {canWrite && !locked ? (
          <RailCard
            title="Record a signature"
            description="Captures the signer's name and email as an electronic signature, then locks this version."
          >
            <SignForm orgSlug={orgSlug} versionId={version.id} pending={pending} start={start} />
          </RailCard>
        ) : null}

        {signatures.length > 0 || lockedAt ? (
          <RailCard title={signatures.length > 0 ? "Signed" : "Locked"}>
            <div className="grid gap-2">
              {signatures.map((sig) => (
                <div key={sig.id} className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <PenLine className="size-3.5" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{sig.signerName}</p>
                    <p className="truncate text-xs text-muted-foreground">{sig.signerEmail}</p>
                    <p className="text-xs text-muted-foreground">{formatStamp(sig.signedAt)}</p>
                  </div>
                </div>
              ))}
              {lockedAt ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Locked {formatStamp(lockedAt)}
                </p>
              ) : null}
            </div>
          </RailCard>
        ) : null}
      </aside>
    </div>
  );
}

const KIND_LABEL: Record<DocumentKind, string> = {
  proposal: "Proposal",
  sow: "Statement of work",
  other: "Document",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  signed: "Signed",
  void: "Void",
};

const STATUS_TONE: Record<DocumentStatus, "active" | "due" | "paid" | "cancelled"> = {
  draft: "active",
  sent: "due",
  accepted: "paid",
  signed: "paid",
  void: "cancelled",
};

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RailCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] bg-card/90 p-4 shadow-soft ring-1 ring-border/30">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RailAction({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground ring-1 ring-border/40 transition-colors group-hover:text-foreground group-disabled:opacity-50 group-disabled:group-hover:text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-sm font-medium group-disabled:text-muted-foreground">
          {label}
        </span>
        {hint ? (
          <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

function SignForm({
  orgSlug,
  versionId,
  pending,
  start,
}: {
  orgSlug: string;
  versionId: string;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  const router = useRouter();
  return (
    <form
      className="grid gap-3"
      action={(formData) => {
        formData.set("user_agent", navigator.userAgent);
        start(async () => {
          const result = await freezeDocumentVersionAction(
            orgSlug,
            versionId,
            "signed",
            formData,
          );
          if (result.error) toast.error(result.error);
          else {
            toast.success("Signed. A PDF copy has been stored");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Full name" htmlFor="signer_name">
        <Input
          id="signer_name"
          name="signer_name"
          placeholder="Jane Cooper"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          required
        />
      </Field>
      <Field label="Email" htmlFor="signer_email">
        <Input
          id="signer_email"
          name="signer_email"
          type="email"
          placeholder="jane@company.com"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          required
        />
      </Field>
      <input
        type="hidden"
        name="intent_text"
        value="I agree to the terms in this document and intend to sign electronically."
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        By signing, they agree to the terms in this document and intend to sign electronically.
      </p>
      <Button type="submit" disabled={pending} className="w-full gap-2">
        <PenLine className="size-4" />
        Sign document
      </Button>
    </form>
  );
}
