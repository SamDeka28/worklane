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
  /**
   * "none" hides cell borders; "bottom" keeps only a rule under the cell (signature lines);
   * "band" is a borderless, generously padded block (cover and callout bands).
   */
  borderStyle: {
    default: null as "none" | "bottom" | "band" | null,
    parseHTML: (element: HTMLElement) => {
      const value = element.getAttribute("data-border");
      return value === "none" || value === "bottom" || value === "band" ? value : null;
    },
    renderHTML: (attributes: { borderStyle?: string | null }) => {
      if (attributes.borderStyle === "none") {
        return { "data-border": "none", style: "border-color: transparent" };
      }
      if (attributes.borderStyle === "band") {
        return { "data-border": "band", style: "border-color: transparent" };
      }
      if (attributes.borderStyle === "bottom") {
        return {
          "data-border": "bottom",
          style: "border-color: transparent; border-bottom-color: #334155",
        };
      }
      return {};
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
