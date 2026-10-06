"use client";

import Link from "next/link";
import { FileImage, FileText, LayoutGrid, List, Search, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkDocumentsToProjectAction } from "@/modules/documents/actions";
import { softDeleteFileAction, uploadFileAction } from "@/modules/files/actions";
import {
  FILE_CATEGORY_GROUPS,
  FileViewerSheet,
  fileCategory,
  isImageFile,
  type UploadFileCategory,
  type ViewableFile,
} from "@/modules/files/components/file-viewer";

export type AttachableDocument = {
  id: string;
  title: string;
  kind: string;
  status: string;
  projectId?: string | null;
  mentionCount?: number;
  mentionedVia?: "link" | "tag" | "both" | "client";
  excerpt?: string;
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
          <ProjectDocsBrowser
            orgSlug={orgSlug}
            documents={documents}
            files={files}
            canWrite={canWrite}
          />
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

type LayoutMode = "tiles" | "list";
type TitleSize = "small" | "medium" | "large";
type SourceFilter = "all" | "worklane" | "files";
type TypeFilter = "any" | UploadFileCategory;

type BrowserItem = {
  key: string;
  name: string;
  source: "worklane" | "file";
  category: UploadFileCategory | null;
  detail: string;
  badge: string;
  excerpt: string;
  file: ViewableFile;
};

const VIEW_STORAGE_KEY = "worklane-project-docs-view";

const TILE_GRID: Record<TitleSize, string> = {
  small: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  medium: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
  large: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

const TILE_TITLE: Record<TitleSize, string> = {
  small: "truncate text-[11px]",
  medium: "truncate text-[13px]",
  large: "line-clamp-2 text-[15px] leading-snug",
};

const TILE_META: Record<TitleSize, string> = {
  small: "text-[10px]",
  medium: "text-[11px]",
  large: "text-xs",
};

const TILE_ICON: Record<TitleSize, string> = {
  small: "size-5",
  medium: "size-8",
  large: "size-11",
};

const LIST_ICON: Record<TitleSize, string> = {
  small: "size-8 rounded-lg",
  medium: "size-12 rounded-xl",
  large: "size-16 rounded-2xl",
};

const LIST_GLYPH: Record<TitleSize, string> = {
  small: "size-4",
  medium: "size-5",
  large: "size-7",
};

const LIST_TITLE: Record<TitleSize, string> = {
  small: "text-[13px]",
  medium: "text-sm",
  large: "text-base",
};

const LIST_META: Record<TitleSize, string> = {
  small: "text-[11px]",
  medium: "text-xs",
  large: "text-[13px]",
};

const LIST_PAD: Record<TitleSize, string> = {
  small: "px-3 py-1.5",
  medium: "px-3.5 py-2.5",
  large: "px-4 py-3.5",
};

function rememberView(layout: LayoutMode, size: TitleSize) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ layout, size }));
  } catch {
    // Preference is optional.
  }
}

function extensionBadge(name: string, fallback: string) {
  const ext = name.split(".").pop()?.trim();
  if (!ext || ext === name || ext.length > 5) return fallback;
  return ext.toUpperCase();
}

function docDetail(doc: AttachableDocument) {
  const via =
    doc.mentionedVia === "tag"
      ? "tagged in body"
      : doc.mentionedVia === "both"
        ? "linked & tagged"
        : doc.mentionedVia === "client"
          ? "linked to the client"
          : "linked to this project";
  const tags =
    doc.mentionCount && doc.mentionCount > 0
      ? `${doc.mentionCount} tag${doc.mentionCount === 1 ? "" : "s"}`
      : null;
  return [doc.kind, doc.status, via, tags].filter(Boolean).join(" · ");
}

function ItemGlyph({ item, className }: { item: BrowserItem; className: string }) {
  if (item.category === "image") return <FileImage className={className} />;
  return <FileText className={className} />;
}

