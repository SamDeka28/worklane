"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { DocumentDiagram } from "@/components/editor/document-diagram";
import { DocumentImage } from "@/components/editor/document-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { CharacterCount } from "@tiptap/extensions";
import { PAGE_SIZES } from "tiptap-pagination-plus";
import { StudioPagination } from "@/components/editor/studio-pagination";
import { cn } from "@/lib/utils";
import { docToPlainText } from "@/components/editor/doc-text";
import { DocumentBubbleMenu } from "@/components/editor/document-bubble-menu";
import { DocumentContextMenu } from "@/components/editor/document-context-menu";
import { DOCUMENT_PROSE } from "@/components/editor/document-prose";
import { DocumentFontSize } from "@/components/editor/document-typography";
import { DocumentToolbar } from "@/components/editor/document-toolbar";
import {
  IndentableHeading,
  IndentableParagraph,
  IndentShortcuts,
} from "@/components/editor/indentable-blocks";
import { useMentionCatalog } from "@/components/editor/use-mention-catalog";
import {
  configureTypedMention,
  type CreateMentionFn,
  type MentionItem,
} from "@/components/editor/mention-suggestion";
import { StyledTableCell, StyledTableHeader } from "@/components/editor/styled-table";
import {
  DEFAULT_PAGE_MARGINS,
  type PageMargins,
} from "@/modules/documents/components/document-page-ruler";
import { EditorPageRuler } from "@/modules/documents/components/editor-page-ruler";
import { uploadFileAction } from "@/modules/files/actions";

export type { MentionItem };

const PAGE_SIZE_OPTIONS = {
  A4: { label: "A4", size: PAGE_SIZES.A4 },
  LETTER: { label: "Letter", size: PAGE_SIZES.LETTER },
  LEGAL: { label: "Legal", size: PAGE_SIZES.LEGAL },
} as const;

type PageSizeKey = keyof typeof PAGE_SIZE_OPTIONS;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

