"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import type { JSONContent } from "@tiptap/react";
import type { MutableRefObject } from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { docToPlainText } from "@/components/editor/doc-text";
import { DocumentFontSize } from "@/components/editor/document-typography";
import { DocumentToolbar } from "@/components/editor/document-toolbar";
import {
  IndentableHeading,
  IndentableParagraph,
  IndentShortcuts,
} from "@/components/editor/indentable-blocks";
import { StyledTableCell, StyledTableHeader } from "@/components/editor/styled-table";
import {
  DEFAULT_PAGE_MARGINS,
  type PageMargins,
} from "@/modules/documents/components/document-page-ruler";
import { EditorPageRuler } from "@/modules/documents/components/editor-page-ruler";
import { uploadFileAction } from "@/modules/files/actions";

export type MentionItem = {
  id: string;
  label: string;
  type: string;
  /** When true, selecting runs onCreateMention instead of inserting immediately. */
  create?: boolean;
};

export { docToPlainText } from "@/components/editor/doc-text";

const TypedMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-type"),
        renderHTML: (attributes) => {
          if (!attributes.type) return {};
          return { "data-type": attributes.type };
        },
      },
    };
  },
});

const DOCUMENT_PROSE =
  "doc-wysiwyg max-w-none focus:outline-none " +
  "[&_h1]:mb-4 [&_h1]:text-[2rem] [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:tracking-tight " +
  "[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[1.5rem] [&_h2]:font-semibold [&_h2]:leading-snug " +
  "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[1.2rem] [&_h3]:font-semibold " +
  "[&_p]:mb-3 [&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-foreground/90 " +
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground " +
  "[&_hr]:my-8 [&_hr]:border-border/60 " +
  "[&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:py-px " +
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] " +
  "[&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top " +
  "[&_th]:border [&_th]:border-border/60 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold " +
  "[&_.ProseMirror-selectednode]:outline [&_.ProseMirror-selectednode]:outline-sky-300";

const COMPACT_PROSE =
  "max-w-none px-3.5 py-3 focus:outline-none " +
  "[&_table]:w-full [&_table]:border-collapse " +
  "[&_td]:border [&_td]:border-border/50 [&_td]:px-2 [&_td]:py-1.5 " +
  "[&_th]:border [&_th]:border-border/50 [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left";