/** One layout for Worklane docs and uploaded files, with search, type filters, and icon size. */
function ProjectDocsBrowser({
  orgSlug,
  documents,
  files,
  canWrite,
}: {
  orgSlug: string;
  documents: AttachableDocument[];
  files: {
    id: string;
    name: string;
    mime: string | null;
    url?: string | null;
    sizeBytes: number | null;
  }[];
  canWrite: boolean;
}) {
  const [layout, setLayout] = useState<LayoutMode>("tiles");
  const [titleSize, setTitleSize] = useState<TitleSize>("medium");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [type, setType] = useState<TypeFilter>("any");
  const [preview, setPreview] = useState<ViewableFile | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { layout?: LayoutMode; size?: TitleSize };
      if (parsed.layout === "tiles" || parsed.layout === "list") setLayout(parsed.layout);
      if (parsed.size === "small" || parsed.size === "medium" || parsed.size === "large") {
        setTitleSize(parsed.size);
      }
    } catch {
      // Ignore a bad saved preference.
    }
  }, []);

  const items = useMemo<BrowserItem[]>(() => {
    const docs = documents.map((doc) => ({
      key: `doc-${doc.id}`,
      name: doc.title,
      source: "worklane" as const,
      category: null,
      detail: docDetail(doc),
      badge: "Worklane",
      excerpt: doc.excerpt?.trim() ?? "",
      file: {
        id: doc.id,
        name: doc.title,
        mime: "application/pdf",
        url: `/${orgSlug}/documents/${doc.id}/preview`,
        editorHref: `/${orgSlug}/documents/${doc.id}`,
      },
    }));
    const uploads = files.map((file) => {
      const category = fileCategory(file);
      const sizeLabel = file.sizeBytes != null ? formatBytes(file.sizeBytes) : null;
      return {
        key: `file-${file.id}`,
        name: file.name,
        source: "file" as const,
        category,
        detail: sizeLabel ?? "Uploaded file",
        badge: extensionBadge(file.name, category === "pdf" ? "PDF" : category === "word" ? "Word" : "File"),
        excerpt: "",
        file,
      };
    });
    return [...docs, ...uploads];
  }, [documents, files, orgSlug]);

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(FILE_CATEGORY_GROUPS.map((group) => [group.id, 0])) as Record<
      UploadFileCategory,
      number
    >;
    for (const item of items) {
      if (item.category) counts[item.category] += 1;
    }
    return counts;
  }, [items]);

  const worklaneCount = documents.length;
  const fileCount = files.length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (source === "worklane" && item.source !== "worklane") return false;
      if (source === "files" && item.source !== "file") return false;
      if (type !== "any" && item.category !== type) return false;
      if (!q) return true;
      return `${item.name} ${item.detail} ${item.badge}`.toLowerCase().includes(q);
    });
  }, [items, query, source, type]);

  function chooseSource(next: SourceFilter) {
    setSource(next);
    if (next === "worklane") setType("any");
  }

  function chooseType(next: TypeFilter) {
    setType(next);
    if (next !== "any" && source === "worklane") setSource("files");
  }

  function chooseLayout(next: LayoutMode) {
    setLayout(next);
    rememberView(next, titleSize);
  }

  function chooseSize(next: TitleSize) {
    setTitleSize(next);
    rememberView(layout, next);
  }

  const removeFor = (item: BrowserItem) =>
    canWrite && item.source === "file" ? (
      <RemoveFileButton
        orgSlug={orgSlug}
        fileId={item.file.id}
        className={layout === "tiles" ? "bg-background/92 shadow-soft backdrop-blur-sm" : undefined}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
            className="h-9 pl-9"
          />
        </div>
        <div data-slot="segmented" className="flex items-center gap-1 rounded-full bg-muted p-1">
          <ViewButton
            active={layout === "tiles"}
            label="Tile view"
            onClick={() => chooseLayout("tiles")}
          >
            <LayoutGrid className="size-3.5" />
          </ViewButton>
          <ViewButton
            active={layout === "list"}
            label="List view"
            onClick={() => chooseLayout("list")}
          >
            <List className="size-3.5" />
          </ViewButton>
        </div>
        <div data-slot="segmented" className="flex items-center gap-0.5 rounded-full bg-muted p-1">
          {(["small", "medium", "large"] as const).map((size) => (
            <button
              key={size}
              type="button"
              aria-current={titleSize === size ? "page" : undefined}
              onClick={() => chooseSize(size)}
              className={cn(
                "h-8 rounded-full px-2.5 text-xs font-medium capitalize",
                titleSize === size ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <FilterChip active={source === "all" && type === "any"} onClick={() => { setSource("all"); setType("any"); }}>
          All {items.length}
        </FilterChip>
        {worklaneCount > 0 ? (
          <FilterChip active={source === "worklane"} onClick={() => chooseSource("worklane")}>
            Worklane {worklaneCount}
          </FilterChip>
        ) : null}
        {fileCount > 0 ? (
          <FilterChip active={source === "files" && type === "any"} onClick={() => chooseSource("files")}>
            Uploads {fileCount}
          </FilterChip>
        ) : null}
        {FILE_CATEGORY_GROUPS.map((group) =>
          typeCounts[group.id] > 0 ? (
            <FilterChip
              key={group.id}
              active={type === group.id}
              onClick={() => chooseType(type === group.id ? "any" : group.id)}
            >
              {group.label} {typeCounts[group.id]}
            </FilterChip>
          ) : null,
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[1.75rem] border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          No documents match this search.
        </p>
      ) : layout === "tiles" ? (
        <ul className={cn("grid gap-3", TILE_GRID[titleSize])}>
          {visible.map((item) => {
            const remove = removeFor(item);
            return (
              <li key={item.key} className="relative">
                <button
                  type="button"
                  className="flex w-full flex-col overflow-hidden rounded-2xl bg-muted/50 text-left ring-1 ring-foreground/6"
                  onClick={() => setPreview(item.file)}
                  aria-label={`Preview ${item.name}`}
                >
                  <DocTileMedia item={item} size={titleSize} />
                  <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
                    <span className={cn("font-medium", TILE_TITLE[titleSize])} title={item.name}>
                      {item.name}
                    </span>
                    <span className={cn("truncate capitalize text-muted-foreground", TILE_META[titleSize])}>
                      {item.badge} · {item.detail}
                    </span>
                  </span>
                </button>
                {remove ? <div className="absolute top-2 right-2 z-10">{remove}</div> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-[1.75rem] bg-muted/40 ring-1 ring-border/30">
          {visible.map((item) => (
            <li key={item.key} className={cn("flex items-center gap-3", LIST_PAD[titleSize])}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setPreview(item.file)}
                aria-label={`Preview ${item.name}`}
              >
                <DocMark item={item} size={titleSize} />
                <span className="min-w-0">
                  <span className={cn("block truncate font-medium", LIST_TITLE[titleSize])} title={item.name}>
                    {item.name}
                  </span>
                  <span className={cn("mt-0.5 block truncate capitalize text-muted-foreground", LIST_META[titleSize])}>
                    {item.badge} · {item.detail}
                  </span>
                </span>
              </button>
              {removeFor(item)}
            </li>
          ))}
        </ul>
      )}

      <FileViewerSheet
        file={preview}
        open={preview != null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
    </div>
  );
}

function DocTileMedia({ item, size }: { item: BrowserItem; size: TitleSize }) {
  const image = item.category === "image" && item.file.url && isImageFile(item.file.mime, item.file.name);
  if (item.source === "worklane") {
    return (
      <span className="relative block aspect-4/3 w-full overflow-hidden bg-muted/70">
        <WorklanePageThumb item={item} size={size} />
      </span>
    );
  }
  return (
    <span className="relative block aspect-4/3 w-full overflow-hidden bg-card">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.file.url!} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ItemGlyph item={item} className={TILE_ICON[size]} />
          <span className={cn("font-semibold tracking-[0.14em] uppercase", TILE_META[size])}>{item.badge}</span>
        </span>
      )}
    </span>
  );
}

function WorklanePageThumb({ item, size }: { item: BrowserItem; size: TitleSize }) {
  const compact = size === "small";
  const [kind, status] = item.detail.split(" · ");
  return (
    <span className={cn("flex size-full", compact ? "p-1.5" : "p-2.5")}>
      <span className="flex min-h-0 w-full flex-col overflow-hidden rounded-sm bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_18px_-14px_rgba(15,23,42,0.45)] ring-1 ring-black/10">
        <span className="flex items-center justify-between gap-1">
          <span className={cn("font-semibold tracking-[0.16em] text-slate-400 uppercase", compact ? "text-[7px]" : "text-[8px]")}>
            {kind || "Doc"}
          </span>
          {status ? (
            <span className={cn("rounded-full bg-slate-100 px-1.5 py-px font-medium text-slate-500 capitalize", compact ? "text-[7px]" : "text-[8px]")}>
              {status}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "mt-1 font-semibold leading-tight text-slate-900",
            compact ? "line-clamp-2 text-[9px]" : "line-clamp-2 text-[12px]",
          )}
        >
          {item.name}
        </span>
        <span className="my-1.5 h-px shrink-0 bg-slate-200" />
        {item.excerpt ? (
          <span
            className={cn(
              "text-slate-500",
              compact ? "line-clamp-4 text-[8px] leading-snug" : "line-clamp-5 text-[10px] leading-snug",
            )}
          >
            {item.excerpt}
          </span>
        ) : (
          <span className="flex flex-1 flex-col justify-start gap-1 pt-0.5" aria-hidden>
            <span className="h-1 w-full rounded-full bg-slate-200" />
            <span className="h-1 w-11/12 rounded-full bg-slate-200" />
            <span className="h-1 w-full rounded-full bg-slate-200" />
            <span className="h-1 w-4/5 rounded-full bg-slate-100" />
            <span className="h-1 w-full rounded-full bg-slate-100" />
          </span>
        )}
      </span>
    </span>
  );
}

function DocMark({ item, size }: { item: BrowserItem; size: TitleSize }) {
  const image = item.category === "image" && item.file.url && isImageFile(item.file.mime, item.file.name);
  if (item.source === "worklane") {
    return (
      <span className={cn("flex shrink-0 bg-muted p-0.5", LIST_ICON[size])} aria-hidden>
        <span className="flex h-full w-full flex-col gap-0.5 rounded-[2px] bg-white px-1 py-1 ring-1 ring-black/10">
          <span className="h-1 w-2/3 rounded-full bg-slate-300" />
          <span className="mt-auto space-y-0.5">
            <span className="block h-px w-full bg-slate-200" />
            <span className="block h-px w-full bg-slate-200" />
            <span className="block h-px w-3/4 bg-slate-200" />
          </span>
        </span>
      </span>
    );
  }
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.file.url!}
        alt=""
        className={cn("shrink-0 object-cover ring-1 ring-border/40", LIST_ICON[size])}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-status-due text-status-due-fg",
        LIST_ICON[size],
      )}
    >
      <ItemGlyph item={item} className={LIST_GLYPH[size]} />
    </span>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
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

function RemoveFileButton({
  orgSlug,
  fileId,
  className,
}: {
  orgSlug: string;
  fileId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className={className}
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
