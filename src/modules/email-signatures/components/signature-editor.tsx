"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ImagePlus,
  Loader2,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { toast } from "sonner";
import { EditorColorPicker, TEXT_COLOR_SWATCHES } from "@/components/editor/color-picker";
import { cn } from "@/lib/utils";
import { uploadSignatureImageAction } from "@/modules/email-signatures/actions";
import {
  SIGNATURE_FIELD_GROUPS,
  SIGNATURE_FIELDS,
  SIGNATURE_FONTS,
  SIGNATURE_SIZES,
  type SignatureNode,
} from "@/modules/email-signatures/types";

const EMPTY_DOC: SignatureNode = { type: "doc", content: [{ type: "paragraph" }] };

const SELECT =
  "h-8 rounded-lg bg-transparent px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30";

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
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

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border/60" />;
}

function promptLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link to (web address, email, or phone)", previous ?? "https://");
  if (url === null) return;
  const href = url.trim();
  if (!href) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const normalized = /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(href)
    ? `mailto:${href}`
    : /^(https?:|mailto:|tel:)/i.test(href)
      ? href
      : `https://${href}`;
  editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const START_WIDTH = 200;

function naturalWidth(src: string) {
  return new Promise<number>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth || START_WIDTH);
    img.onerror = () => resolve(START_WIDTH);
    img.src = src;
  });
}

/** Uploads picked, pasted, or dropped images and inserts them at a sensible starting size. */
function useImageUpload(orgSlug: string) {
  const [uploading, setUploading] = useState(false);
  const insert = useCallback(
    async (editor: Editor, files: File[], at?: number) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (!images.length) return false;
      setUploading(true);
      try {
        for (const file of images) {
          const data = new FormData();
          data.set("file", file);
          const result = await uploadSignatureImageAction(orgSlug, data);
          if ("error" in result) {
            toast.error(result.error);
            continue;
          }
          const width = Math.min(await naturalWidth(result.url), START_WIDTH);
          const chain = editor.chain().focus();
          (at !== undefined ? chain.insertContentAt(at, { type: "image", attrs: { src: result.url, alt: "", width } }) : chain.setImage({ src: result.url, alt: "", width })).run();
        }
      } finally {
        setUploading(false);
      }
      return true;
    },
    [orgSlug],
  );
  return { uploading, insert };
}

