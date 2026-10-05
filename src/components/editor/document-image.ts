import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

function imageAlign(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

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
      caption: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-caption"),
        renderHTML: (attributes: { caption?: string | null }) => {
          if (!attributes.caption) return {};
          return { "data-caption": attributes.caption };
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const align = imageAlign(node.attrs.align);
    const style = align === "center" ? "text-align: center" : align === "right" ? "text-align: right" : "text-align: left";
    const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
    const fileId = typeof node.attrs.fileId === "string" ? node.attrs.fileId : "";
    const alt = typeof node.attrs.alt === "string" && node.attrs.alt ? node.attrs.alt : "Image unavailable";
    const caption = typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
    if (!src && fileId) {
      return ["p", { class: "image-missing", "data-file-id": fileId, style }, alt];
    }
    const img = ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { alt })];
    if (!caption) return ["figure", { class: "document-image", style }, img];
    return ["figure", { class: "document-image", style }, img, ["figcaption", {}, caption]];
  },
});
