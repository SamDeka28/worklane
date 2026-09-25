"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { cn } from "@/lib/utils";
import { DOCUMENT_PROSE } from "@/components/editor/document-prose";
import { DocumentFontSize } from "@/components/editor/document-typography";
import { IndentableHeading, IndentableParagraph } from "@/components/editor/indentable-blocks";
import { TypedMention } from "@/components/editor/mention-suggestion";
import { StyledTableCell, StyledTableHeader } from "@/components/editor/styled-table";

/** Read-only, unpaginated render of a document for people outside the studio. */
export function DocumentReader({ content, className }: { content: JSONContent; className?: string }) {
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    content,
    extensions: [
      StarterKit.configure({ heading: false, paragraph: false, link: { openOnClick: true } }),
      IndentableParagraph,
      IndentableHeading.configure({ levels: [1, 2, 3] }),
      Image,
      TextStyleKit.configure({ fontSize: false }),
      DocumentFontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Table,
      TableRow,
      StyledTableHeader,
      StyledTableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      TypedMention.configure({
        HTMLAttributes: { class: "font-medium" },
        renderLabel: ({ node }) => String(node.attrs.label ?? node.attrs.id ?? ""),
      }),
    ],
    editorProps: {
      attributes: { class: cn(DOCUMENT_PROSE, "bg-white text-slate-900") },
    },
  });

  return <EditorContent editor={editor} className={className} />;
}
