"use client";

import { useEffect } from "react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
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

const highlightKey = new PluginKey<DecorationSet>("changedBlocks");

const ChangedBlocks = Extension.create({
  name: "changedBlocks",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, current) {
            const indexes = tr.getMeta(highlightKey) as number[] | undefined;
            if (!indexes) return current.map(tr.mapping, tr.doc);
            const wanted = new Set(indexes);
            const decorations: Decoration[] = [];
            tr.doc.forEach((node, offset, index) => {
              if (wanted.has(index)) {
                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, { class: "doc-changed" }),
                );
              }
            });
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return highlightKey.getState(state);
          },
        },
      }),
    ];
  },
});

/** Read-only, unpaginated render of a document for people outside the studio. */
export function DocumentReader({
  content,
  className,
  highlight,
}: {
  content: JSONContent;
  className?: string;
  /** Top-level block indexes to mark as changed. */
  highlight?: number[];
}) {
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
      ChangedBlocks,
      TypedMention.configure({
        HTMLAttributes: { class: "font-medium" },
        renderLabel: ({ node }) => String(node.attrs.label ?? node.attrs.id ?? ""),
      }),
    ],
    editorProps: {
      attributes: { class: cn(DOCUMENT_PROSE, "bg-white text-slate-900") },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(highlightKey, highlight ?? []));
  }, [editor, highlight]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(content, { emitUpdate: false });
    editor.view.dispatch(editor.state.tr.setMeta(highlightKey, highlight ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content]);

  return <EditorContent editor={editor} className={className} />;
}
