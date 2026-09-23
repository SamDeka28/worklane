import type { Editor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import type { MutableRefObject } from "react";

export type MentionItem = {
  id: string;
  label: string;
  type: string;
  /** When true, selecting runs onCreateMention instead of inserting immediately. */
  create?: boolean;
};

export type CreateMentionFn = (
  type: string,
  query: string,
) => Promise<MentionItem | null | undefined>;

const TYPE_TONE: Record<string, string> = {
  client: "bg-emerald-100 text-emerald-800",
  project: "bg-sky-100 text-sky-800",
  milestone: "bg-violet-100 text-violet-800",
  task: "bg-amber-100 text-amber-900",
};

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
        const q = query.toLowerCase();
        const catalog = mentionsRef.current;
        const matches = catalog
          .filter(
            (item) =>
              !item.create &&
              (item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)),
          )
          .slice(0, 8);
        const createItems = catalog
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
        const state: { element: HTMLDivElement | null } = { element: null };
        return {
          onStart: (props) => {
            state.element = document.createElement("div");
            state.element.className =
              "z-50 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl bg-card shadow-lift ring-1 ring-border/50";
            document.body.appendChild(state.element);
            updateMentionList(state.element, props, createRef);
          },
          onUpdate: (props) => {
            if (state.element) updateMentionList(state.element, props, createRef);
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              state.element?.remove();
              return true;
            }
            return false;
          },
          onExit: () => {
            state.element?.remove();
            state.element = null;
          },
        };
      },
    },
  });
}

function updateMentionList(
  element: HTMLDivElement,
  props: {
    items: MentionItem[];
    query: string;
    editor: Editor;
    range: { from: number; to: number };
    command: (item: { id: string; label: string; type?: string }) => void;
    clientRect?: (() => DOMRect | null) | null;
  },
  createRef: MutableRefObject<CreateMentionFn | undefined>,
) {
  element.innerHTML = "";
  const rect = props.clientRect?.();
  if (rect) {
    element.style.position = "absolute";
    element.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`;
    element.style.top = `${rect.bottom + 8}px`;
  }

  const matches = props.items.filter((item) => !item.create);
  const creates = props.items.filter((item) => item.create);

  if (matches.length === 0 && creates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "px-4 py-3 text-sm text-muted-foreground";
    empty.textContent = "No matches";
    element.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className =
    "border-b border-border/40 px-3 py-2 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase";
  header.textContent = props.query.trim()
    ? `Matching “${props.query.trim()}”`
    : "Tag something";
  element.appendChild(header);

  const list = document.createElement("div");
  list.className = "max-h-64 overflow-y-auto p-1.5";

  function appendSection(title: string, items: MentionItem[]) {
    if (items.length === 0) return;
    const section = document.createElement("div");
    section.className = "mb-1";
    const label = document.createElement("p");
    label.className =
      "px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] text-muted-foreground/80 uppercase";
    label.textContent = title;
    section.appendChild(label);
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted";
      const tone = TYPE_TONE[item.type] ?? "bg-muted text-muted-foreground";
      const typeBadge = document.createElement("span");
      typeBadge.className = `shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`;
      typeBadge.textContent = item.create ? "New" : item.type;
      const name = document.createElement("span");
      name.className = "min-w-0 flex-1 truncate text-sm font-medium";
      name.textContent = item.create
        ? props.query.trim()
          ? `${item.type}: ${props.query.trim()}`
          : `New ${item.type}`
        : item.label;
      button.appendChild(typeBadge);
      button.appendChild(name);
      button.onclick = () => {
        void (async () => {
          if (item.create) {
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
                {
                  type: "mention",
                  attrs: {
                    id: created.id,
                    label: created.label,
                    type: created.type,
                  },
                },
                { type: "text", text: " " },
              ])
              .run();
            return;
          }
          props.command({ id: item.id, label: item.label, type: item.type });
        })();
      };
      section.appendChild(button);
    }
    list.appendChild(section);
  }

  appendSection("In your workspace", matches);
  appendSection("Create", creates);
  element.appendChild(list);
}