function Toolbar({
  editor,
  uploading,
  onPickImage,
}: {
  editor: Editor;
  uploading: boolean;
  onPickImage: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      link: current.isActive("link"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      center: current.isActive({ textAlign: "center" }),
      right: current.isActive({ textAlign: "right" }),
      color: (current.getAttributes("textStyle").color as string | undefined) ?? null,
      font: (current.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      size: (current.getAttributes("textStyle").fontSize as string | undefined) ?? "",
    }),
  });

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 bg-muted/20 px-2 py-1.5">
      <select
        aria-label="Font"
        className={cn(SELECT, "max-w-28")}
        value={state.font}
        onChange={(event) => {
          const value = event.target.value;
          if (value) editor.chain().focus().setFontFamily(value).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
      >
        <option value="">Default font</option>
        {SIGNATURE_FONTS.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Size"
        className={SELECT}
        value={state.size}
        onChange={(event) => {
          const value = event.target.value;
          if (value) editor.chain().focus().setFontSize(value).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
      >
        {SIGNATURE_SIZES.map((size) => (
          <option key={size.label} value={size.value}>
            {size.label}
          </option>
        ))}
      </select>
      <Divider />
      <ToolButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-3.5" />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-3.5" />
      </ToolButton>
      <ToolButton
        label="Underline"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" />
      </ToolButton>
      <EditorColorPicker
        label="Text colour"
        value={state.color}
        swatches={TEXT_COLOR_SWATCHES}
        onChange={(color) => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <Divider />
      <ToolButton label="Link" active={state.link} onClick={() => promptLink(editor)}>
        <Link2 className="size-3.5" />
      </ToolButton>
      <ToolButton label={uploading ? "Uploading image…" : "Insert image"} onClick={onPickImage}>
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
      </ToolButton>
      <Divider />
      <ToolButton
        label="Align left"
        active={!state.center && !state.right}
        onClick={() => editor.chain().focus().unsetTextAlign().run()}
      >
        <AlignLeft className="size-3.5" />
      </ToolButton>
      <ToolButton
        label="Align centre"
        active={state.center}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-3.5" />
      </ToolButton>
      <ToolButton
        label="Align right"
        active={state.right}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-3.5" />
      </ToolButton>
      <ToolButton
        label="Bulleted list"
        active={state.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolButton>
      <Divider />
      <ToolButton
        label="Remove formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().unsetTextAlign().run()}
      >
        <RemoveFormatting className="size-3.5" />
      </ToolButton>
    </div>
  );
}

type SignatureField = (typeof SIGNATURE_FIELDS)[number];
type AtMenu = { query: string; from: number; to: number; left: number; top: number };

/** `@` after a space or at line start opens the field menu; emails like a@b.com don't. */
function findAtQuery(editor: Editor, dismissedFrom: number | null): AtMenu | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const match = /(?:^|\s)@([a-z_]{0,20})$/i.exec(before);
  if (!match) return null;
  const from = selection.from - match[1].length - 1;
  if (from === dismissedFrom) return null;
  const coords = editor.view.coordsAtPos(from);
  return { query: match[1], from, to: selection.from, left: coords.left, top: coords.bottom };
}

/** "Studio legal name" reads "Legal name" in its group's chip row. */
function chipLabel(label: string) {
  const short = label.replace(/^(Your|Studio) /, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function matchFields(query: string): SignatureField[] {
  const q = query.toLowerCase();
  return SIGNATURE_FIELDS.filter(
    (field) => field.key.includes(q) || field.label.toLowerCase().includes(q),
  );
}

function FieldMenu({
  menu,
  items,
  active,
  onHover,
  onPick,
}: {
  menu: AtMenu;
  items: SignatureField[];
  active: number;
  onHover: (index: number) => void;
  onPick: (field: SignatureField) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label="Insert a field"
      style={{ left: menu.left, top: menu.top + 6 }}
      className="absolute z-[80] w-60 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      data-slot="search-select-popup"
    >
      <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Insert field
      </p>
      {items.length === 0 ? (
        <p className="px-2.5 py-2 text-sm text-muted-foreground">No matching field</p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {items.map((field, index) => (
            <Fragment key={field.key}>
              {index === 0 || items[index - 1].group !== field.group ? (
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground first:pt-0">
                  {SIGNATURE_FIELD_GROUPS.find((group) => group.id === field.group)?.label}
                </p>
              ) : null}
              <button
                ref={index === active ? (node) => node?.scrollIntoView({ block: "nearest" }) : undefined}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onHover(index)}
                onClick={() => onPick(field)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                  index === active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span className="truncate">{field.label}</span>
                <code className="shrink-0 text-[11px] text-muted-foreground">{`{{${field.key}}}`}</code>
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/** Gmail-style signature editor: fonts, sizes, colours, links, images, and sender fields. */
export function SignatureEditor({
  orgSlug,
  value,
  onChange,
  placeholder = "Your name, title, phone… Drop or paste a logo, or use the image button.",
}: {
  orgSlug: string;
  value: SignatureNode | null;
  onChange: (doc: SignatureNode) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { uploading, insert } = useImageUpload(orgSlug);
  const insertRef = useRef(insert);
  const editorRef = useRef<Editor | null>(null);
  const [atMenu, setAtMenu] = useState<AtMenu | null>(null);
  const [atActive, setAtActive] = useState(0);
  const dismissedRef = useRef<number | null>(null);
  const atItems = useMemo(() => (atMenu ? matchFields(atMenu.query) : []), [atMenu]);
  const atRef = useRef({ menu: atMenu, items: atItems, active: atActive });

  const syncAtMenu = useCallback((current: Editor) => {
    const found = findAtQuery(current, dismissedRef.current);
    if (!found) dismissedRef.current = null;
    const box = rootRef.current?.getBoundingClientRect();
    const next =
      found && box ? { ...found, left: found.left - box.left, top: found.top - box.top } : found;
    if (atRef.current.menu?.query !== next?.query) setAtActive(0);
    setAtMenu(next);
  }, []);

  const pickField = useCallback((field: SignatureField) => {
    const current = editorRef.current;
    const menu = atRef.current.menu;
    if (!current || !menu) return;
    current.chain().focus().insertContentAt({ from: menu.from, to: menu.to }, `{{${field.key}}}`).run();
    setAtMenu(null);
  }, []);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right"] }),
      Image.configure({
        inline: true,
        resize: {
          enabled: true,
          directions: ["bottom-right", "right", "left", "bottom-left"],
          minWidth: 24,
          minHeight: 24,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      handleKeyDown: (_view, event) => {
        const { menu, items, active } = atRef.current;
        if (!menu) return false;
        if (event.key === "Escape") {
          event.stopPropagation();
          dismissedRef.current = menu.from;
          setAtMenu(null);
          return true;
        }
        if (!items.length) return false;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1;
          setAtActive((active + step + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          pickField(items[active] ?? items[0]);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!editorRef.current || !files.some((file) => file.type.startsWith("image/"))) return false;
        void insertRef.current(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!editorRef.current || !files.some((file) => file.type.startsWith("image/"))) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertRef.current(editorRef.current, files, at);
        return true;
      },
      attributes: {
        class:
          "min-h-32 max-w-none px-4 py-3 text-[13px] leading-5 text-[#3d444d] focus:outline-none [&_a]:text-[#1a73e8] [&_a]:underline [&_img]:inline-block [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:min-h-5 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: current }) => {
      // ProseMirror attrs have no prototype, which server actions can't receive.
      onChange(JSON.parse(JSON.stringify(current.getJSON())) as SignatureNode);
      syncAtMenu(current);
    },
    onSelectionUpdate: ({ editor: current }) => syncAtMenu(current),
    onBlur: () => setAtMenu(null),
  });
  useEffect(() => {
    insertRef.current = insert;
    editorRef.current = editor ?? null;
  }, [editor, insert]);
  useEffect(() => {
    atRef.current = { menu: atMenu, items: atItems, active: atActive };
  }, [atMenu, atItems, atActive]);

  useEffect(() => {
    if (!editor || !value) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-44 rounded-2xl bg-muted/40 ring-1 ring-border/40" aria-hidden />;
  }

  return (
    <div ref={rootRef} className="relative grid gap-2">
      <div className="overflow-hidden rounded-2xl ring-1 ring-border/50 focus-within:ring-2 focus-within:ring-ring/25">
        <Toolbar editor={editor} uploading={uploading} onPickImage={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void insert(editor, files);
          }}
        />
        <div className="signature-editor bg-white">
          <EditorContent editor={editor} />
        </div>
        {atMenu ? (
          <FieldMenu
            menu={atMenu}
            items={atItems}
            active={atActive}
            onHover={setAtActive}
            onPick={pickField}
          />
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Braces className="size-3" />
          Type @ or insert a field
        </span>
        {SIGNATURE_FIELD_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-wrap items-center gap-1.5">
            <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{group.label}</span>
            {SIGNATURE_FIELDS.filter((field) => field.group === group.id).map((field) => (
              <button
                key={field.key}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().insertContent(`{{${field.key}}}`).run()}
                className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/40 transition-colors hover:bg-muted hover:text-foreground"
              >
                {chipLabel(field.label)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
