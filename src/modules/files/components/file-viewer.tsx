"use client";

import { ExternalLink, FileImage, FileText, Loader2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  /** In-app editor for a Worklane document. The preview URL stays the rendered file. */
  editorHref?: string | null;
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

export type UploadFileCategory = "image" | "pdf" | "word" | "text" | "other";

export const FILE_CATEGORY_GROUPS: { id: UploadFileCategory; label: string }[] = [
  { id: "image", label: "Images" },
  { id: "pdf", label: "PDFs" },
  { id: "word", label: "Word" },
  { id: "text", label: "Text" },
  { id: "other", label: "Other files" },
];

export function fileCategory(file: Pick<ViewableFile, "mime" | "name">): UploadFileCategory {
  if (isImage(file.mime, file.name)) return "image";
  if (isPdf(file.mime, file.name)) return "pdf";
  if (isWord(file.mime, file.name)) return "word";
  if (isText(file.mime, file.name)) return "text";
  return "other";
}

const MIN_IMAGE_ZOOM = 0.25;
const MAX_IMAGE_ZOOM = 4;

function clampImageZoom(value: number) {
  return Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, value));
}

/** Size of the image when it fits inside the stage at 100%. */
function fittedImageSize(img: HTMLImageElement, stage: HTMLElement | null) {
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!stage || !naturalW || !naturalH) return null;
  const maxW = Math.max(1, stage.clientWidth - 32);
  const maxH = Math.max(1, stage.clientHeight - 80);
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return { w: naturalW * scale, h: naturalH * scale };
}

function ImageZoomStage({ url, name }: { url: string; name: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fitRef = useRef<{ w: number; h: number } | null>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);

  const applyZoomRef = useRef<(next: number) => void>(() => {});
  applyZoomRef.current = (next: number) => {
    const img = imgRef.current;
    if (zoomRef.current === 1 && img) {
      const measured = fittedImageSize(img, stageRef.current);
      if (measured) fitRef.current = measured;
    }
    const prev = zoomRef.current;
    const clamped = clampImageZoom(next);
    if (Math.abs(clamped - prev) < 0.001) return;
    const scroller = scrollerRef.current;
    const anchor = scroller
      ? {
          x: scroller.scrollLeft + scroller.clientWidth / 2,
          y: scroller.scrollTop + scroller.clientHeight / 2,
          ratio: clamped / prev,
        }
      : null;
    zoomRef.current = clamped;
    setZoom(clamped);
    if (!anchor || !scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollLeft = anchor.x * anchor.ratio - scroller.clientWidth / 2;
      scroller.scrollTop = anchor.y * anchor.ratio - scroller.clientHeight / 2;
    });
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoomRef.current(zoomRef.current * Math.exp(-event.deltaY * 0.0013));
    };
    let gestureBase = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureBase = zoomRef.current;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale ?? 1;
      applyZoomRef.current(gestureBase * (1 + (scale - 1) * 0.6));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("gesturestart", onGestureStart);
    stage.addEventListener("gesturechange", onGestureChange);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("gesturestart", onGestureStart);
      stage.removeEventListener("gesturechange", onGestureChange);
    };
  }, []);

  useEffect(() => {
    if (zoom !== 1) return;
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return;
    const frame = requestAnimationFrame(() => {
      const measured = fittedImageSize(img, stage);
      if (measured) fitRef.current = measured;
    });
    return () => cancelAnimationFrame(frame);
  }, [zoom, url]);

  const fitted = zoom !== 1 ? fitRef.current : null;

  return (
    <div
      ref={stageRef}
      className="relative h-full overflow-hidden rounded-[1.5rem] bg-card/80 ring-1 ring-border/30"
    >
      <div ref={scrollerRef} className="relative h-full overflow-auto">
        <div
          className={cn(
            "flex items-center justify-center",
            fitted ? "min-h-full min-w-full" : "absolute inset-0 px-4 pt-4 pb-16",
          )}
          style={
            fitted
              ? {
                  width: Math.max(fitted.w * zoom, 0),
                  height: Math.max(fitted.h * zoom, 0),
                }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={url}
            alt={name}
            draggable={false}
            onLoad={(event) => {
              if (zoomRef.current !== 1) return;
              const measured = fittedImageSize(event.currentTarget, stageRef.current);
              if (measured) fitRef.current = measured;
            }}
            className="rounded-xl object-contain shadow-soft select-none"
            style={
              fitted
                ? { width: fitted.w * zoom, height: fitted.h * zoom }
                : { maxWidth: "100%", maxHeight: "100%" }
            }
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-background/95 p-1 shadow-soft ring-1 ring-border/50 backdrop-blur-sm">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom out"
            disabled={zoom <= MIN_IMAGE_ZOOM + 0.001}
            onClick={() => applyZoomRef.current(zoomRef.current / 1.25)}
          >
            <Minus />
          </Button>
          <button
            type="button"
            className="min-w-14 rounded-full px-2 text-center text-[13px] font-medium tabular-nums hover:bg-muted"
            onClick={() => applyZoomRef.current(1)}
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom in"
            disabled={zoom >= MAX_IMAGE_ZOOM - 0.001}
            onClick={() => applyZoomRef.current(zoomRef.current * 1.25)}
          >
            <Plus />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PdfPreview({
  url,
  title,
  worklane,
}: {
  url: string;
  title: string;
  worklane: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [url]);

  return (
    <div className="relative h-full">
      <iframe
        title={title}
        src={url}
        onLoad={() => setReady(true)}
        className={cn(
          "h-full w-full rounded-[1.5rem] bg-white ring-1 ring-border/30",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      {ready ? null : (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-card/80 ring-1 ring-border/30"
          role="status"
          aria-live="polite"
        >
          <div className="flex w-full max-w-xs flex-col items-center gap-4 px-6 text-center">
            <div className="w-full rounded-2xl bg-muted/70 p-5 ring-1 ring-border/30" aria-hidden>
              <div className="mb-4 h-3 w-2/3 animate-pulse rounded-full bg-foreground/10" />
              <div className="space-y-2">
                <div className="h-2 w-full animate-pulse rounded-full bg-foreground/8" />
                <div className="h-2 w-full animate-pulse rounded-full bg-foreground/8" />
                <div className="h-2 w-4/5 animate-pulse rounded-full bg-foreground/8" />
              </div>
            </div>
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Preparing preview</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {worklane ? "Rendering this Worklane document" : "Loading this PDF"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
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
            {image
              ? "Pinch or use the controls to zoom"
              : file?.editorHref
                ? "Preview of this Worklane document"
                : previewable
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
            <PdfPreview
              key={file.id}
              url={file.url}
              title={file.name}
              worklane={Boolean(file.editorHref)}
            />
          ) : image ? (
            <ImageZoomStage key={file.id} url={file.url} name={file.name} />
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
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-background/95 px-6 py-4 backdrop-blur-sm">
            {file.editorHref ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={file.editorHref} />}
              >
                Open in Docs
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    download={
                      file.editorHref && !file.name.toLowerCase().endsWith(".pdf")
                        ? `${file.name}.pdf`
                        : file.name
                    }
                  />
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
  const image = isImageFile(file.mime, file.name);
  const sizeLabel = formatFileSize(file.sizeBytes);

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        {image && hasUrl ? (
          <button
            type="button"
            className="size-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-border/40"
            onClick={() => setOpen(true)}
            aria-label={`Preview ${file.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={file.url!} alt="" className="size-full object-cover" />
          </button>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-due text-status-due-fg">
            <FileKindIcon mime={file.mime} name={file.name} />
          </span>
        )}
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
