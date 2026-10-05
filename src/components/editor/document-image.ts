import Image from "@tiptap/extension-image";

/** Image with an optional pixel width, shared by the editor, the reader, and the PDF. */
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
    };
  },
});
