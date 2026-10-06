"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, Bold, Image as ImageIcon, Italic, Link2, Underline as UnderlineIcon } from "lucide-react";
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
  const options = { placement: "top" as const, offset: 8, flip: true, shift: true };

  const textColor =
    (editor.getAttributes("textStyle").color as string | undefined) ?? null;
  const highlightColor =
    (editor.getAttributes("highlight").color as string | undefined) ?? null;

  return (
    <>
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
    <ImageBubbleMenu editor={editor} options={options} />
    </>
  );
}

type ImageWrap = "break" | "left" | "right" | "behind" | "front";
type ImageAlign = "left" | "center" | "right";

function ImageBubbleMenu({
  editor,
  options,
}: {
  editor: Editor;
  options: { placement: "top"; offset: number; flip: boolean; shift: boolean };
}) {
  const [formatOpen, setFormatOpen] = useState(false);
  const image = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const selection = current.state.selection;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") return null;
      const attrs = selection.node.attrs;
      const wrap: ImageWrap =
        attrs.wrap === "left" || attrs.wrap === "right" || attrs.wrap === "behind" || attrs.wrap === "front"
          ? attrs.wrap
          : "break";
      const align: ImageAlign = attrs.align === "center" || attrs.align === "right" ? attrs.align : "left";
      return {
        pos: selection.from,
        wrap,
        align,
        alt: typeof attrs.alt === "string" ? attrs.alt : "",
        caption: typeof attrs.caption === "string" ? attrs.caption : "",
        width: typeof attrs.width === "number" ? attrs.width : null,
      };
    },
  });

  function patch(attrs: Record<string, unknown>) {
    if (!image) return;
    let tr = editor.state.tr;
    for (const [key, value] of Object.entries(attrs)) {
      tr = tr.setNodeAttribute(image.pos, key, value);
    }
    editor.view.dispatch(tr);
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="imageBubbleMenu"
      appendTo={() => document.body}
      options={options}
      shouldShow={({ editor: current, state }) => {
        if (!current.isEditable) return false;
        const selection = state.selection;
        return selection instanceof NodeSelection && selection.node.type.name === "image";
      }}
      className="z-60 flex flex-col gap-1 rounded-xl bg-card px-1 py-1 shadow-lift ring-1 ring-border/50"
    >
      <div className="flex items-center gap-0.5">
        <WrapButton
          label="Top and bottom"
          active={image?.wrap === "break"}
          onClick={() => patch({ wrap: "break", x: null, y: null })}
        >
          <WrapGlyph side="break" />
        </WrapButton>
        <WrapButton
          label="Wrap text left"
          active={image?.wrap === "left"}
          onClick={() => patch({ wrap: "left", x: null, y: null })}
        >
          <WrapGlyph side="left" />
        </WrapButton>
        <WrapButton
          label="Wrap text right"
          active={image?.wrap === "right"}
          onClick={() => patch({ wrap: "right", x: null, y: null })}
        >
          <WrapGlyph side="right" />
        </WrapButton>
        <WrapButton
          label="Behind text"
          active={image?.wrap === "behind"}
          onClick={() => patch({ wrap: "behind" })}
        >
          <WrapGlyph side="behind" />
        </WrapButton>
        <WrapButton
          label="Over text"
          active={image?.wrap === "front"}
          onClick={() => patch({ wrap: "front" })}
        >
          <WrapGlyph side="front" />
        </WrapButton>
        <span className="mx-0.5 h-5 w-px bg-border/50" aria-hidden />
        <BubbleButton
          label="Format image"
          active={formatOpen}
          onClick={() => setFormatOpen((open) => !open)}
        >
          <ImageIcon className="size-3.5" />
        </BubbleButton>
      </div>
      {formatOpen && image ? (
        <div className="flex flex-col gap-2 border-t border-border/40 px-1.5 pt-2 pb-1.5">
          <div className="flex items-center gap-0.5">
            <span className="mr-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Align
            </span>
            <WrapButton label="Align left" active={image.align === "left"} onClick={() => patch({ align: "left", x: null, y: null })}>
              <AlignLeft className="size-3.5" />
            </WrapButton>
            <WrapButton label="Align center" active={image.align === "center"} onClick={() => patch({ align: "center", x: null, y: null })}>
              <AlignCenter className="size-3.5" />
            </WrapButton>
            <WrapButton label="Align right" active={image.align === "right"} onClick={() => patch({ align: "right", x: null, y: null })}>
              <AlignRight className="size-3.5" />
            </WrapButton>
          </div>
          <ImageField
            label="Caption"
            value={image.caption}
            onChange={(caption) => patch({ caption: caption.trim() ? caption : null })}
          />
          <ImageField
            label="Alt text"
            value={image.alt}
            onChange={(alt) => patch({ alt })}
          />
          <button
            type="button"
            className="self-start rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => patch({ width: null, height: null })}
          >
            {image.width ? `Reset size (${image.width}px)` : "Reset size"}
          </button>
        </div>
      ) : null}
    </BubbleMenu>
  );
}

function WrapButton({
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
    <BubbleButton active={active} onClick={onClick} label={label}>
      {children}
    </BubbleButton>
  );
}

function WrapGlyph({ side }: { side: ImageWrap }) {
  const box = <span className="size-2 shrink-0 rounded-[2px] bg-current" />;
  const lines = (
    <span className="flex flex-1 flex-col gap-0.5">
      <span className="h-px w-full bg-current" />
      <span className="h-px w-full bg-current" />
      <span className="h-px w-2/3 bg-current" />
    </span>
  );
  if (side === "behind" || side === "front") {
    return (
      <span className="relative h-3.5 w-4">
        <span className={`absolute inset-x-0 flex flex-col gap-0.5 ${side === "front" ? "z-0 opacity-50" : "z-10"}`}>
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
          <span className="h-px w-2/3 bg-current" />
        </span>
        <span className={`absolute top-0.5 left-0.5 size-2 rounded-[2px] bg-current ${side === "front" ? "z-10" : "z-0 opacity-50"}`} />
      </span>
    );
  }
  return (
    <span className="flex h-3.5 w-4 items-center gap-0.5">
      {side === "right" ? lines : null}
      {side === "break" ? (
        <span className="flex w-full flex-col items-center gap-0.5">
          <span className="h-1.5 w-2.5 rounded-[2px] bg-current" />
          <span className="h-px w-full bg-current" />
        </span>
      ) : (
        box
      )}
      {side === "left" ? lines : null}
    </span>
  );
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        className="h-7 rounded-md bg-background px-2 text-xs font-normal tracking-normal text-foreground normal-case ring-1 ring-border/60 outline-none"
      />
    </label>
  );
}