export function DocumentStudioEditor({
  value,
  onChange,
  placeholder = "Write or paste from Word / Docs. Type @ to tag…",
  editable = true,
  orgSlug,
  entityType,
  entityId,
  mentions = [],
  onCreateMention,
  onEditorReady,
  pagePadding,
  onPagePaddingChange,
  focusTitle,
  focusActions,
  afterPages,
  className,
}: {
  value?: JSONContent | null;
  onChange?: (doc: JSONContent, plain: string) => void;
  placeholder?: string;
  editable?: boolean;
  orgSlug?: string;
  entityType?: string;
  entityId?: string;
  mentions?: MentionItem[];
  onCreateMention?: CreateMentionFn;
  onEditorReady?: (editor: Editor | null) => void;
  pagePadding?: PageMargins;
  onPagePaddingChange?: (next: PageMargins) => void;
  /** Shown in the top bar while in full-screen focus mode. */
  focusTitle?: string;
  /** Extra controls (e.g. Save) for the focus-mode top bar. */
  focusActions?: ReactNode;
  /** Rendered as an extra sheet below the paginated document (e.g. signatures). */
  afterPages?: ReactNode;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [pageSize, setPageSize] = useState<PageSizeKey>("A4");
  const [pageCount, setPageCount] = useState(1);
  const [wordCount, setWordCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const [stackHeight, setStackHeight] = useState(0);
  const [rulerHeight, setRulerHeight] = useState(0);
  const pageWidth = PAGE_SIZE_OPTIONS[pageSize].size.pageWidth + 2;
  const createRef = useRef(onCreateMention);
  createRef.current = onCreateMention;
  const allMentions = useMentionCatalog(orgSlug, mentions, editable);
  const mentionsRef = useRef(allMentions);
  mentionsRef.current = allMentions;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        link: { openOnClick: false },
      }),
      IndentableParagraph,
      IndentableHeading.configure({ levels: [1, 2, 3] }),
      IndentShortcuts,
      DocumentImage,
      DocumentDiagram,
      Placeholder.configure({ placeholder }),
      TextStyleKit.configure({
        fontSize: false,
      }),
      DocumentFontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      StyledTableHeader,
      StyledTableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      StudioPagination.configure({
        ...PAGE_SIZE_OPTIONS.A4.size,
        pageGap: 28,
        pageBreakBackground: "var(--doc-canvas)",
        pageGapBorderSize: 1,
        pageGapBorderColor: "rgba(15, 23, 42, 0.1)",
        contentMarginTop: 8,
        contentMarginBottom: 8,
        headerLeft: "",
        headerRight: "",
        footerLeft: "",
        footerRight: "Page {page}",
      }),
      configureTypedMention(mentionsRef, createRef),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(DOCUMENT_PROSE, "bg-white"),
      },
      transformPastedHTML(html) {
        return html
          .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
          .replace(/<meta[^>]*>/gi, "")
          .replace(/\s*mso-[^:;"]+:[^;"]+;?/gi, "");
      },
    },
    onUpdate: ({ editor: current }) => {
      const json = current.getJSON();
      onChangeRef.current?.(json, docToPlainText(json));
    },
  });

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    const next = value ?? { type: "doc", content: [{ type: "paragraph" }] };
    const current = editor.getJSON();
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const pad = pagePadding ?? DEFAULT_PAGE_MARGINS;
    const size = PAGE_SIZE_OPTIONS[pageSize].size;
    editor
      .chain()
      .updatePageSize(size)
      .updateMargins({ top: pad.top, bottom: pad.bottom, left: pad.left, right: pad.right })
      .run();
  }, [editor, pagePadding, pageSize]);

  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    let capped = false;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pages = editor.view.dom.querySelector("[data-rm-pagination]");
        const count = pages?.children.length ?? 1;
        if (!capped && count > 120) {
          capped = true;
          const commands = editor.commands as { disablePagination?: () => boolean };
          commands.disablePagination?.();
          return;
        }
        setPageCount(Math.max(1, count));
        setWordCount(editor.storage.characterCount.words());
      });
    };
    measure();
    editor.on("transaction", measure);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("transaction", measure);
    };
  }, [editor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFocusMode((current) => !current);
      } else if (event.key === "Escape" && focusMode && !event.defaultPrevented) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [focusMode]);

  const attach = useCallback(
    async (file: File) => {
      if (!orgSlug || !entityType || !entityId || !editor) return;
      setUploading(true);
      try {
        const data = new FormData();
        data.set("file", file);
        data.set("entity_type", entityType);
        data.set("entity_id", entityId);
        const result = await uploadFileAction(orgSlug, data);
        if (result.error || !result.url) {
          throw new Error(result.error ?? "Upload failed");
        }
        if (file.type.startsWith("image/")) {
          editor.chain().focus().setImage({ src: result.url, alt: result.name }).updateAttributes("image", { fileId: result.id }).run();
        } else {
          editor
            .chain()
            .focus()
            .insertContent([
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    marks: [{ type: "link", attrs: { href: result.url } }],
                    text: result.name ?? "Attachment",
                  },
                ],
              },
            ])
            .run();
        }
      } finally {
        setUploading(false);
      }
    },
    [editor, entityId, entityType, orgSlug],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const overCanvas = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && canvas.contains(target)) return true;
      if (!("clientX" in event) || !("clientY" in event)) return false;
      const point = event as MouseEvent;
      const under = document.elementFromPoint(point.clientX, point.clientY);
      return under instanceof Node && canvas.contains(under);
    };

    const zoomAt = (next: number, clientX: number, clientY: number) => {
      const current = zoomRef.current;
      const value = clampZoom(next);
      if (value === current) return;
      const rect = canvas.getBoundingClientRect();
      const anchorX = clientX - rect.left;
      const anchorY = clientY - rect.top;
      const ratio = value / current;
      zoomRef.current = value;
      setZoom(value);
      canvas.scrollLeft = (canvas.scrollLeft + anchorX) * ratio - anchorX;
      canvas.scrollTop = (canvas.scrollTop + anchorY) * ratio - anchorY;
    };

    // Trackpad pinch arrives as a wheel event with the control key held.
    // Listening on the window, before the browser handles it, keeps the zoom on the pages.
    let pinch: { origin: number } | null = null;
    const onWheel = (event: WheelEvent) => {
      if (pinch || (!event.ctrlKey && !event.metaKey) || !overCanvas(event)) return;
      event.preventDefault();
      let delta = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= canvas.clientHeight;
      zoomAt(zoomRef.current * Math.exp(-delta * 0.0013), event.clientX, event.clientY);
    };

    const onGestureStart = (event: Event) => {
      if (!overCanvas(event)) return;
      event.preventDefault();
      pinch = { origin: zoomRef.current };
    };
    const onGestureChange = (event: Event) => {
      if (!pinch || !overCanvas(event)) return;
      event.preventDefault();
      const gesture = event as Event & { scale: number; clientX: number; clientY: number };
      const scale = 1 + (gesture.scale - 1) * 0.6;
      zoomAt(pinch.origin * scale, gesture.clientX, gesture.clientY);
    };
    const onGestureEnd = (event: Event) => {
      if (!pinch) return;
      event.preventDefault();
      pinch = null;
    };

    const listen = { passive: false, capture: true } as const;
    window.addEventListener("wheel", onWheel, listen);
    window.addEventListener("gesturestart", onGestureStart, listen);
    window.addEventListener("gesturechange", onGestureChange, listen);
    window.addEventListener("gestureend", onGestureEnd, listen);
    return () => {
      window.removeEventListener("wheel", onWheel, listen);
      window.removeEventListener("gesturestart", onGestureStart, listen);
      window.removeEventListener("gesturechange", onGestureChange, listen);
      window.removeEventListener("gestureend", onGestureEnd, listen);
    };
  }, [editor]);

  useEffect(() => {
    const stack = stackRef.current;
    const ruler = rulerRef.current;
    if (!stack && !ruler) return;
    const publish = () => {
      if (stack) {
        const next = stack.offsetHeight;
        setStackHeight((current) => (current === next ? current : next));
      }
      if (ruler) {
        const next = ruler.offsetHeight;
        setRulerHeight((current) => (current === next ? current : next));
      }
    };
    publish();
    const observer = new ResizeObserver(publish);
    if (stack) observer.observe(stack);
    if (ruler) observer.observe(ruler);
    return () => observer.disconnect();
  }, [editor, pageWidth, zoom]);

  const changeZoom = useCallback((delta: number) => {
    const canvas = canvasRef.current;
    setZoom((current) => {
      const next = clampZoom(current + delta);
      if (canvas && current > 0) {
        const ratio = next / current;
        const anchorX = canvas.clientWidth / 2;
        const anchorY = canvas.clientHeight / 2;
        requestAnimationFrame(() => {
          canvas.scrollLeft = (canvas.scrollLeft + anchorX) * ratio - anchorX;
          canvas.scrollTop = (canvas.scrollTop + anchorY) * ratio - anchorY;
        });
      }
      return next;
    });
  }, []);

  if (!editor) return null;

  const canAttach = Boolean(orgSlug && entityType && entityId);
  const margins = pagePadding ?? DEFAULT_PAGE_MARGINS;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        focusMode ? "fixed inset-0 z-50 bg-background" : cn("h-full", className),
      )}
      role={focusMode ? "dialog" : undefined}
      aria-modal={focusMode || undefined}
      aria-label={focusMode ? "Full-screen editor" : undefined}
    >
      {focusMode ? (
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/40 bg-card px-4">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
            {focusTitle ?? "Document"}
          </p>
          {focusActions}
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground ring-1 ring-border/60 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Minimize2 className="size-3.5" />
            Exit full screen
            <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">Esc</kbd>
          </button>
        </div>
      ) : null}
      {editable ? (
        <div className="sticky top-0 z-20 shrink-0 border-b border-border/40 bg-card/95 shadow-sm backdrop-blur-md">
          <DocumentToolbar
            editor={editor}
            orgSlug={orgSlug}
            entityType={entityType}
            entityId={entityId}
            uploading={uploading}
            onAttachClick={canAttach ? () => fileRef.current?.click() : undefined}
          />
          {canAttach ? (
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void attach(file);
                event.target.value = "";
              }}
            />
          ) : null}
        </div>
      ) : null}

      {editable ? <DocumentBubbleMenu editor={editor} /> : null}
      {editable ? <DocumentContextMenu editor={editor} /> : null}

      <div
        ref={canvasRef}
        data-doc-zoom={zoom}
        className="doc-canvas min-h-0 flex-1 overflow-auto bg-[var(--doc-canvas)] px-6"
      >
        <div className="sticky top-0 z-10 bg-[var(--doc-canvas)]">
          <div
            className="mx-auto"
            style={{
              width: pageWidth * zoom,
              height: zoom === 1 ? undefined : Math.max(rulerHeight, 1) * zoom,
            }}
          >
            <div
              ref={rulerRef}
              style={
                zoom === 1
                  ? undefined
                  : { width: pageWidth, transform: `scale(${zoom})`, transformOrigin: "top left" }
              }
            >
              <div className="pt-3">
                <div data-theme="light" className="lane-paper shrink-0" style={{ width: pageWidth }}>
                  <EditorPageRuler
                    editor={editor}
                    margins={margins}
                    onMarginsChange={(next) => onPagePaddingChange?.(next)}
                    editable={editable && Boolean(onPagePaddingChange)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="mx-auto"
          style={{
            width: pageWidth * zoom,
            height: zoom === 1 ? undefined : Math.max(stackHeight, 1) * zoom,
          }}
        >
          <div
            ref={stackRef}
            style={
              zoom === 1
                ? undefined
                : { width: pageWidth, transform: `scale(${zoom})`, transformOrigin: "top left" }
            }
          >
            <div className="flex flex-col items-center gap-6 pt-3 pb-16">
              <div
                data-theme="light"
                className="lane-paper shrink-0 text-slate-900"
                style={{ width: pageWidth }}
              >
                <EditorContent editor={editor} />
              </div>
              {afterPages ? (
                <div
                  data-theme="light"
                  className="lane-paper shrink-0 bg-white text-slate-900 shadow-sm"
                  style={{ width: pageWidth }}
                >
                  {afterPages}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 border-t border-border/40 bg-card px-4 py-1.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {pageCount} page{pageCount === 1 ? "" : "s"}
        </span>
        <span className="tabular-nums">
          {wordCount.toLocaleString()} word{wordCount === 1 ? "" : "s"}
        </span>
        <span className="hidden text-muted-foreground/70 sm:inline">
          Right-click for more options
        </span>
        <div className="ml-auto inline-flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => changeZoom(-0.1)}
            className="inline-flex size-6 items-center justify-center rounded-md text-foreground ring-1 ring-border/50 hover:bg-muted"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            title="Reset zoom. Pinch with two fingers, or hold Ctrl and scroll."
            onClick={() => changeZoom(1 - zoom)}
            className="inline-flex h-6 min-w-12 items-center justify-center rounded-md px-1.5 font-medium text-foreground tabular-nums ring-1 ring-border/50 hover:bg-muted"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => changeZoom(0.1)}
            className="inline-flex size-6 items-center justify-center rounded-md text-foreground ring-1 ring-border/50 hover:bg-muted"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <label className="inline-flex items-center gap-1.5">
          Page size
          <select
            value={pageSize}
            onChange={(event) => setPageSize(event.target.value as PageSizeKey)}
            className="h-6 rounded-md bg-transparent px-1 font-medium text-foreground ring-1 ring-border/50 outline-none hover:bg-muted"
          >
            {(Object.keys(PAGE_SIZE_OPTIONS) as PageSizeKey[]).map((key) => (
              <option key={key} value={key}>
                {PAGE_SIZE_OPTIONS[key].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setFocusMode((current) => !current)}
          title={`${focusMode ? "Exit" : "Enter"} full screen (${typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘⇧F" : "Ctrl+Shift+F"})`}
          className="inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 font-medium text-foreground ring-1 ring-border/50 hover:bg-muted"
        >
          {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {focusMode ? "Exit full screen" : "Full screen"}
        </button>
      </div>
    </div>
  );
}
