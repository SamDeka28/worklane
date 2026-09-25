import { Extension, mergeAttributes } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import type { Editor } from "@tiptap/react";

export const INDENT_STEP = 24;
export const INDENT_MAX = 360;

function indentAttrs() {
  return {
    indentLeft: {
      default: 0,
      parseHTML: (element: HTMLElement) => parsePx(element.style.marginLeft),
      renderHTML: () => ({}),
    },
    indentRight: {
      default: 0,
      parseHTML: (element: HTMLElement) => parsePx(element.style.marginRight),
      renderHTML: () => ({}),
    },
    indentFirst: {
      default: 0,
      parseHTML: (element: HTMLElement) => parsePx(element.style.textIndent),
      renderHTML: () => ({}),
    },
    lineHeight: {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
      renderHTML: () => ({}),
    },
  };
}

function parsePx(value: string): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function indentStyle(attrs: {
  indentLeft?: number;
  indentRight?: number;
  indentFirst?: number;
  lineHeight?: string | null;
}) {
  const styles: string[] = [];
  if (attrs.indentLeft) styles.push(`margin-left: ${attrs.indentLeft}px`);
  if (attrs.indentRight) styles.push(`margin-right: ${attrs.indentRight}px`);
  if (attrs.indentFirst) styles.push(`text-indent: ${attrs.indentFirst}px`);
  if (attrs.lineHeight) styles.push(`line-height: ${attrs.lineHeight}`);
  return styles.length ? { style: styles.join("; ") } : {};
}

/** Paragraph with Google Docs–style left / first-line / right indents. */
export const IndentableParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...indentAttrs(),
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, indentStyle(node.attrs)),
      0,
    ];
  },
});

/** Headings share indent attrs so the ruler works on titles too. */
export const IndentableHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...indentAttrs(),
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = Number(node.attrs.level) || 1;
    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, indentStyle(node.attrs)),
      0,
    ];
  },
});

/** Tab / Shift-Tab indent the current paragraph or heading (lists keep native Tab). */
export const IndentShortcuts = Extension.create({
  name: "indentShortcuts",
  addKeyboardShortcuts() {
    return {
      Tab: () => bumpIndent(this.editor, INDENT_STEP),
      "Shift-Tab": () => bumpIndent(this.editor, -INDENT_STEP),
    };
  },
});

export type BlockIndent = {
  indentLeft: number;
  indentRight: number;
  indentFirst: number;
};

export function activeBlockType(editor: Editor): "paragraph" | "heading" | null {
  if (editor.isActive("heading")) return "heading";
  if (editor.isActive("paragraph")) return "paragraph";
  return null;
}

export function getBlockIndent(editor: Editor): BlockIndent {
  const type = activeBlockType(editor);
  if (!type) return { indentLeft: 0, indentRight: 0, indentFirst: 0 };
  const attrs = editor.getAttributes(type);
  return {
    indentLeft: Number(attrs.indentLeft ?? 0) || 0,
    indentRight: Number(attrs.indentRight ?? 0) || 0,
    indentFirst: Number(attrs.indentFirst ?? 0) || 0,
  };
}

export function setBlockIndent(editor: Editor, next: Partial<BlockIndent>): boolean {
  const type = activeBlockType(editor);
  if (!type) return false;
  const current = getBlockIndent(editor);
  const patch: BlockIndent = {
    indentLeft: clampIndent(next.indentLeft ?? current.indentLeft),
    indentRight: clampIndent(next.indentRight ?? current.indentRight),
    indentFirst: clampIndentFirst(next.indentFirst ?? current.indentFirst),
  };
  return editor.chain().focus().updateAttributes(type, patch).run();
}

function clampIndent(value: number) {
  return Math.min(INDENT_MAX, Math.max(0, Math.round(value)));
}

function clampIndentFirst(value: number) {
  return Math.min(INDENT_MAX, Math.max(-INDENT_MAX, Math.round(value)));
}

export const LINE_SPACING_STEPS = ["1", "1.15", "1.5", "2"] as const;

export function getBlockLineHeight(editor: Editor): string {
  const type = activeBlockType(editor);
  if (!type) return "";
  return (editor.getAttributes(type).lineHeight as string | null) ?? "";
}

export function setBlockLineHeight(editor: Editor, value: string | null): boolean {
  return editor
    .chain()
    .focus()
    .updateAttributes("paragraph", { lineHeight: value })
    .updateAttributes("heading", { lineHeight: value })
    .run();
}

export function bumpIndent(editor: Editor, delta: number): boolean {
  const type = activeBlockType(editor);
  if (!type) return false;
  if (editor.isActive("listItem")) return false;
  const current = getBlockIndent(editor);
  return setBlockIndent(editor, { indentLeft: current.indentLeft + delta });
}