function ToolbarButton({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border/60" aria-hidden />;
}

export function RichEditor({
  value,
  onChange,
  placeholder = "Write…",
  editable = true,
  orgSlug,
  entityType,
  entityId,
  mentions = [],
  onCreateMention,
  onEditorReady,
  enableTables = false,
  variant = "compact",
  className,
  minHeightClassName = "min-h-28",
  maxHeightClassName = "max-h-56",
  pagePadding,
  onPagePaddingChange,
}: {
  value?: JSONContent | null;
  onChange?: (doc: JSONContent, plain: string) => void;
  placeholder?: string;
  editable?: boolean;
  orgSlug?: string;
  entityType?: string;
  entityId?: string;
  mentions?: MentionItem[];
  onCreateMention?: (
    type: string,
    query: string,
  ) => Promise<MentionItem | null | undefined>;
  onEditorReady?: (editor: Editor | null) => void;
  enableTables?: boolean;
  /** Document studio: page-like WYSIWYG. Compact: field embeds. */
  variant?: "compact" | "document";
  className?: string;
  minHeightClassName?: string;
  maxHeightClassName?: string;
  /** Document page padding in px (from rulers). */
  pagePadding?: PageMargins;
  onPagePaddingChange?: (next: PageMargins) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const createRef = useRef(onCreateMention);
  createRef.current = onCreateMention;
  const mentionsRef = useRef(mentions);
  mentionsRef.current = mentions;
  const isDocument = variant === "document";

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: isDocument ? false : { levels: [2, 3] },
        paragraph: isDocument ? false : undefined,
      }),
      ...(isDocument
        ? [
            IndentableParagraph,
            IndentableHeading.configure({ levels: [1, 2, 3] }),
            IndentShortcuts,
          ]
        : []),
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder }),
      ...(isDocument
        ? [
            TextStyleKit.configure({
              fontSize: false,
            }),
            DocumentFontSize,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
          ]
        : []),
      ...(enableTables || isDocument
        ? [
            Table.configure({
              resizable: true,
              allowTableNodeSelection: true,
            }),
            TableRow,
            ...(isDocument
              ? [StyledTableHeader, StyledTableCell]
              : [TableHeader, TableCell]),
          ]
        : []),
      TypedMention.configure({
        HTMLAttributes: {
          class:
            "rounded-md bg-sky-100 px-1.5 py-0.5 font-medium text-sky-900 not-italic",
        },
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
          items: ({ query }) => {
            const q = query.toLowerCase();
            const catalog = mentionsRef.current;
            const matches = catalog
              .filter(
                (item) =>
                  !item.create &&
                  (item.label.toLowerCase().includes(q) ||
                    item.type.toLowerCase().includes(q)),
              )
              .slice(0, 8);
            const createItems = catalog
              .filter((item) => item.create)
              .map((item) => ({
                ...item,
                label: query.trim()
                  ? `Create ${item.type} “${query.trim()}”`
                  : `Create ${item.type}…`,
              }));
            return [...matches, ...createItems];
          },
          render: () => {
            const state: { element: HTMLDivElement | null } = { element: null };
            return {
              onStart: (props) => {
                state.element = document.createElement("div");
                state.element.className =
                  "z-50 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl bg-card shadow-lift ring-1 ring-border/50";
                document.body.appendChild(state.element);
                updateList(state.element, props, createRef);
              },
              onUpdate: (props) => {
                if (state.element) updateList(state.element, props, createRef);
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  state.element?.remove();
                  return true;
                }
                return false;
              },
              onExit: () => {
                state.element?.remove();
                state.element = null;
              },
            };
          },
        },
      }),
    ],
    [enableTables, isDocument, placeholder],
  );

  const [, setToolbarTick] = useState(0);

  const editor = useEditor({
    extensions,
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          isDocument ? DOCUMENT_PROSE : COMPACT_PROSE,
          minHeightClassName,
        ),
        ...(isDocument
          ? {
              style: pagePadding
                ? `padding:${pagePadding.top}px ${pagePadding.right}px ${pagePadding.bottom}px ${pagePadding.left}px`
                : "padding:48px 56px",
            }
          : {}),
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
      onChange?.(json, docToPlainText(json));
    },
  });

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || !isDocument) return;
    const refresh = () => setToolbarTick((tick) => tick + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor, isDocument]);

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
    if (!editor || !isDocument) return;
    const el = editor.view.dom as HTMLElement;
    const pad = pagePadding ?? { top: 48, right: 56, bottom: 48, left: 56 };
    el.style.padding = `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`;
  }, [editor, isDocument, pagePadding]);

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
          editor.chain().focus().setImage({ src: result.url, alt: result.name }).run();
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

  if (!editor) return null;

  const canAttach = Boolean(orgSlug && entityType && entityId);

  return (
    <div
      className={cn(
        "overflow-hidden transition-[box-shadow,background-color,ring-color]",
        isDocument
          ? "rounded-[1.25rem] bg-transparent shadow-none ring-0"
          : "rounded-2xl bg-muted/60 ring-1 ring-border/40 focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/25",
        className,
      )}
    >
      {editable && isDocument ? (
        <div className="sticky top-0 z-10 overflow-hidden rounded-t-[1.25rem] shadow-soft ring-1 ring-border/40">
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
      {editable && !isDocument ? (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 bg-muted/20 px-2 py-1.5">
          <ToolbarButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton
            label="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Ordered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            active={editor.isActive("link")}
            onClick={() => {
              const previous = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("URL", previous ?? "https://");
              if (url === null) return;
              if (url === "") {
                editor.chain().focus().unsetLink().run();
                return;
              }
              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
          >
            <Link2 className="size-3.5" />
          </ToolbarButton>
          {canAttach ? (
            <>
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
              <ToolbarButton label="Attach file" onClick={() => fileRef.current?.click()}>
                <Paperclip className="size-3.5" />
              </ToolbarButton>
              {uploading ? (
                <span className="px-2 text-xs text-muted-foreground">Uploading…</span>
              ) : null}
            </>
          ) : null}
          <span className="ml-auto px-2 text-[11px] text-muted-foreground">Type @ to tag</span>
        </div>
      ) : null}
      <div
        className={cn(
          "overflow-y-auto",
          editable ? maxHeightClassName : isDocument ? "max-h-none" : "max-h-40",
          isDocument && "rounded-b-[1.25rem] bg-[#efece6]",
        )}
      >
        <div className={cn(isDocument && "mx-auto max-w-[52rem] px-3 py-5 sm:px-5")}>
          <div
            className={cn(
              isDocument &&
                "min-h-[40rem] overflow-hidden rounded-[2px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/5",
            )}
          >
            {isDocument ? (
              <div className="sticky top-0 z-[5]">
                <EditorPageRuler
                  editor={editor}
                  margins={pagePadding ?? DEFAULT_PAGE_MARGINS}
                  onMarginsChange={(next) => onPagePaddingChange?.(next)}
                  editable={editable && Boolean(onPagePaddingChange)}
                />
              </div>
            ) : null}
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}

const TYPE_TONE: Record<string, string> = {
  client: "bg-emerald-100 text-emerald-800",
  project: "bg-sky-100 text-sky-800",
  milestone: "bg-violet-100 text-violet-800",
  task: "bg-amber-100 text-amber-900",
};

function updateList(
  element: HTMLDivElement,
  props: {
    items: MentionItem[];
    query: string;
    editor: Editor;
    range: { from: number; to: number };
    command: (item: { id: string; label: string; type?: string }) => void;
    clientRect?: (() => DOMRect | null) | null;
  },
  createRef: MutableRefObject<
    | ((type: string, query: string) => Promise<MentionItem | null | undefined>)
    | undefined
  >,
) {
  element.innerHTML = "";
  const rect = props.clientRect?.();
  if (rect) {
    element.style.position = "absolute";
    element.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`;
    element.style.top = `${rect.bottom + 8}px`;
  }

  const matches = props.items.filter((item) => !item.create);
  const creates = props.items.filter((item) => item.create);

  if (matches.length === 0 && creates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "px-4 py-3 text-sm text-muted-foreground";
    empty.textContent = "No matches";
    element.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className =
    "border-b border-border/40 px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase";
  header.textContent = props.query.trim() ? `Matching “${props.query.trim()}”` : "Tag something";
  element.appendChild(header);

  const list = document.createElement("div");
  list.className = "max-h-64 overflow-y-auto p-1.5";

  function appendSection(title: string, items: MentionItem[]) {
    if (items.length === 0) return;
    const section = document.createElement("div");
    section.className = "mb-1";
    const label = document.createElement("p");
    label.className =
      "px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] text-muted-foreground/80 uppercase";
    label.textContent = title;
    section.appendChild(label);
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted";
      const tone = TYPE_TONE[item.type] ?? "bg-muted text-muted-foreground";
      const typeBadge = document.createElement("span");
      typeBadge.className = `shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`;
      typeBadge.textContent = item.create ? "New" : item.type;
      const name = document.createElement("span");
      name.className = "min-w-0 flex-1 truncate text-sm font-medium";
      name.textContent = item.create
        ? props.query.trim()
          ? `${item.type}: ${props.query.trim()}`
          : `New ${item.type}`
        : item.label;
      button.appendChild(typeBadge);
      button.appendChild(name);
      button.onclick = () => {
        void (async () => {
          if (item.create) {
            const range = { from: props.range.from, to: props.range.to };
            const editor = props.editor;
            element.remove();
            const created = await createRef.current?.(item.type, props.query);
            if (!created) {
              editor.chain().focus().run();
              return;
            }
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: "mention",
                  attrs: {
                    id: created.id,
                    label: created.label,
                    type: created.type,
                  },
                },
                { type: "text", text: " " },
              ])
              .run();
            return;
          }
          props.command({ id: item.id, label: item.label, type: item.type });
        })();
      };
      section.appendChild(button);
    }
    list.appendChild(section);
  }

  appendSection("In your workspace", matches);
  appendSection("Create", creates);
  element.appendChild(list);
}

export function HiddenDocFields({
  name,
  doc,
  plain,
}: {
  name: string;
  doc: JSONContent | null;
  plain: string;
}) {
  return (
    <>
      <input type="hidden" name={`${name}_doc`} value={JSON.stringify(doc ?? {})} />
      <input type="hidden" name={name} value={plain} />
    </>
  );
}
