import { mergeAttributes, ResizableNodeView } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

function imageAlign(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

function imageWrap(value: unknown): "break" | "left" | "right" | "behind" | "front" {
  if (value === "left" || value === "right" || value === "behind" || value === "front") return value;
  return "break";
}

function imageOffset(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function viewZoom(editorDom: HTMLElement) {
  const host = editorDom.closest("[data-doc-zoom]");
  const zoom = host ? Number(host.getAttribute("data-doc-zoom")) : 1;
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

const RESIZE_DIRECTIONS = [
  "top",
  "right",
  "bottom",
  "left",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

/** Image with file, width, alignment, and caption, shared by the editor, the reader, and the PDF. */
export const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-file-id"),
        renderHTML: (attributes: { fileId?: string | null }) => {
          if (!attributes.fileId) return {};
          return { "data-file-id": attributes.fileId };
        },
      },
      width: {
        default: null as number | null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("width") || element.style.width;
          const match = raw ? /^(\d+)/.exec(raw) : null;
          return match ? Number(match[1]) : null;
        },
        renderHTML: (attributes: { width?: number | null }) => {
          if (!attributes.width) return {};
          return { width: String(attributes.width), style: `width: ${attributes.width}px` };
        },
      },
      align: {
        default: "left" as "left" | "center" | "right",
        parseHTML: (element: HTMLElement) => imageAlign(element.getAttribute("data-align")),
        renderHTML: (attributes: { align?: string | null }) => ({ "data-align": imageAlign(attributes.align) }),
      },
      wrap: {
        default: "break" as "break" | "left" | "right" | "behind" | "front",
        parseHTML: (element: HTMLElement) => imageWrap(element.getAttribute("data-wrap")),
        renderHTML: (attributes: { wrap?: string | null }) => ({ "data-wrap": imageWrap(attributes.wrap) }),
      },
      caption: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-caption"),
        renderHTML: (attributes: { caption?: string | null }) => {
          if (!attributes.caption) return {};
          return { "data-caption": attributes.caption };
        },
      },
      x: {
        default: null as number | null,
        parseHTML: (element: HTMLElement) => imageOffset(element.getAttribute("data-x")),
        renderHTML: (attributes: { x?: number | null }) => {
          const x = imageOffset(attributes.x);
          if (x == null) return {};
          return { "data-x": String(x) };
        },
      },
      y: {
        default: null as number | null,
        parseHTML: (element: HTMLElement) => imageOffset(element.getAttribute("data-y")),
        renderHTML: (attributes: { y?: number | null }) => {
          const y = imageOffset(attributes.y);
          if (y == null) return {};
          return { "data-y": String(y) };
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const align = imageAlign(node.attrs.align);
    const wrap = imageWrap(node.attrs.wrap);
    const style = align === "center" ? "text-align: center" : align === "right" ? "text-align: right" : "text-align: left";
    const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
    const fileId = typeof node.attrs.fileId === "string" ? node.attrs.fileId : "";
    const alt = typeof node.attrs.alt === "string" && node.attrs.alt ? node.attrs.alt : "Image unavailable";
    const caption = typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
    const figure = {
      class: "document-image",
      style,
      "data-align": align,
      "data-wrap": wrap,
    };
    if (!src && fileId) {
      return ["p", { class: "image-missing", "data-file-id": fileId, style }, alt];
    }
    const img = ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { alt })];
    if (!caption) return ["figure", figure, img];
    return ["figure", figure, img, ["figcaption", {}, caption]];
  },
  addNodeView() {
    if (typeof document === "undefined") return null;
    return ({ node, getPos, editor, HTMLAttributes }) => {
      const img = document.createElement("img");
      img.draggable = false;
      img.alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
      const figure = document.createElement("figure");
      figure.className = "document-image";
      const caption = document.createElement("figcaption");
      let current = node;
      const resizable = new ResizableNodeView({
        element: img,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          img.style.width = `${width}px`;
          img.style.height = `${height}px`;
        },
        onCommit: (width, height) => {
          const pos = getPos();
          if (pos == null) return;
          editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes("image", { width: Math.round(width), height: Math.round(height) })
            .run();
        },
        onUpdate: (updated) => {
          if (updated.type.name !== "image") return false;
          current = updated;
          paint(figure.classList.contains("is-dragging"));
          return true;
        },
        options: {
          directions: [...RESIZE_DIRECTIONS],
          min: { width: 48, height: 32 },
          preserveAspectRatio: true,
        },
      });
      // Flex, inline-block, and overflow other than visible form a formatting
      // context that cannot sit beside the page-break floats. The image then
      // drops below every page and the editor inserts blank pages to catch up.
      resizable.container.style.display = "block";
      resizable.container.style.width = "fit-content";
      resizable.container.style.maxWidth = "100%";
      resizable.wrapper.style.display = "block";
      resizable.wrapper.style.width = "fit-content";
      resizable.wrapper.style.maxWidth = "100%";
      figure.append(resizable.dom, caption);
      let drag: {
        pointerId: number;
        startX: number;
        startY: number;
        grabX: number;
        grabY: number;
        moved: boolean;
        x: number;
        y: number;
      } | null = null;

      const paint = (live: boolean) => {
        paintImage(figure, img, caption, current, HTMLAttributes, live);
      };

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        if (!(event.target instanceof Element) || event.target.closest("[data-resize-handle]")) return;
        const pos = getPos();
        if (pos == null || !editor.isEditable) return;
        event.preventDefault();
        const zoom = viewZoom(editor.view.dom);
        const fig = figure.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          grabX: (event.clientX - fig.left) / zoom,
          grabY: (event.clientY - fig.top) / zoom,
          moved: false,
          x: 0,
          y: 0,
        };
        try {
          figure.setPointerCapture(event.pointerId);
        } catch {
          // The pointer can leave the picture. Window listeners keep the drag going.
        }
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
        editor.view.dispatch(
          editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)),
        );
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const zoom = viewZoom(editor.view.dom);
        const origin = editor.view.dom.getBoundingClientRect();
        const x = Math.round((event.clientX - origin.left) / zoom - drag.grabX);
        const y = Math.round((event.clientY - origin.top) / zoom - drag.grabY);
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (!drag.moved && distance < 4) return;
        drag.moved = true;
        drag.x = Math.min(Math.max(0, x), Math.max(0, editor.view.dom.clientWidth - 32));
        drag.y = Math.min(Math.max(0, y), Math.max(0, editor.view.dom.clientHeight - 32));
        figure.classList.add("is-dragging");
        figure.dataset.placed = "true";
        figure.style.left = `${drag.x}px`;
        figure.style.top = `${drag.y}px`;
      };

      const finishDrag = (commit: boolean) => {
        const active = drag;
        drag = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        if (!active?.moved) {
          figure.classList.remove("is-dragging");
          return;
        }
        figure.classList.remove("is-dragging");
        if (!commit) {
          paint(false);
          return;
        }
        const pos = getPos();
        if (pos == null) {
          paint(false);
          return;
        }
        const wrap = imageWrap(current.attrs.wrap);
        let tr = editor.state.tr
          .setNodeAttribute(pos, "x", active.x)
          .setNodeAttribute(pos, "y", active.y);
        if (wrap !== "behind" && wrap !== "front") tr = tr.setNodeAttribute(pos, "wrap", "front");
        editor.view.dispatch(tr);
      };

      const onPointerUp = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (figure.hasPointerCapture(event.pointerId)) figure.releasePointerCapture(event.pointerId);
        finishDrag(true);
      };

      const onPointerCancel = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (figure.hasPointerCapture(event.pointerId)) figure.releasePointerCapture(event.pointerId);
        finishDrag(false);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || !drag?.moved) return;
        if (figure.hasPointerCapture(drag.pointerId)) figure.releasePointerCapture(drag.pointerId);
        finishDrag(false);
      };

      figure.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown);
      paint(false);
      figure.style.visibility = "hidden";
      const reveal = () => {
        figure.style.visibility = "";
      };
      if (img.complete && img.naturalWidth > 0) reveal();
      else {
        img.addEventListener("load", reveal, { once: true });
        img.addEventListener("error", reveal, { once: true });
      }
      return {
        dom: figure,
        update: (updated: ProseNode) => resizable.update(updated, [], undefined as never),
        destroy: () => {
          figure.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerCancel);
          window.removeEventListener("keydown", onKeyDown);
          resizable.destroy();
        },
        stopEvent: (event: Event) => {
          const target = event.target;
          return target instanceof Element && Boolean(target.closest("[data-resize-handle]"));
        },
      };
    };
  },
});

