"use client";

import { ExternalLink, FileImage, FileText } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ViewableFile = {
  id: string;
  name: string;
  mime: string | null;
  url?: string | null;
  sizeBytes?: number | null;
};

function isPdf(mime: string | null, name: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

export function isImageFile(mime: string | null, name: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function isImage(mime: string | null, name: string) {
  return isImageFile(mime, name);
}

function isText(mime: string | null, name: string) {
  if (mime === "text/plain") return true;
  return /\.(txt|md|csv)$/i.test(name);
}

function isWord(mime: string | null, name: string) {
  return (
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx?$/i.test(name)
  );
}

export function canPreviewInApp(file: Pick<ViewableFile, "mime" | "name">) {
  return (
    isPdf(file.mime, file.name) ||
    isImage(file.mime, file.name) ||
    isText(file.mime, file.name)
  );
}

function FileKindIcon({ mime, name }: { mime: string | null; name: string }) {
  if (isImage(mime, name)) return <FileImage className="size-4" />;
  return <FileText className="size-4" />;
}

export function FileViewerSheet({
  file,
  open,
  onOpenChange,
}: {
  file: ViewableFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [textBody, setTextBody] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const previewable = file ? canPreviewInApp(file) : false;
  const pdf = file ? isPdf(file.mime, file.name) : false;
  const image = file ? isImage(file.mime, file.name) : false;
  const text = file ? isText(file.mime, file.name) : false;
  const word = file ? isWord(file.mime, file.name) : false;

  useEffect(() => {
    if (!open || !file?.url || !text) {
      setTextBody(null);
      setTextError(null);
      setLoadingText(false);
      return;
    }
    let cancelled = false;
    setLoadingText(true);
    setTextError(null);
    fetch(file.url)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load file");
        const body = await response.text();
        if (!cancelled) setTextBody(body);
      })
      .catch((error) => {
        if (!cancelled) {
          setTextError(error instanceof Error ? error.message : "Could not load file");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingText(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, file?.url, file?.id, text]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-lift",
          "data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:h-[min(94vh,58rem)] data-[side=bottom]:max-h-[min(94vh,58rem)] data-[side=bottom]:rounded-[2rem]",
        )}
      >
        <SheetHeader className="shrink-0 gap-1.5 border-b border-border/50 px-6 py-5 pr-14">
          <SheetTitle className="font-heading text-2xl font-semibold tracking-tight">
            {file?.name ?? "Document"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {previewable
              ? "Preview inside Worklane"
              : word
                ? "Word files open outside Worklane"
                : "This file type can’t be previewed here"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-hidden bg-muted/25 px-3 py-3 sm:px-4">
          {!file?.url ? (
            <div className="flex h-full items-center justify-center rounded-[1.5rem] bg-card/80 text-sm text-muted-foreground ring-1 ring-border/30">
              No preview URL available
            </div>
          ) : pdf ? (
            <iframe
              title={file.name}
              src={file.url}
              className="h-full w-full rounded-[1.5rem] bg-white ring-1 ring-border/30"
            />
          ) : image ? (
            <div className="flex h-full items-center justify-center overflow-auto rounded-[1.5rem] bg-card/80 p-4 ring-1 ring-border/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.name}
                className="max-h-full max-w-full rounded-xl object-contain shadow-soft"
              />
            </div>
          ) : text ? (
            <div className="h-full overflow-auto rounded-[1.5rem] bg-card/90 p-4 ring-1 ring-border/30">
              {loadingText ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : textError ? (
                <p className="text-sm text-amber-800">{textError}</p>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
                  {textBody}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[1.5rem] bg-card/80 px-6 text-center ring-1 ring-border/30">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-status-due text-status-due-fg">
                <FileKindIcon mime={file.mime} name={file.name} />
              </span>
              <p className="max-w-sm text-sm text-muted-foreground">
                {word
                  ? "Open this Word document in a new tab or download it to view."
                  : "Open or download this file to view it outside Worklane."}
              </p>
              <Button
                nativeButton={false}
                render={<a href={file.url} target="_blank" rel="noreferrer" />}
              >
                Open in new tab
                <ExternalLink className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {file?.url ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/50 bg-background/95 px-6 py-4 backdrop-blur-sm">
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={file.url} target="_blank" rel="noreferrer" download={file.name} />
              }
            >
              Download
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={file.url} target="_blank" rel="noreferrer" />}
            >
              Open in new tab
              <ExternalLink className="size-4" />
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function formatFileSize(sizeBytes: number | null | undefined) {
  if (sizeBytes == null) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFileListItem({
  file,
  trailing,
}: {
  file: ViewableFile;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const previewable = canPreviewInApp(file);
  const hasUrl = Boolean(file.url);
  const sizeLabel = formatFileSize(file.sizeBytes);

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-due text-status-due-fg">
          <FileKindIcon mime={file.mime} name={file.name} />
        </span>
        <div className="min-w-0">
          {hasUrl ? (
            <button
              type="button"
              className="block max-w-full truncate text-left font-medium hover:underline"
              onClick={() => setOpen(true)}
            >
              {file.name}
            </button>
          ) : (
            <span className="truncate font-medium">{file.name}</span>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {previewable ? "Click to preview" : "Uploaded file"}
            {file.mime ? ` · ${file.mime.split("/").pop()}` : ""}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </p>
        </div>
      </div>
      {trailing}
      <FileViewerSheet file={file} open={open} onOpenChange={setOpen} />
    </li>
  );
}

/** Thumbnail (images) or file chip with in-app preview sheet. */
export function FileAttachmentPreview({
  file,
  trailing,
}: {
  file: ViewableFile;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const image = isImageFile(file.mime, file.name);
  const previewable = canPreviewInApp(file);
  const hasUrl = Boolean(file.url);
  const sizeLabel = formatFileSize(file.sizeBytes);

  return (
    <li className="relative overflow-hidden rounded-2xl bg-muted/50 ring-1 ring-foreground/6">
      {image && hasUrl ? (
        <button
          type="button"
          className="group block w-full text-left"
          onClick={() => setOpen(true)}
          aria-label={`Preview ${file.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.url!}
            alt={file.name}
            className="aspect-16/10 w-full object-cover transition-[opacity,transform] duration-150 group-hover:opacity-95"
          />
          <span className="flex items-center justify-between gap-2 px-3.5 py-2.5">
            <span className="min-w-0 truncate text-[13px] font-medium">{file.name}</span>
            {sizeLabel ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">{sizeLabel}</span>
            ) : null}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground ring-1 ring-foreground/6">
            <FileKindIcon mime={file.mime} name={file.name} />
          </span>
          <div className="min-w-0 flex-1">
            {hasUrl && previewable ? (
              <button
                type="button"
                className="block max-w-full truncate text-left text-[13px] font-medium hover:underline"
                onClick={() => setOpen(true)}
              >
                {file.name}
              </button>
            ) : hasUrl ? (
              <a
                href={file.url!}
                target="_blank"
                rel="noreferrer"
                className="block max-w-full truncate text-[13px] font-medium hover:underline"
              >
                {file.name}
              </a>
            ) : (
              <span className="truncate text-[13px] font-medium">{file.name}</span>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {previewable ? "Click to preview" : "Open to download"}
              {sizeLabel ? ` · ${sizeLabel}` : ""}
            </p>
          </div>
        </div>
      )}
      {trailing ? (
        <div className="absolute top-2 right-2 z-10">{trailing}</div>
      ) : null}
      <FileViewerSheet file={file} open={open} onOpenChange={setOpen} />
    </li>
  );
}
