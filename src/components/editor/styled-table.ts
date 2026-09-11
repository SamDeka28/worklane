import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

const colorAttrs = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) =>
      element.style.backgroundColor || element.getAttribute("bgcolor") || null,
    renderHTML: (attributes: { backgroundColor?: string | null }) => {
      if (!attributes.backgroundColor) return {};
      return { style: `background-color: ${attributes.backgroundColor}` };
    },
  },
  color: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.style.color || null,
    renderHTML: (attributes: { color?: string | null }) => {
      if (!attributes.color) return {};
      return { style: `color: ${attributes.color}` };
    },
  },
};

/** Table cells that keep fill / text color when pasting from Word, Docs, etc. */
export const StyledTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...colorAttrs,
    };
  },
});

export const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...colorAttrs,
    };
  },
});
