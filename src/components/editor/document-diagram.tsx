import { Node, mergeAttributes } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { layoutDiagramData } from "@/modules/documents/composition/diagram";
import type { DiagramEdge, DiagramNode } from "@/modules/documents/composition/read";

function asLayout(value: unknown): "stack" | "row" | "hub" | "timeline" {
  return value === "stack" || value === "hub" || value === "timeline" || value === "row" ? value : "row";
}

function asNodes(value: unknown): DiagramNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { id?: unknown; label?: unknown; caption?: unknown };
    if (typeof record.id !== "string" || !record.id) return [];
    return [{
      id: record.id,
      label: typeof record.label === "string" ? record.label : record.id,
      caption: typeof record.caption === "string" ? record.caption : undefined,
    }];
  });
}

function asEdges(value: unknown): DiagramEdge[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { from?: unknown; to?: unknown };
    if (typeof record.from !== "string" || typeof record.to !== "string") return [];
    return [{ from: record.from, to: record.to }];
  });
}

function diagramSvg(node: ProseNode) {
  const drawn = layoutDiagramData(asLayout(node.attrs.layout), asNodes(node.attrs.nodes), asEdges(node.attrs.edges));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${drawn.width} ${drawn.height}" width="${drawn.width}" height="${drawn.height}">`,
  ];
  for (const edge of drawn.edges) {
    parts.push(`<line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="#1d4ed8" stroke-width="1.4"/>`);
  }
  for (const box of drawn.boxes) {
    parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="6" fill="${box.hub ? "#dbeafe" : "#f8fafc"}" stroke="#1d4ed8"/>`);
    parts.push(`<text x="${box.x + 8}" y="${box.y + 18}" fill="#0f172a" font-size="11" font-family="sans-serif" font-weight="600">${escapeXml(box.label)}</text>`);
    if (box.caption) {
      parts.push(`<text x="${box.x + 8}" y="${box.y + 32}" fill="#64748b" font-size="9" font-family="sans-serif">${escapeXml(box.caption)}</text>`);
    }
  }
  parts.push("</svg>");
  return parts.join("");
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

/** The same diagram the PDF draws: nodes and edges, laid out as a row, stack, hub, or timeline. */
export const DocumentDiagram = Node.create({
  name: "diagram",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      layout: { default: "row" },
      nodes: { default: [] as DiagramNode[] },
      edges: { default: [] as DiagramEdge[] },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-diagram]" }];
  },

  renderHTML({ node }) {
    return ["img", mergeAttributes({
      "data-diagram": "",
      alt: "Diagram",
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagramSvg(node))}`,
      style: "display: block; width: 100%; max-width: 100%; height: auto;",
    })];
  },
});