function paintImage(
  figure: HTMLElement,
  img: HTMLImageElement,
  caption: HTMLElement,
  node: ProseNode,
  htmlAttributes: Record<string, unknown>,
  live = false,
) {
  const align = imageAlign(node.attrs.align);
  const wrap = imageWrap(node.attrs.wrap);
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const text = typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
  const fileId = typeof node.attrs.fileId === "string" ? node.attrs.fileId : "";
  const x = imageOffset(node.attrs.x);
  const y = imageOffset(node.attrs.y);
  figure.dataset.align = align;
  figure.dataset.wrap = wrap;
  if (!live) {
    if (x != null && y != null) {
      figure.dataset.placed = "true";
      figure.style.left = `${x}px`;
      figure.style.top = `${y}px`;
    } else {
      delete figure.dataset.placed;
      figure.style.removeProperty("left");
      figure.style.removeProperty("top");
    }
  }
  if (fileId) figure.dataset.fileId = fileId;
  else delete figure.dataset.fileId;
  if (src && img.getAttribute("src") !== src) img.src = src;
  img.alt = alt || "Image";
  const title = typeof htmlAttributes.title === "string" ? htmlAttributes.title : "";
  if (title) img.title = title;
  const width = typeof node.attrs.width === "number" ? node.attrs.width : null;
  const height = typeof node.attrs.height === "number" ? node.attrs.height : null;
  if (width && width > 0) img.style.width = `${width}px`;
  else img.style.removeProperty("width");
  if (height && height > 0) img.style.height = `${height}px`;
  else img.style.removeProperty("height");
  caption.textContent = text;
  caption.hidden = text.length === 0;
}
