"use client";

import Link from "next/link";
import { FileImage, FileText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { linkDocumentsToProjectAction } from "@/modules/documents/actions";
import { softDeleteFileAction, uploadFileAction } from "@/modules/files/actions";
import { ProjectFileListItem } from "@/modules/files/components/file-viewer";

export type AttachableDocument = {
  id: string;
  title: string;
  kind: string;
  status: string;
  projectId?: string | null;
  mentionCount?: number;
  mentionedVia?: "link" | "tag" | "both";
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKindLabel(file: File) {
  if (file.type.startsWith("image/")) return "Image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "PDF";
  if (file.name.toLowerCase().match(/\.docx?$/)) return "Word";
  return "File";
}

/** Checkbox list + file picker with name/size preview and remove. */
export function ProjectDocsAttachFields({
  documents,
}: {
  documents: AttachableDocument[];
}) {
  const linkable = documents.filter((doc) => !doc.projectId);

  return (
    <div className="space-y-4 rounded-[1.5rem] bg-muted/40 p-4 ring-1 ring-border/40">
      <div>
        <p className="text-sm font-semibold tracking-tight">Documents</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Link a proposal/SOW from Docs, or upload a PDF.
        </p>
      </div>
      {linkable.length > 0 ? (
        <ul className="space-y-2">
          {linkable.map((doc) => (
            <li key={doc.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-card/80 px-3 py-2.5 ring-1 ring-border/30">
                <input
                  type="checkbox"
                  name="document_id"
                  value={doc.id}
                  className="mt-1 size-4 rounded border-border"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {doc.kind} · {doc.status}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No unlinked Docs yet — upload a file below or create one after.
        </p>
      )}
      <Field
        label="Upload files"
        htmlFor="project_attachments_picker"
        hint="PDF, Word, or images — SOWs and signed copies"
      >
        <FileAttachControl inputId="project_attachments_picker" name="attachments" />
      </Field>
    </div>
  );
}

function FileAttachControl({
  inputId,
  name,
}: {
  inputId: string;
  name: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(
    () =>
      files.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const row of previews) {
        if (row.url) URL.revokeObjectURL(row.url);
      }
    };
  }, [previews]);

  useEffect(() => {
    if (!hiddenRef.current) return;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    hiddenRef.current.files = transfer.files;
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = Array.from(list);
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
      const merged = [...current];
      for (const file of next) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      }
      return merged;
    });
    if (pickerRef.current) pickerRef.current.value = "";
  }

  function removeAt(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <input
        ref={hiddenRef}
        type="file"
        name={name}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />
      <input
        ref={pickerRef}
        id={inputId}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => pickerRef.current?.click()}
      >
        Browse files
      </Button>

      {previews.length > 0 ? (
        <ul className="space-y-2">
          {previews.map((row, index) => (
            <li
              key={row.key}
              className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 ring-1 ring-border/40"
            >
              {row.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.url}
                  alt=""
                  className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-border/40"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-status-due text-status-due-fg ring-1 ring-foreground/6">
                  {fileKindLabel(row.file) === "Image" ? (
                    <FileImage className="size-5" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.file.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fileKindLabel(row.file)} · {formatBytes(row.file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${row.file.name}`}
                onClick={() => removeAt(index)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No files selected yet.</p>
      )}
    </div>
  );
}

export async function uploadProjectAttachments(
  orgSlug: string,
  projectId: string,
  formData: FormData,
) {
  const files = formData.getAll("attachments").filter((item): item is File => {
    return item instanceof File && item.size > 0;
  });
  for (const file of files) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("entity_type", "project");
    fd.set("entity_id", projectId);
    const result = await uploadFileAction(orgSlug, fd);
    if (result.error) throw new Error(result.error);
  }
}

/** Hub: list Worklane docs + uploaded files; attach / upload. */
export function ProjectDocumentsHub({
  orgSlug,
  projectId,
  clientId,
  documents,
  attachable,
  files,
  canWrite,
  createDocument,
}: {
  orgSlug: string;
  projectId: string;
  clientId: string;
  documents: AttachableDocument[];
  attachable: AttachableDocument[];
  files: {
    id: string;
    name: string;
    mime: string | null;
    url?: string | null;
    sizeBytes: number | null;
  }[];
  canWrite: boolean;
  createDocument?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <UploadProjectFileButton orgSlug={orgSlug} projectId={projectId} />
          {createDocument ? (
            <div key="create-document" className="contents">
              {createDocument}
            </div>
          ) : null}
          <AttachExistingDocsSheet
            orgSlug={orgSlug}
            projectId={projectId}
            clientId={clientId}
            documents={attachable}
          />
        </div>
      ) : null}

      {documents.length === 0 && files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Link a proposal/SOW from Docs, or upload a PDF for this engagement.
        </p>
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-[1.75rem] bg-muted/40 ring-1 ring-border/30">
          {documents.map((doc) => (
            <li key={`doc-${doc.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <Link
                  href={`/${orgSlug}/documents/${doc.id}`}
                  className="truncate font-medium hover:underline"
                >
                  {doc.title}
                </Link>
                <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {doc.kind} · {doc.status}
                  {doc.mentionedVia === "tag"
                    ? " · tagged in body"
                    : doc.mentionedVia === "both"
                      ? " · linked & tagged"
                      : " · in Docs"}
                  {doc.mentionCount && doc.mentionCount > 0
                    ? ` · ${doc.mentionCount} tag${doc.mentionCount === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
          {files.map((file) => (
            <ProjectFileListItem
              key={`file-${file.id}`}
              file={file}
              trailing={
                canWrite ? <RemoveFileButton orgSlug={orgSlug} fileId={file.id} /> : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachExistingDocsSheet({
  orgSlug,
  projectId,
  clientId,
  documents,
}: {
  orgSlug: string;
  projectId: string;
  clientId: string;
  documents: AttachableDocument[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const linkable = documents.filter((doc) => !doc.projectId);

  if (linkable.length === 0) {
    return (
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <Link href={`/${orgSlug}/documents?new=1&client=${clientId}&project=${projectId}`} />
        }
      >
        Open Docs
      </Button>
    );
  }

  return (
    <ActionSheet
      title="Attach from Docs"
      description="Link proposals and SOWs already on this client."
      triggerLabel="Attach from Docs"
      triggerVariant="outline"
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const ids = formData.getAll("document_id").map(String).filter(Boolean);
            if (ids.length === 0) {
              toast.error("Pick at least one document");
              return;
            }
            const result = await linkDocumentsToProjectAction(orgSlug, projectId, ids);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(
              ids.length === 1 ? "Document attached" : `${ids.length} documents attached`,
            );
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <ul className="space-y-2">
          {linkable.map((doc) => (
            <li key={doc.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 ring-1 ring-border/30">
                <input
                  type="checkbox"
                  name="document_id"
                  value={doc.id}
                  className="mt-1 size-4 rounded border-border"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{doc.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {doc.kind} · {doc.status}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Attaching…" : "Attach"}
        </Button>
      </form>
    </ActionSheet>
  );
}

function UploadProjectFileButton({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
        multiple
        onChange={(event) => {
          const list = event.target.files;
          if (!list?.length) return;
          start(async () => {
            for (const file of Array.from(list)) {
              const fd = new FormData();
              fd.set("file", file);
              fd.set("entity_type", "project");
              fd.set("entity_id", projectId);
              const result = await uploadFileAction(orgSlug, fd);
              if (result.error) {
                toast.error(result.error);
                return;
              }
            }
            toast.success(list.length === 1 ? "File uploaded" : "Files uploaded");
            if (inputRef.current) inputRef.current.value = "";
            router.refresh();
          });
        }}
      />
      <Button
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? "Uploading…" : "Upload PDF"}
      </Button>
    </>
  );
}

function RemoveFileButton({ orgSlug, fileId }: { orgSlug: string; fileId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await softDeleteFileAction(orgSlug, fileId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Removed");
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}
