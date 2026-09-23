"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import type { JSONContent } from "@tiptap/react";
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
import {
  configureTypedMention,
  type CreateMentionFn,
  type MentionItem,
} from "@/components/editor/mention-suggestion";
import { uploadFileAction } from "@/modules/files/actions";

export type { MentionItem };
export { docToPlainText } from "@/components/editor/doc-text";

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
  className,
  minHeightClassName = "min-h-28",
  maxHeightClassName = "max-h-56",
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
  enableTables?: boolean;
  className?: string;
  minHeightClassName?: string;
  maxHeightClassName?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const createRef = useRef(onCreateMention);
  createRef.current = onCreateMention;
  const mentionsRef = useRef(mentions);
  mentionsRef.current = mentions;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false },
      }),
      Image,
      Placeholder.configure({ placeholder }),
      ...(enableTables
        ? [
            Table.configure({
              resizable: true,
              allowTableNodeSelection: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
          ]
        : []),
      configureTypedMention(mentionsRef, createRef),
    ],
    [enableTables, placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(COMPACT_PROSE, minHeightClassName),
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
        "overflow-hidden rounded-2xl bg-muted/60 ring-1 ring-border/40 transition-[box-shadow,background-color,ring-color] focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/25",
        className,
      )}
    >
      {editable ? (
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
      <div className={cn("overflow-y-auto", editable ? maxHeightClassName : "max-h-40")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
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
