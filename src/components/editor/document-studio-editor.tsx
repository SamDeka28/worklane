"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { cn } from "@/lib/utils";
import { docToPlainText } from "@/components/editor/doc-text";
import { DocumentBubbleMenu } from "@/components/editor/document-bubble-menu";
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

const DOCUMENT_PROSE =
  "doc-wysiwyg max-w-none caret-primary focus:outline-none " +
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
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
      Image,
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
        class: cn(DOCUMENT_PROSE, "min-h-[40rem]"),
        style: `padding:${(pagePadding ?? DEFAULT_PAGE_MARGINS).top}px ${(pagePadding ?? DEFAULT_PAGE_MARGINS).right}px ${(pagePadding ?? DEFAULT_PAGE_MARGINS).bottom}px ${(pagePadding ?? DEFAULT_PAGE_MARGINS).left}px`,
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
    const el = editor.view.dom as HTMLElement;
    const pad = pagePadding ?? DEFAULT_PAGE_MARGINS;
    el.style.padding = `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`;
  }, [editor, pagePadding]);

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
  const margins = pagePadding ?? DEFAULT_PAGE_MARGINS;

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#e8e6e1] dark:bg-muted/40">
        <div className="mx-auto flex w-full max-w-[54rem] justify-center px-3 py-6 sm:px-6 sm:py-8">
          <div className="w-full overflow-hidden rounded-[2px] bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_28px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:bg-card dark:text-foreground dark:shadow-lift dark:ring-white/10">
            <div className="sticky top-0 z-[5]">
              <EditorPageRuler
                editor={editor}
                margins={margins}
                onMarginsChange={(next) => onPagePaddingChange?.(next)}
                editable={editable && Boolean(onPagePaddingChange)}
              />
            </div>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
