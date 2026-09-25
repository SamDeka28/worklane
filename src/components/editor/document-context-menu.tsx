"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import {
  Bold,
  CheckSquare,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Scissors,
  SquareDashedMousePointer,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MenuItem =
  | {
      kind: "item";
      label: string;
      icon?: LucideIcon;
      shortcut?: string;
      disabled?: boolean;
      active?: boolean;
      danger?: boolean;
      run: () => void;
    }
  | { kind: "submenu"; label: string; icon?: LucideIcon; items: MenuItem[] }
  | { kind: "separator" };

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? "⌘" : "Ctrl+";
const SHIFT = isMac ? "⇧" : "Shift+";

function runNative(editor: Editor, command: "cut" | "copy") {
  editor.view.focus();
  const ok = document.execCommand(command);
  if (!ok) toast.message(`Use ${MOD}${command === "cut" ? "X" : "C"} to ${command}.`);
}

async function pasteFromClipboard(editor: Editor, plain: boolean) {
  editor.view.focus();
  try {
    if (!plain && typeof navigator.clipboard.read === "function") {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) {
          const html = await (await item.getType("text/html")).text();
          editor.view.pasteHTML(html);
          return;
        }
      }
    }
    const text = await navigator.clipboard.readText();
    if (text) editor.view.pasteText(text);
  } catch {
    toast.message(
      `Your browser blocked clipboard access. Use ${MOD}${plain ? SHIFT : ""}V instead.`,
    );
  }
}

