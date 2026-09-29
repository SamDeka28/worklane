"use client";

import Link from "next/link";
import { FileImage, FileText, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
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
          No unlinked Docs yet: upload a file below or create one after.
        </p>
      )}
      <Field
        label="Upload files"
        htmlFor="project_attachments_picker"
        hint="PDF, Word, or images: SOWs and signed copies"
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
  const { pending, upload } = useProjectUpload(orgSlug, projectId);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <UploadProjectFileButton pending={pending} onFiles={upload} />
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

      <FileDropZone enabled={canWrite} pending={pending} onFiles={upload}>
        {documents.length === 0 && files.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Link a proposal/SOW from Docs, or upload a PDF for this engagement.
            {canWrite ? " You can also drag files here." : null}
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
        {canWrite && (documents.length > 0 || files.length > 0) ? (
          <p className="mt-auto flex items-center justify-center gap-1.5 pt-6 text-xs text-muted-foreground">
            <UploadCloud className="size-3.5" />
            Drag files anywhere here to upload
          </p>
        ) : null}
      </FileDropZone>
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

const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf";
const UPLOAD_EXTENSIONS = /\.(pdf|docx?|png|jpe?g|webp)$/i;

function useProjectUpload(orgSlug: string, projectId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function upload(list: File[]) {
    const accepted = list.filter((file) => UPLOAD_EXTENSIONS.test(file.name));
    const skipped = list.length - accepted.length;
    if (skipped > 0) {
      toast.error(
        accepted.length === 0
          ? "Only PDF, Word, and image files can be uploaded"
          : `Skipped ${skipped} file${skipped === 1 ? "" : "s"}: only PDF, Word, and images`,
      );
    }
    if (accepted.length === 0) return;
    const toastId = toast.loading(
      accepted.length === 1
        ? `Uploading ${accepted[0].name}…`
        : `Uploading 1 of ${accepted.length} · ${accepted[0].name}`,
    );
    start(async () => {
      try {
        for (const [index, file] of accepted.entries()) {
          toast.loading(
            accepted.length === 1
              ? `Uploading ${file.name}…`
              : `Uploading ${index + 1} of ${accepted.length} · ${file.name}`,
            { id: toastId },
          );
          const fd = new FormData();
          fd.set("file", file);
          fd.set("entity_type", "project");
          fd.set("entity_id", projectId);
          const result = await uploadFileAction(orgSlug, fd);
          if (result.error) {
            toast.error(`${file.name}: ${result.error}`, { id: toastId });
            return;
          }
          toast.loading(
            accepted.length === 1
              ? `Uploaded ${file.name}`
              : `Uploaded ${index + 1} of ${accepted.length} · ${file.name}`,
            { id: toastId },
          );
        }
        toast.success(accepted.length === 1 ? "File uploaded" : `${accepted.length} files uploaded`, {
          id: toastId,
        });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload failed. Please try again.",
          { id: toastId },
        );
      }
    });
  }

  return { pending, upload };
}

function UploadProjectFileButton({
  pending,
  onFiles,
}: {
  pending: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={UPLOAD_ACCEPT}
        multiple
        onChange={(event) => {
          const list = event.target.files;
          if (!list?.length) return;
          onFiles(Array.from(list));
          event.target.value = "";
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

function hasFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** Shows a drop target while files are dragged over it. Fills the space below the list, so files can land anywhere. */
function FileDropZone({
  enabled,
  pending,
  onFiles,
  children,
}: {
  enabled: boolean;
  pending: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  if (!enabled) return <>{children}</>;

  return (
    <div
      className="relative flex min-h-64 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        if (pending) return;
        const list = Array.from(event.dataTransfer.files);
        if (list.length) onFiles(list);
      }}
    >
      {children}
      <div
        aria-hidden={!over}
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-[1.75rem] border-2 border-dashed border-primary/60 bg-primary/8 text-primary backdrop-blur-[2px] transition-opacity duration-150",
          over ? "opacity-100" : "opacity-0",
        )}
      >
        <UploadCloud className="size-6" />
        <p className="text-sm font-semibold tracking-tight">Drop to upload</p>
        <p className="text-xs text-primary/80">PDF, Word, or images</p>
      </div>
    </div>
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
