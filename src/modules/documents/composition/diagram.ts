import { diagramOf, type DiagramNode } from "@/modules/documents/composition/read";
import type { Block } from "@/modules/documents/composition/schema";

export type DiagramBox = {
  id: string;
  label: string;
  caption?: string;
  fields: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  hub: boolean;
};

export type DiagramLayout = {
  width: number;
  height: number;
  boxes: DiagramBox[];
  edges: { x1: number; y1: number; x2: number; y2: number }[];
};

export function layoutDiagram(node: Block): DiagramLayout {
  const diagram = diagramOf(node);
  return layoutDiagramData(diagram.layout, diagram.nodes, diagram.edges);
}

export function layoutDiagramData(
  layout: "stack" | "row" | "hub" | "timeline",
  nodes: DiagramNode[],
  edges: { from: string; to: string }[],
): DiagramLayout {
  const width = 480;
  const boxW = layout === "row" ? 100 : 160;
  const placed = nodes.length > 0 && nodes.every((item) => typeof item.x === "number" && typeof item.y === "number");
  const boxes: DiagramBox[] = nodes.map((item, index) => {
    const fields = (item.fields ?? []).map((field) => `${field.key === "pk" ? "PK " : field.key === "fk" ? "FK " : ""}${field.name}`);
    const h = 36 + (item.caption ? 12 : 0) + fields.length * 10;
    if (placed) {
      return { id: item.id, label: item.label, caption: item.caption, fields, x: item.x ?? 0, y: item.y ?? 0, w: item.w ?? 120, h: item.h ?? h, hub: false };
    }
    if (layout === "row") {
      return { id: item.id, label: item.label, caption: item.caption, fields, x: index * (boxW + 16), y: 8, w: boxW, h, hub: false };
    }
    if (layout === "hub") {
      if (index === 0) return { id: item.id, label: item.label, caption: item.caption, fields, x: width / 2 - 80, y: 8, w: 160, h, hub: true };
      const col = (index - 1) % 3;
      const row = Math.floor((index - 1) / 3);
      return { id: item.id, label: item.label, caption: item.caption, fields, x: 16 + col * 156, y: 90 + row * 70, w: 140, h, hub: false };
    }
    if (layout === "timeline") {
      return { id: item.id, label: item.label, caption: item.caption, fields, x: 24, y: 8 + index * 72, w: 220, h: Math.max(h, 40), hub: false };
    }
    return { id: item.id, label: item.label, caption: item.caption, fields, x: 150, y: 8 + index * 64, w: 180, h: Math.max(h, 40), hub: false };
  });
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const drawn = edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return [];
    return [{ x1: from.x + from.w / 2, y1: from.y + from.h, x2: to.x + to.w / 2, y2: to.y }];
  });
  const height = Math.max(48, ...boxes.map((box) => box.y + box.h + 8), 48);
  const drawnWidth = Math.max(width, ...boxes.map((box) => box.x + box.w + 8));
  return { width: drawnWidth, height, boxes, edges: drawn };
}