function buildItems(editor: Editor): MenuItem[] {
  const chain = () => editor.chain().focus();
  const hasSelection = !editor.state.selection.empty;
  const inTable = editor.isActive("table");
  const inLink = editor.isActive("link");

  const items: MenuItem[] = [
    {
      kind: "item",
      label: "Cut",
      icon: Scissors,
      shortcut: `${MOD}X`,
      disabled: !hasSelection,
      run: () => runNative(editor, "cut"),
    },
    {
      kind: "item",
      label: "Copy",
      icon: Copy,
      shortcut: `${MOD}C`,
      disabled: !hasSelection,
      run: () => runNative(editor, "copy"),
    },
    {
      kind: "item",
      label: "Paste",
      icon: ClipboardPaste,
      shortcut: `${MOD}V`,
      run: () => void pasteFromClipboard(editor, false),
    },
    {
      kind: "item",
      label: "Paste without formatting",
      shortcut: `${MOD}${SHIFT}V`,
      run: () => void pasteFromClipboard(editor, true),
    },
    {
      kind: "item",
      label: "Delete",
      icon: Trash2,
      disabled: !hasSelection,
      run: () => chain().deleteSelection().run(),
    },
    { kind: "separator" },
    inLink
      ? {
          kind: "item",
          label: "Remove link",
          icon: Unlink,
          run: () => chain().extendMarkRange("link").unsetLink().run(),
        }
      : {
          kind: "item",
          label: "Insert link",
          icon: Link2,
          shortcut: `${MOD}K`,
          run: () => {
            const href = window.prompt("Link URL", "https://");
            if (!href || href === "https://") return;
            if (hasSelection) chain().extendMarkRange("link").setLink({ href }).run();
            else chain().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
          },
        },
    { kind: "separator" },
    {
      kind: "submenu",
      label: "Format text",
      icon: Bold,
      items: [
        {
          kind: "item",
          label: "Bold",
          icon: Bold,
          shortcut: `${MOD}B`,
          active: editor.isActive("bold"),
          run: () => chain().toggleBold().run(),
        },
        {
          kind: "item",
          label: "Italic",
          icon: Italic,
          shortcut: `${MOD}I`,
          active: editor.isActive("italic"),
          run: () => chain().toggleItalic().run(),
        },
        {
          kind: "item",
          label: "Underline",
          icon: Underline,
          shortcut: `${MOD}U`,
          active: editor.isActive("underline"),
          run: () => chain().toggleUnderline().run(),
        },
        {
          kind: "item",
          label: "Strikethrough",
          icon: Strikethrough,
          shortcut: `${MOD}${SHIFT}S`,
          active: editor.isActive("strike"),
          run: () => chain().toggleStrike().run(),
        },
      ],
    },
    {
      kind: "submenu",
      label: "Paragraph style",
      icon: Pilcrow,
      items: [
        {
          kind: "item",
          label: "Normal text",
          icon: Pilcrow,
          active: editor.isActive("paragraph"),
          run: () => chain().setParagraph().run(),
        },
        ...([1, 2, 3] as const).map<MenuItem>((level) => ({
          kind: "item",
          label: `Heading ${level}`,
          icon: level === 1 ? Heading1 : level === 2 ? Heading2 : Heading3,
          active: editor.isActive("heading", { level }),
          run: () => chain().toggleHeading({ level }).run(),
        })),
        {
          kind: "item",
          label: "Quote",
          icon: Quote,
          active: editor.isActive("blockquote"),
          run: () => chain().toggleBlockquote().run(),
        },
      ],
    },
    {
      kind: "submenu",
      label: "Lists",
      icon: List,
      items: [
        {
          kind: "item",
          label: "Bulleted list",
          icon: List,
          shortcut: `${MOD}${SHIFT}8`,
          active: editor.isActive("bulletList"),
          run: () => chain().toggleBulletList().run(),
        },
        {
          kind: "item",
          label: "Numbered list",
          icon: ListOrdered,
          shortcut: `${MOD}${SHIFT}7`,
          active: editor.isActive("orderedList"),
          run: () => chain().toggleOrderedList().run(),
        },
        {
          kind: "item",
          label: "Checklist",
          icon: CheckSquare,
          shortcut: `${MOD}${SHIFT}9`,
          active: editor.isActive("taskList"),
          run: () => chain().toggleTaskList().run(),
        },
      ],
    },
    {
      kind: "submenu",
      label: "Insert",
      icon: Table2,
      items: [
        {
          kind: "item",
          label: "Table (3 × 3)",
          icon: Table2,
          disabled: inTable,
          run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        },
        {
          kind: "item",
          label: "Horizontal line",
          icon: Minus,
          run: () => chain().setHorizontalRule().run(),
        },
      ],
    },
  ];

  if (inTable) {
    items.push(
      { kind: "separator" },
      {
        kind: "item",
        label: "Insert row above",
        run: () => chain().addRowBefore().run(),
      },
      {
        kind: "item",
        label: "Insert row below",
        run: () => chain().addRowAfter().run(),
      },
      {
        kind: "item",
        label: "Insert column left",
        run: () => chain().addColumnBefore().run(),
      },
      {
        kind: "item",
        label: "Insert column right",
        run: () => chain().addColumnAfter().run(),
      },
      {
        kind: "submenu",
        label: "More table options",
        icon: Table2,
        items: [
          {
            kind: "item",
            label: "Merge cells",
            disabled: !editor.can().mergeCells(),
            run: () => chain().mergeCells().run(),
          },
          {
            kind: "item",
            label: "Unmerge cells",
            disabled: !editor.can().splitCell(),
            run: () => chain().splitCell().run(),
          },
          {
            kind: "item",
            label: "Toggle header row",
            run: () => chain().toggleHeaderRow().run(),
          },
          { kind: "separator" },
          {
            kind: "item",
            label: "Delete row",
            danger: true,
            run: () => chain().deleteRow().run(),
          },
          {
            kind: "item",
            label: "Delete column",
            danger: true,
            run: () => chain().deleteColumn().run(),
          },
          {
            kind: "item",
            label: "Delete table",
            danger: true,
            run: () => chain().deleteTable().run(),
          },
        ],
      },
    );
  }

  items.push(
    { kind: "separator" },
    {
      kind: "item",
      label: "Select all",
      icon: SquareDashedMousePointer,
      shortcut: `${MOD}A`,
      run: () => chain().selectAll().run(),
    },
    {
      kind: "item",
      label: "Clear formatting",
      icon: Eraser,
      shortcut: `${MOD}\\`,
      run: () => chain().unsetAllMarks().clearNodes().run(),
    },
  );

  return items;
}

