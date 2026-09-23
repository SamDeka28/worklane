"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BetweenHorizonalEnd,
  BetweenVerticalEnd,
  Bold,
  Grid2X2X,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Paperclip,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  ALargeSmall,
} from "lucide-react";
import {
  EditorColorPicker,
  HIGHLIGHT_COLOR_SWATCHES,
  TEXT_COLOR_SWATCHES,
} from "@/components/editor/color-picker";
import {
  bumpFontSize,
  currentFontSize,
  DOCUMENT_FONTS,
  FONT_SIZE_STEPS,
} from "@/components/editor/document-typography";
import { cn } from "@/lib/utils";

function ToolbarButton({
  active,
  onClick,
  children,
  label,
  className,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-muted text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border/50" aria-hidden />;
}

function ToolbarSelect({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 max-w-[9.5rem] rounded-lg border-0 bg-transparent px-1.5 text-xs font-medium text-foreground outline-none ring-1 ring-border/50 hover:bg-muted focus:ring-2 focus:ring-ring/30",
          className,
        )}
      >
        {children}
      </select>
    </label>
  );
}

function InsertTableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ rows: 3, cols: 3 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <ToolbarButton
        label="Insert table"
        active={open || editor.isActive("table")}
        onClick={() => setOpen((value) => !value)}
      >
        <Table2 className="size-3.5" />
      </ToolbarButton>
      {open ? (
        <div className="absolute top-full left-0 z-40 mt-1 rounded-xl bg-card p-2 shadow-lift ring-1 ring-border/50">
          <p className="mb-1.5 px-0.5 text-[10px] font-medium text-muted-foreground">
            {hover.rows} × {hover.cols}
          </p>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}
            onMouseLeave={() => setHover({ rows: 3, cols: 3 })}
          >
            {Array.from({ length: 64 }, (_, index) => {
              const row = Math.floor(index / 8) + 1;
              const col = (index % 8) + 1;
              const active = row <= hover.rows && col <= hover.cols;
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={`${row} by ${col} table`}
                  className={cn(
                    "size-4 rounded-[2px] border",
                    active
                      ? "border-sky-600 bg-sky-500/80"
                      : "border-border/60 bg-muted/40",
                  )}
                  onMouseEnter={() => setHover({ rows: row, cols: col })}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .insertTable({
                        rows: hover.rows,
                        cols: hover.cols,
                        withHeaderRow: true,
                      })
                      .run();
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TableEditControls({ editor }: { editor: Editor }) {
  if (!editor.isActive("table")) return null;

  return (
    <>
      <ToolbarDivider />
      <span className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Table
      </span>
      <ToolbarButton
        label="Add column after"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <BetweenVerticalEnd className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Add row after"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <BetweenHorizonalEnd className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Delete column"
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        <span className="px-0.5 text-[10px] font-bold">−Col</span>
      </ToolbarButton>
      <ToolbarButton
        label="Delete row"
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        <span className="px-0.5 text-[10px] font-bold">−Row</span>
      </ToolbarButton>
      <ToolbarButton
        label="Delete table"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Grid2X2X className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Toggle header row"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      >
        <span className="px-0.5 text-[10px] font-bold">Hdr</span>
      </ToolbarButton>
    </>
  );
}

export function DocumentToolbar({
  editor,
  orgSlug,
  entityType,
  entityId,
  uploading,
  onAttachClick,
}: {
  editor: Editor;
  orgSlug?: string;
  entityType?: string;
  entityId?: string;
  uploading?: boolean;
  onAttachClick?: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onSelection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((value) => value + 1));
    };
    editor.on("selectionUpdate", onSelection);
    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor]);

  const fontFamily =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";
  const fontSize = currentFontSize(editor);
  const textColor =
    (editor.getAttributes("textStyle").color as string | undefined) ?? null;
  const highlightColor =
    (editor.getAttributes("highlight").color as string | undefined) ?? null;
  const knownFamily = DOCUMENT_FONTS.some((f) => f.value === fontFamily)
    ? fontFamily
    : fontFamily
      ? "__custom__"
      : "";
  const knownSize = (FONT_SIZE_STEPS as readonly string[]).includes(fontSize)
    ? fontSize
    : "__custom__";

  return (
    <div className="flex flex-wrap items-center justify-center gap-0.5 px-2.5 py-1.5 sm:justify-start">
      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarSelect
        label="Font"
        value={knownFamily}
        className="max-w-[7.5rem]"
        onChange={(value) => {
          if (!value) {
            editor.chain().focus().unsetFontFamily().run();
            return;
          }
          if (value === "__custom__") return;
          editor.chain().focus().setFontFamily(value).run();
        }}
      >
        <option value="">Default</option>
        {DOCUMENT_FONTS.map((font) => (
          <option key={font.label} value={font.value}>
            {font.label}
          </option>
        ))}
        {knownFamily === "__custom__" ? <option value="__custom__">Custom</option> : null}
      </ToolbarSelect>

      <ToolbarSelect
        label="Font size"
        value={knownSize}
        className="max-w-[4.5rem]"
        onChange={(value) => {
          if (value === "__custom__") return;
          editor.chain().focus().setFontSize(value).run();
        }}
      >
        {FONT_SIZE_STEPS.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
        {knownSize === "__custom__" ? (
          <option value="__custom__">{fontSize.replace("px", "")}</option>
        ) : null}
      </ToolbarSelect>

      <ToolbarButton label="Decrease font size (⌘⇧,)" onClick={() => bumpFontSize(editor, -1)}>
        <span className="text-[11px] font-semibold leading-none">A−</span>
      </ToolbarButton>
      <ToolbarButton label="Increase font size (⌘⇧.)" onClick={() => bumpFontSize(editor, 1)}>
        <ALargeSmall className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {([1, 2, 3] as const).map((level) => (
        <ToolbarButton
          key={level}
          label={`Heading ${level}`}
          active={editor.isActive("heading", { level })}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          className="px-2 text-[11px] font-semibold"
        >
          H{level}
        </ToolbarButton>
      ))}

      <ToolbarDivider />

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
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>

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

      <ToolbarDivider />

      <ToolbarButton
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="size-3.5" />
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
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

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
      <InsertTableMenu editor={editor} />
      <TableEditControls editor={editor} />
      {orgSlug && entityType && entityId && onAttachClick ? (
        <ToolbarButton label="Attach file" onClick={onAttachClick}>
          <Paperclip className="size-3.5" />
        </ToolbarButton>
      ) : null}
      {uploading ? (
        <span className="px-2 text-xs text-muted-foreground">Uploading…</span>
      ) : null}
    </div>
  );
}
