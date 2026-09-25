import type { Editor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import type { MutableRefObject } from "react";

export type MentionItem = {
  id: string;
  label: string;
  type: string;
  /** When true, selecting runs onCreateMention instead of inserting immediately. */
  create?: boolean;
  avatarUrl?: string | null;
};

export type CreateMentionFn = (
  type: string,
  query: string,
) => Promise<MentionItem | null | undefined>;

const TYPE_TONE: Record<string, string> = {
  member: "bg-fuchsia-100 text-fuchsia-800",
  partner: "bg-teal-100 text-teal-800",
  client: "bg-emerald-100 text-emerald-800",
  lead: "bg-orange-100 text-orange-800",
  project: "bg-sky-100 text-sky-800",
  milestone: "bg-violet-100 text-violet-800",
  task: "bg-amber-100 text-amber-900",
};

const TYPE_ORDER = ["member", "partner", "client", "lead", "project", "milestone", "task"];

const TYPE_SECTION: Record<string, string> = {
  member: "People",
  partner: "Partners",
  client: "Clients",
  lead: "Leads",
  project: "Projects",
  milestone: "Milestones",
  task: "Tasks",
};

const TYPE_BADGE: Record<string, string> = { member: "person" };

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : label.slice(0, 2);
  return letters.toUpperCase();
}

function personAvatar(item: MentionItem, tone: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = `flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ${tone}`;
  const fallback = () => {
    wrap.textContent = initials(item.label);
  };
  if (item.avatarUrl) {
    const img = document.createElement("img");
    img.src = item.avatarUrl;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.className = "size-full object-cover";
    img.onerror = () => {
      img.remove();
      fallback();
    };
    wrap.appendChild(img);
  } else {
    fallback();
  }
  return wrap;
}

const PER_TYPE_EMPTY_QUERY = 4;
const PER_TYPE = 6;

function rank(item: MentionItem, q: string): number | null {
  if (!q) return 0;
  const label = item.label.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.split(/[\s\-_/.]+/).some((word) => word.startsWith(q))) return 1;
  if (label.includes(q)) return 2;
  if ((TYPE_SECTION[item.type] ?? item.type).toLowerCase().startsWith(q)) return 3;
  return null;
}

function typeIndex(type: string) {
  const index = TYPE_ORDER.indexOf(type);
  return index < 0 ? TYPE_ORDER.length : index;
}

export const TypedMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-type"),
        renderHTML: (attributes) => {
          if (!attributes.type) return {};
          return { "data-type": attributes.type };
        },
      },
    };
  },
});

