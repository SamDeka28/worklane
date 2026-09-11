import { FontSize } from "@tiptap/extension-text-style";
import type { Editor } from "@tiptap/react";

export const FONT_SIZE_STEPS = [
  "10px",
  "12px",
  "14px",
  "15px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
] as const;

export const DOCUMENT_FONTS = [
  { label: "Sans", value: "var(--font-source-sans), ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif", value: "var(--font-source-serif), ui-serif, Georgia, serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
] as const;

function parsePx(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

export function currentFontSize(editor: Editor): string {
  const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
  return raw && String(raw).trim() ? String(raw) : "15px";
}

export function bumpFontSize(editor: Editor, direction: 1 | -1): boolean {
  const current = parsePx(currentFontSize(editor)) ?? 15;
  const idx = FONT_SIZE_STEPS.findIndex((step) => parsePx(step) === current);
  let next: string;
  if (idx === -1) {
    const nearest = FONT_SIZE_STEPS.reduce((best, step) => {
      const px = parsePx(step) ?? 15;
      const bestPx = parsePx(best) ?? 15;
      return Math.abs(px - current) < Math.abs(bestPx - current) ? step : best;
    }, FONT_SIZE_STEPS[4]);
    const nearestIdx = FONT_SIZE_STEPS.indexOf(nearest as (typeof FONT_SIZE_STEPS)[number]);
    const target = Math.min(
      FONT_SIZE_STEPS.length - 1,
      Math.max(0, nearestIdx + direction),
    );
    next = FONT_SIZE_STEPS[target];
  } else {
    const target = Math.min(FONT_SIZE_STEPS.length - 1, Math.max(0, idx + direction));
    next = FONT_SIZE_STEPS[target];
  }
  return editor.chain().focus().setFontSize(next).run();
}

/** FontSize with Cmd/Ctrl+Shift+. / , to grow / shrink. */
export const DocumentFontSize = FontSize.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-.": () => bumpFontSize(this.editor, 1),
      "Mod-Shift-,": () => bumpFontSize(this.editor, -1),
      "Mod-Shift->": () => bumpFontSize(this.editor, 1),
      "Mod-Shift-<": () => bumpFontSize(this.editor, -1),
    };
  },
});
