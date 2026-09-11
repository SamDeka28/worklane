"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { HiddenDocFields, RichEditor, type MentionItem } from "@/components/editor/rich-editor";
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
import type { DocumentRecord, DocumentVersion } from "@/modules/documents/types";
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
  canWrite,
  clients,
  projects,
  milestones,
  tasks,
  refs,
  clientName,
  projectName,
  currency = "USD",
}: {
  orgSlug: string;
  document: DocumentRecord;
  version: DocumentVersion;
  canWrite: boolean;
  clients: CatalogClient[];
  projects: CatalogProject[];
  milestones: CatalogMilestone[];
  tasks: CatalogTask[];
  refs: DocumentRefRow[];
  clientName?: string | null;
  projectName?: string | null;
  currency?: "USD" | "INR";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const locked =
    Boolean(version.lockedAt) || version.status === "signed" || version.status === "accepted";
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
        amount: m.amountMinor != null ? moneyLabel(m.amountMinor, currency) : "—",
        due: m.dueOn ? formatDay(m.dueOn) : "—",
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
        due: t.dueOn ? formatDay(t.dueOn) : "—",
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
    toast.success("Designed template applied — save when ready");
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
    <div className="flex min-h-0 flex-1 gap-3 lg:flex-row">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <form
          id="document-studio-form"
          className="flex min-h-0 flex-1 flex-col gap-2"
          action={(formData) => {
            start(async () => {
              const result = await saveDocumentVersionAction(orgSlug, version.id, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Draft saved — tags indexed");
              router.refresh();
            });
          }}
        >
          <div className="shrink-0 space-y-2 rounded-[1.25rem] bg-card/90 px-3 py-2.5 shadow-soft ring-1 ring-border/30 sm:px-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!canWrite || locked || mode === "preview"}
                className="min-w-0 flex-1 bg-transparent font-heading text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 disabled:opacity-90 sm:text-2xl"
                placeholder="Untitled document"
              />
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
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusChip tone="planning">{document.kind}</StatusChip>
              <StatusChip tone={document.status === "draft" ? "active" : "paid"}>
                {document.status}
              </StatusChip>
              <span>v{version.versionNumber}</span>
              {displayClient ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{displayClient}</span>
                </>
              ) : null}
              {displayProject ? (
                <>
                  <span aria-hidden>·</span>
                  {projectId ? (
                    <Link
                      href={`/${orgSlug}/projects/${projectId}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {displayProject}
                    </Link>
                  ) : (
                    <span>{displayProject}</span>
                  )}
                </>
              ) : null}
              {mode === "preview" ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-foreground/70">Client preview</span>
                </>
              ) : null}
            </div>
          </div>

          <HiddenDocFields name="content" doc={doc} plain={plain} />
          <input type="hidden" name="content_doc" value={JSON.stringify(doc)} />

          <div className="min-h-0 flex-1">
            <RichEditor
              value={mode === "preview" ? previewDoc : doc}
              editable={mode === "edit" && canWrite && !locked}
              variant="document"
              orgSlug={orgSlug}
              entityType="document_version"
              entityId={version.id}
              mentions={mentions}
              onCreateMention={onCreateMention}
              onEditorReady={setEditor}
              enableTables
              pagePadding={margins}
              onPagePaddingChange={
                mode === "edit" && canWrite && !locked ? setMargins : undefined
              }
              placeholder="Write or paste from Word / Docs. Type @ to tag…"
              minHeightClassName="min-h-[36rem]"
              maxHeightClassName="max-h-[min(85vh,56rem)]"
              className="border-0 bg-transparent shadow-none ring-0"
              onChange={(next, nextPlain) => {
                if (mode === "preview") return;
                setDoc(next);
                setPlain(nextPlain);
              }}
            />
          </div>

          {locked ? (
            <p className="text-xs text-muted-foreground">
              This version is locked. Clone to revise.
            </p>
          ) : mode === "preview" && canWrite ? (
            <p className="text-center text-xs text-muted-foreground">
              Preview expands @ tags into live data — switch to Edit to change the draft.
            </p>
          ) : null}
        </form>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-72 xl:w-80">
        <div className="rounded-[1.75rem] bg-card/80 p-4 shadow-soft ring-1 ring-border/30">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Context
          </p>
          {canWrite && !locked ? (
            <div className="mt-3 grid gap-3">
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
                  <option value="">None</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Project" htmlFor="studio_project">
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
                  <option value="">None</option>
                  {scopedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          ) : (
            <div className="mt-3 space-y-1 text-sm">
              <p>{displayClient ?? "No client"}</p>
              <p className="text-muted-foreground">{displayProject ?? "No project"}</p>
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] bg-card/80 p-4 shadow-soft ring-1 ring-border/30">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Tags & structure
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            @-tags sync on save. In Preview they expand to live client, project, milestone, and
            task details.
          </p>

          {canWrite && !locked && mode === "edit" ? (
            <div className="mt-3 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={applyStarterTemplate}
              >
                Apply designed template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || milestones.length === 0}
                onClick={insertMilestoneTable}
              >
                Insert milestones table
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || tasks.length === 0}
                onClick={insertTaskTable}
              >
                Insert tasks table
              </Button>
            </div>
          ) : null}

          <ul className="mt-4 space-y-2">
            {railRefs.length === 0 ? (
              <li className="text-xs text-muted-foreground">
                No tags yet. Type @ in the editor or create from the menu.
              </li>
            ) : (
              railRefs.map((ref) => (
                <li
                  key={`${ref.entityType}:${ref.entityId}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {ref.entityType}
                    </span>
                    {ref.label}
                  </span>
                  {ref.entityType === "project" ? (
                    <Link
                      href={`/${orgSlug}/projects/${ref.entityId}`}
                      className="shrink-0 text-xs text-sky-700 hover:underline"
                    >
                      Open
                    </Link>
                  ) : ref.entityType === "client" ? (
                    <Link
                      href={`/${orgSlug}/clients/${ref.entityId}`}
                      className="shrink-0 text-xs text-sky-700 hover:underline"
                    >
                      Open
                    </Link>
                  ) : projectId ? (
                    <Link
                      href={`/${orgSlug}/projects/${projectId}?tab=${ref.entityType === "milestone" ? "milestones" : "work"}`}
                      className="shrink-0 text-xs text-sky-700 hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>

        {canWrite ? (
          <div className="rounded-[1.75rem] bg-card/80 p-4 shadow-soft ring-1 ring-border/30">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Share & sign
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  const subject = encodeURIComponent(document.title);
                  const body = encodeURIComponent(
                    `Please review: ${typeof window !== "undefined" ? window.location.href : ""}`,
                  );
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  start(async () => {
                    await markDocumentSentAction(orgSlug, document.id);
                    router.refresh();
                  });
                }}
              >
                Send via email
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied");
                }}
              >
                Copy link
              </Button>
              {!locked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                        toast.success("Accepted — snapshot frozen");
                        router.refresh();
                      }
                    });
                  }}
                >
                  Accept & freeze
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await cloneDocumentVersionAction(orgSlug, version.id);
                      if (result.error) toast.error(result.error);
                      else {
                        toast.success("New draft version");
                        router.refresh();
                      }
                    });
                  }}
                >
                  Clone to new version
                </Button>
              )}
              {document.kind === "proposal" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await createSowFromProposalAction(orgSlug, document.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("SOW created");
                      router.push(`/${orgSlug}/documents/${result.id}`);
                    });
                  }}
                >
                  Create SOW
                </Button>
              ) : null}
              {locked && !document.projectId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await createProjectFromDocumentAction(orgSlug, document.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Project created from snapshot");
                      router.push(`/${orgSlug}/projects/${result.id}`);
                    });
                  }}
                >
                  Create project
                </Button>
              ) : null}
              {!locked ? (
                <div className="mt-2 border-t border-border/40 pt-3">
                  <SignForm
                    orgSlug={orgSlug}
                    versionId={version.id}
                    pending={pending}
                    start={start}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
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
      className={cn("flex flex-col gap-2")}
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
            toast.success("Signed — PDF copy stored");
            router.refresh();
          }
        });
      }}
    >
      <Field label="Signer name" htmlFor="signer_name">
        <Input id="signer_name" name="signer_name" required />
      </Field>
      <Field label="Email" htmlFor="signer_email">
        <Input id="signer_email" name="signer_email" type="email" required />
      </Field>
      <input
        type="hidden"
        name="intent_text"
        value="I agree to the terms in this document and intend to sign electronically."
      />
      <Button type="submit" disabled={pending} className="w-full">
        Sign (clickwrap)
      </Button>
    </form>
  );
}
