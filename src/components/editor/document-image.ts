import Image from "@tiptap/extension-image";

/** Image with an optional pixel width, shared by the editor, the reader, and the PDF. */
export const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
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