export function configureTypedMention(
  mentionsRef: MutableRefObject<MentionItem[]>,
  createRef: MutableRefObject<CreateMentionFn | undefined>,
) {
  return TypedMention.configure({
    HTMLAttributes: {
      class: "rounded-md bg-sky-100 px-1.5 py-0.5 font-medium text-sky-900 not-italic",
    },
    renderLabel({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      items: ({ query }) => {
        const q = query.trim().toLowerCase();
        const perType = q ? PER_TYPE : PER_TYPE_EMPTY_QUERY;
        const scored = mentionsRef.current
          .filter((item) => !item.create)
          .map((item) => ({ item, score: rank(item, q) }))
          .filter((row): row is { item: MentionItem; score: number } => row.score !== null)
          .sort(
            (a, b) =>
              typeIndex(a.item.type) - typeIndex(b.item.type) ||
              a.score - b.score ||
              a.item.label.localeCompare(b.item.label),
          );
        const counts = new Map<string, number>();
        const matches: MentionItem[] = [];
        for (const { item } of scored) {
          const count = counts.get(item.type) ?? 0;
          if (count >= perType) continue;
          counts.set(item.type, count + 1);
          matches.push(item);
        }
        const createItems = mentionsRef.current
          .filter((item) => item.create)
          .map((item) => ({
            ...item,
            label: query.trim()
              ? `Create ${item.type} “${query.trim()}”`
              : `Create ${item.type}…`,
          }));
        return [...matches, ...createItems];
      },
      render: () => {
        const state: {
          element: HTMLDivElement | null;
          props: MentionListProps | null;
          index: number;
        } = { element: null, props: null, index: 0 };
        const draw = () => {
          if (state.element && state.props) {
            renderMentionList(state.element, state.props, createRef, state.index);
          }
        };
        return {
          onStart: (props) => {
            state.element = document.createElement("div");
            state.element.className =
              "pointer-events-auto z-[100] w-[min(100vw-2rem,21rem)] overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-lift ring-1 ring-border";
            document.body.appendChild(state.element);
            state.props = props;
            state.index = 0;
            draw();
          },
          onUpdate: (props) => {
            state.props = props;
            state.index = 0;
            draw();
          },
          onKeyDown: ({ event }) => {
            const items = state.props?.items ?? [];
            if (event.key === "Escape") {
              state.element?.remove();
              return true;
            }
            if (items.length === 0) return false;
            if (event.key === "ArrowDown") {
              state.index = (state.index + 1) % items.length;
              draw();
              return true;
            }
            if (event.key === "ArrowUp") {
              state.index = (state.index - 1 + items.length) % items.length;
              draw();
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              if (event.metaKey || event.ctrlKey) return false;
              const item = items[state.index];
              if (item && state.element && state.props) {
                void selectMention(item, state.props, state.element, createRef);
              }
              return true;
            }
            return false;
          },
          onExit: () => {
            state.element?.remove();
            state.element = null;
            state.props = null;
          },
        };
      },
    },
  });
}

type MentionListProps = {
  items: MentionItem[];
  query: string;
  editor: Editor;
  range: { from: number; to: number };
  command: (item: { id: string; label: string; type?: string }) => void;
  clientRect?: (() => DOMRect | null) | null;
};

async function selectMention(
  item: MentionItem,
  props: MentionListProps,
  element: HTMLDivElement,
  createRef: MutableRefObject<CreateMentionFn | undefined>,
) {
  if (!item.create) {
    props.command({ id: item.id, label: item.label, type: item.type });
    return;
  }
  const range = { from: props.range.from, to: props.range.to };
  const editor = props.editor;
  element.remove();
  const created = await createRef.current?.(item.type, props.query);
  if (!created) {
    editor.chain().focus().run();
    return;
  }
  editor
    .chain()
    .focus()
    .insertContentAt(range, [
      { type: "mention", attrs: { id: created.id, label: created.label, type: created.type } },
      { type: "text", text: " " },
    ])
    .run();
}

function renderMentionList(
  element: HTMLDivElement,
  props: MentionListProps,
  createRef: MutableRefObject<CreateMentionFn | undefined>,
  activeIndex: number,
) {
  element.innerHTML = "";
  const rect = props.clientRect?.() ?? null;

  if (props.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "px-4 py-3 text-sm text-muted-foreground";
    empty.textContent = props.query.trim() ? `Nothing matches “${props.query.trim()}”` : "Nothing to tag yet";
    element.appendChild(empty);
    positionMentionList(element, rect);
    return;
  }

  const header = document.createElement("div");
  header.className =
    "flex items-center justify-between border-b border-border/60 px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase";
  const headerLabel = document.createElement("span");
  headerLabel.textContent = props.query.trim() ? `Matching “${props.query.trim()}”` : "Tag someone or something";
  const hint = document.createElement("span");
  hint.className = "font-normal tracking-normal normal-case";
  hint.textContent = "↑↓ to move · ↵ to tag";
  header.append(headerLabel, hint);
  element.appendChild(header);

  const list = document.createElement("div");
  list.className = "max-h-72 overflow-y-auto p-1.5";
  list.setAttribute("role", "listbox");

  let lastSection = "";
  let activeButton: HTMLButtonElement | null = null;
  props.items.forEach((item, index) => {
    const section = item.create ? "Create" : (TYPE_SECTION[item.type] ?? "Other");
    if (section !== lastSection) {
      lastSection = section;
      const label = document.createElement("p");
      label.className =
        "px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-[0.06em] text-muted-foreground uppercase first:pt-1";
      label.textContent = section;
      list.appendChild(label);
    }
    const active = index === activeIndex;
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(active));
    button.className = `flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted ${active ? "bg-muted" : ""}`;
    const tone = TYPE_TONE[item.type] ?? "bg-muted text-muted-foreground";
    const typeBadge =
      !item.create && (item.type === "member" || item.type === "partner")
        ? personAvatar(item, tone)
        : document.createElement("span");
    if (!typeBadge.className) {
      typeBadge.className = `shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`;
      typeBadge.textContent = item.create ? "New" : (TYPE_BADGE[item.type] ?? item.type);
    }
    const name = document.createElement("span");
    name.className = "min-w-0 flex-1 truncate text-sm font-medium";
    name.textContent = item.create
      ? props.query.trim()
        ? `${item.type}: ${props.query.trim()}`
        : `New ${item.type}`
      : item.label;
    button.append(typeBadge, name);
    button.onmousedown = (event) => event.preventDefault();
    button.onclick = () => void selectMention(item, props, element, createRef);
    if (active) activeButton = button;
    list.appendChild(button);
  });

  element.appendChild(list);
  positionMentionList(element, rect);
  (activeButton as HTMLButtonElement | null)?.scrollIntoView({ block: "nearest" });
}

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 12;

/** Fixed to the caret; flips above when there's no room below and caps height to fit. */
function positionMentionList(element: HTMLDivElement, rect: DOMRect | null) {
  if (!rect) return;
  const list = element.lastElementChild as HTMLElement | null;
  element.style.position = "fixed";
  element.style.visibility = "hidden";
  element.style.top = "0px";
  element.style.left = "0px";
  if (list) list.style.maxHeight = "";

  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
  const natural = element.offsetHeight;
  const placeAbove = natural > spaceBelow && spaceAbove > spaceBelow;
  const available = Math.max(placeAbove ? spaceAbove : spaceBelow, 120);

  if (list && natural > available) {
    const chrome = natural - list.offsetHeight;
    list.style.maxHeight = `${Math.max(available - chrome, 72)}px`;
  }
  const height = element.offsetHeight;
  const width = element.offsetWidth;

  const top = placeAbove ? rect.top - MENU_GAP - height : rect.bottom + MENU_GAP;
  const left = Math.min(
    Math.max(rect.left, VIEWPORT_MARGIN),
    window.innerWidth - width - VIEWPORT_MARGIN,
  );
  element.style.top = `${Math.max(top, VIEWPORT_MARGIN)}px`;
  element.style.left = `${left}px`;
  element.style.visibility = "";
}
