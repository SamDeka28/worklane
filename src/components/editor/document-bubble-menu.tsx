"use client";

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Link2, Underline as UnderlineIcon } from "lucide-react";
import {
  EditorColorPicker,
  HIGHLIGHT_COLOR_SWATCHES,
  TEXT_COLOR_SWATCHES,
} from "@/components/editor/color-picker";
import { cn } from "@/lib/utils";

function BubbleButton({
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
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function DocumentBubbleMenu({ editor }: { editor: Editor }) {
  const options = useMemo(
    () => ({ placement: "top" as const, offset: 8, flip: true, shift: true }),
    [],
  );

  const textColor =
    (editor.getAttributes("textStyle").color as string | undefined) ?? null;
  const highlightColor =
    (editor.getAttributes("highlight").color as string | undefined) ?? null;

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      options={options}
      shouldShow={({ editor: current, state, from, to }) => {
        if (!current.isEditable) return false;
        if (from === to) return false;
        if (state.selection.empty) return false;
        if (current.isActive("image")) return false;
        return true;
      }}
      className="z-60 flex items-center gap-0.5 rounded-xl bg-card px-1 py-1 shadow-lift ring-1 ring-border/50"
    >
      <BubbleButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </BubbleButton>
      <BubbleButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" />
      </BubbleButton>
      <span className="mx-0.5 h-5 w-px bg-border/50" aria-hidden />
      <EditorColorPicker
        label="Text color"
        mode="text"
        value={textColor}
        swatches={TEXT_COLOR_SWATCHES}
        onChange={(color) => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <EditorColorPicker
        label="Highlight"
        mode="highlight"
        value={highlightColor}
        swatches={HIGHLIGHT_COLOR_SWATCHES}
        onChange={(color) => editor.chain().focus().setHighlight({ color }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
      />
      <span className="mx-0.5 h-5 w-px bg-border/50" aria-hidden />
      <BubbleButton
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
      </BubbleButton>
    </BubbleMenu>
  );
}