type MenuState = { x: number; y: number; items: MenuItem[] };

/** Google Docs-style right-click menu for the document editor. */
export function DocumentContextMenu({ editor }: { editor: Editor }) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    const onContextMenu = (event: MouseEvent) => {
      if (!editor.isEditable) return;
      if (event.shiftKey) return;
      event.preventDefault();
      const { view } = editor;
      const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
      const { from, to, empty } = view.state.selection;
      if (hit && (empty || hit.pos < from || hit.pos > to)) {
        const $pos = view.state.doc.resolve(hit.pos);
        view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)));
      }
      view.focus();
      setMenu({ x: event.clientX, y: event.clientY, items: buildItems(editor) });
    };
    dom.addEventListener("contextmenu", onContextMenu);
    return () => dom.removeEventListener("contextmenu", onContextMenu);
  }, [editor]);

  const close = useCallback(() => setMenu(null), []);

  if (!menu || typeof document === "undefined") return null;
  return createPortal(
    <ContextMenuLayer menu={menu} onClose={close} />,
    document.body,
  );
}

function ContextMenuLayer({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    const onScroll = () => onClose();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", onScroll);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <MenuPanel items={menu.items} x={menu.x} y={menu.y} onClose={onClose} autoFocus />
    </div>
  );
}

function MenuPanel({
  items,
  x,
  y,
  onClose,
  autoFocus = false,
  flipFrom,
}: {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
  autoFocus?: boolean;
  /** Left edge of the parent panel, used to open submenus leftwards near the viewport edge. */
  flipFrom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [openSub, setOpenSub] = useState<{ index: number; x: number; y: number; flip: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - margin) {
      left = flipFrom !== undefined ? flipFrom - rect.width : window.innerWidth - rect.width - margin;
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    setPos({ left: Math.max(margin, left), top });
    if (autoFocus) el.focus();
  }, [x, y, flipFrom, autoFocus]);

  function focusSibling(direction: 1 | -1) {
    const nodes = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(":scope > [role=menuitem]:not(:disabled)") ?? [],
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next = nodes[(index + direction + nodes.length) % nodes.length];
    next?.focus();
  }

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      className="fixed min-w-[15rem] rounded-xl border border-border/60 bg-popover p-1 text-sm text-popover-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] outline-none"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusSibling(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusSibling(-1);
        }
      }}
    >
      {items.map((item, index) => {
        if (item.kind === "separator") {
          return <div key={`sep-${index}`} className="my-1 h-px bg-border/60" />;
        }
        const Icon = item.icon;
        if (item.kind === "submenu") {
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openSub?.index === index}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted",
                openSub?.index === index && "bg-muted",
              )}
              onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const panel = ref.current?.getBoundingClientRect();
                setOpenSub({ index, x: (panel?.right ?? rect.right) - 2, y: rect.top - 5, flip: (panel?.left ?? rect.left) + 2 });
              }}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const panel = ref.current?.getBoundingClientRect();
                setOpenSub({ index, x: (panel?.right ?? rect.right) - 2, y: rect.top - 5, flip: (panel?.left ?? rect.left) + 2 });
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <span className="flex size-4 items-center justify-center text-muted-foreground">
                {Icon ? <Icon className="size-4" /> : null}
              </span>
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-40",
              item.danger && "text-destructive",
            )}
            onMouseEnter={() => setOpenSub(null)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center",
                item.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {Icon ? <Icon className="size-4" /> : null}
            </span>
            <span className={cn("flex-1", item.active && "font-medium")}>{item.label}</span>
            {item.shortcut ? (
              <span className="text-xs text-muted-foreground tabular-nums">{item.shortcut}</span>
            ) : null}
          </button>
        );
      })}
      {openSub && items[openSub.index]?.kind === "submenu" ? (
        <MenuPanel
          key={openSub.index}
          items={(items[openSub.index] as Extract<MenuItem, { kind: "submenu" }>).items}
          x={openSub.x}
          y={openSub.y}
          flipFrom={openSub.flip}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}
