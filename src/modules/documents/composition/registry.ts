import { layoutDiagram } from "@/modules/documents/composition/diagram";
import { diagramOf, itemsOf, splitTableRows, tableOf, textOf } from "@/modules/documents/composition/read";
import { BLOCK_LIBRARY, defaultBlock, type Block } from "@/modules/documents/composition/schema";

export type RenderFace = "editor" | "preview" | "pdf";

/** The same props both the canvas and the PDF adapter draw. */
export function blockRenderProps(node: Block, face: RenderFace) {
  const base = {
    face,
    id: node.id,
    type: node.type,
    props: node.props,
    childIds: (node.children ?? []).map((child) => child.id),
  };
  if (node.type === "table") {
    const table = tableOf(node);
    return { ...base, columns: table.columns, rows: table.rows, pages: splitTableRows(table.rows) };
  }
  if (node.type === "diagram") {
    const diagram = diagramOf(node);
    return { ...base, layout: diagram.layout, nodes: diagram.nodes, edges: diagram.edges, drawn: layoutDiagram(node) };
  }
  if (node.type === "bullets" || node.type === "numbered" || node.type === "checklist") {
    return { ...base, items: itemsOf(node) };
  }
  return { ...base, text: textOf(node) || textOf(node, "title") || textOf(node, "body") };
}

export function registeredBlockTypes() {
  return BLOCK_LIBRARY.map((entry) => entry.type);
}

export function smokeRender(type: string) {
  const node = defaultBlock(type);
  return {
    editor: blockRenderProps(node, "editor"),
    preview: blockRenderProps(node, "preview"),
    pdf: blockRenderProps(node, "pdf"),
  };
}
