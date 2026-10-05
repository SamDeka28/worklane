import { layoutDiagramData } from "@/modules/documents/composition/diagram";
import { diagramOf } from "@/modules/documents/composition/read";
import {
  allowsChildren,
  defaultBlock,
  nextBlockId,
  type Block,
  type BlockStyle,
  type CompositionDocument,
  type CompositionPage,
  type Fill,
  type FrameBox,
} from "@/modules/documents/composition/schema";
import { pagePixels } from "@/modules/documents/composition/theme";

export function defaultSize(type: string): { w: number; h: number } {
  switch (type) {
    case "frame":
    case "card":
      return { w: 280, h: 200 };
    case "heading":
      return { w: 320, h: 40 };
    case "image":
      return { w: 200, h: 140 };
    case "button":
      return { w: 128, h: 36 };
    case "shape":
      return { w: 140, h: 90 };
    case "table":
      return { w: 360, h: 140 };
    case "diagram":
      return { w: 420, h: 220 };
    case "signature":
      return { w: 360, h: 90 };
    default:
      return { w: 280, h: 48 };
  }
}

export function estimateHeight(node: Block): number {
  if (node.frame?.h) return node.frame.h;
  return defaultSize(node.type).h;
}

/** Lay a flow document onto artboards. Documents that already have frames are kept. */
export function materializeDocument(doc: CompositionDocument): CompositionDocument {
  if (doc.pages?.some((page) => page.blocks.some((node) => node.frame))) return doc;
  const size = pagePixels(doc.page.size, doc.page.orientation);
  const margin = doc.page.margin;
  const contentWidth = Math.max(80, size.width - margin.left - margin.right);
  const pages: CompositionPage[] = [];
  let blocks: Block[] = [];
  let y = margin.top;
  const pushPage = () => {
    pages.push({ id: nextBlockId("p"), blocks });
    blocks = [];
    y = margin.top;
  };
  for (const section of doc.sections) {
    for (const node of section.blocks) {
      if (node.type === "page-break") {
        if (blocks.length) pushPage();
        continue;
      }
      const height = estimateHeight(node);
      if (y + height > size.height - margin.bottom && blocks.length) pushPage();
      blocks.push(withFrame(node, { x: margin.left, y, w: contentWidth, h: height }));
      y += height + 12;
    }
  }
  if (!pages.length || blocks.length) pushPage();
  return { ...doc, pages };
}

function withFrame(node: Block, frame: FrameBox): Block {
  const children = node.children?.map((child, index) => {
    const size = defaultSize(child.type);
    return withFrame(child, child.frame ?? { x: 12, y: 12 + index * (size.h + 8), w: Math.max(40, frame.w - 24), h: size.h });
  });
  return { ...node, frame: node.frame ?? frame, ...(children ? { children } : {}) };
}

export function placeBlock(type: string, x: number, y: number, kind?: string): Block {
  const created = defaultBlock(type);
  const size = defaultSize(type);
  const props = kind && type === "shape" ? { ...created.props, kind } : created.props;
  const style: BlockStyle | undefined =
    type === "frame" || type === "card"
      ? { fill: { type: "solid", color: "#ffffff" }, border: "#e2e8f0", borderWidth: 1, radius: 12, padding: 12 }
      : type === "shape"
        ? { fill: { type: "solid", color: "#dbeafe" }, radius: kind === "ellipse" ? 999 : 8 }
        : type === "button"
          ? { fill: { type: "solid", color: "#1d4ed8" }, color: "#ffffff", radius: 8, align: "center", bold: true }
          : undefined;
  return { ...created, props, frame: { x, y, w: size.w, h: size.h }, ...(style ? { style } : {}) };
}

export function resizeFrame(node: Block, next: FrameBox): Block {
  const previous = node.frame ?? next;
  const children = node.children?.map((child) => {
    if (!child.frame) return child;
    let { x, y, w, h } = child.frame;
    if (child.frame.width === "fill") {
      x = node.style?.padding ?? 0;
      w = Math.max(24, next.w - x * 2);
    } else if (child.frame.pinX === "right") {
      x = next.w - (previous.w - (child.frame.x + child.frame.w)) - child.frame.w;
    } else if (child.frame.pinX === "center") {
      x = (next.w - child.frame.w) / 2;
    }
    if (child.frame.height === "fill") {
      y = node.style?.padding ?? 0;
      h = Math.max(24, next.h - y * 2);
    } else if (child.frame.pinY === "bottom") {
      y = next.h - (previous.h - (child.frame.y + child.frame.h)) - child.frame.h;
    } else if (child.frame.pinY === "center") {
      y = (next.h - child.frame.h) / 2;
    }
    return { ...child, frame: { ...child.frame, x, y, w, h } };
  });
  return { ...node, frame: { ...previous, ...next }, ...(children ? { children } : {}) };
}

export function mapPages(doc: CompositionDocument, visit: (node: Block) => Block): CompositionDocument {
  const pages = (doc.pages ?? []).map((page) => ({
    ...page,
    blocks: page.blocks.map((node) => mapNode(node, visit)),
  }));
  return { ...doc, pages, sections: pagesToSections(pages) };
}

function mapNode(node: Block, visit: (node: Block) => Block): Block {
  const next = visit(node);
  if (!next.children) return next;
  return { ...next, children: next.children.map((child) => mapNode(child, visit)) };
}

export function pagesToSections(pages: CompositionPage[]): CompositionDocument["sections"] {
  return pages.map((page) => ({ id: page.id, blocks: page.blocks }));
}

export function updateNode(doc: CompositionDocument, id: string, patch: (node: Block) => Block): CompositionDocument {
  return mapPages(doc, (node) => (node.id === id ? patch(node) : node));
}

export function removeNode(doc: CompositionDocument, id: string): CompositionDocument {
  const pages = (doc.pages ?? []).map((page) => ({ ...page, blocks: removeFrom(page.blocks, id) }));
  return { ...doc, pages, sections: pagesToSections(pages) };
}

function removeFrom(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeFrom(node.children, id) } : node));
}

export function insertNode(doc: CompositionDocument, pageIndex: number, node: Block, parentId?: string | null, local = false): CompositionDocument {
  const pages = (doc.pages ?? []).map((page, index) => {
    if (index !== pageIndex) return page;
    if (!parentId) return { ...page, blocks: [...page.blocks, node] };
    return { ...page, blocks: insertInto(page.blocks, parentId, node, local) };
  });
  return { ...doc, pages, sections: pagesToSections(pages) };
}

function insertInto(blocks: Block[], parentId: string, created: Block, local: boolean): Block[] {
  return blocks.map((node) => {
    if (node.id === parentId && allowsChildren(node.type)) {
      const frame = created.frame
        ? {
            ...created.frame,
            x: local ? created.frame.x : created.frame.x - (node.frame?.x ?? 0),
            y: local ? created.frame.y : created.frame.y - (node.frame?.y ?? 0),
          }
        : created.frame;
      return { ...node, children: [...(node.children ?? []), { ...created, frame }] };
    }
    if (!node.children) return node;
    return { ...node, children: insertInto(node.children, parentId, created, local) };
  });
}

export type ShapePiece = { kind: "rect" | "ellipse"; x: number; y: number; w: number; h: number };

/** Combine two shapes into one clip result, in the coordinates of their union box. */
export function clipShapes(a: ShapePiece, b: ShapePiece, op: "union" | "subtract" | "intersect"): { frame: FrameBox; pieces: ShapePiece[]; path: string } {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  const local = (piece: ShapePiece): ShapePiece => ({ ...piece, x: piece.x - x, y: piece.y - y });
  const first = local(a);
  const second = local(b);
  const path =
    op === "intersect"
      ? shapePath(intersectPiece(first, second))
      : op === "subtract"
        ? `${shapePath(first)} ${shapePath(second, true)}`
        : `${shapePath(first)} ${shapePath(second)}`;
  return {
    frame: { x, y, w: Math.max(8, right - x), h: Math.max(8, bottom - y) },
    pieces: [first, second],
    path,
  };
}

function intersectPiece(a: ShapePiece, b: ShapePiece): ShapePiece {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { kind: "rect", x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

function shapePath(piece: ShapePiece, reverse = false): string {
  if (piece.kind === "ellipse") {
    const rx = piece.w / 2;
    const ry = piece.h / 2;
    const cx = piece.x + rx;
    const cy = piece.y + ry;
    const sweep = reverse ? 0 : 1;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 ${sweep} ${cx + rx} ${cy} A ${rx} ${ry} 0 1 ${sweep} ${cx - rx} ${cy} Z`;
  }
  const { x, y, w, h } = piece;
  return reverse ? `M ${x} ${y} V ${y + h} H ${x + w} V ${y} Z` : `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

export function solidFill(fill: Fill | undefined, fallback: string) {
  if (!fill) return fallback;
  if (fill.type === "solid") return fill.color;
  if (fill.type === "linear") return fill.stops[0]?.color ?? fallback;
  return fallback;
}

export function fillStyle(fill: Fill | undefined): { background?: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  if (!fill) return {};
  if (fill.type === "solid") return { background: fill.color };
  if (fill.type === "image" && /^https:\/\//.test(fill.src)) {
    return { backgroundImage: `url("${fill.src}")`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  if (fill.type === "linear") {
    const stops = fill.stops.map((stop) => `${stop.color} ${stop.offset}%`).join(", ");
    return { backgroundImage: `linear-gradient(${fill.angle}deg, ${stops})` };
  }
  return {};
}

export function arrangeDiagram(node: Block, layout: "stack" | "row" | "hub" | "timeline"): Block {
  const diagram = diagramOf(node);
  const drawn = layoutDiagramData(layout, diagram.nodes.map(({ x: _x, y: _y, w: _w, h: _h, ...rest }) => rest), diagram.edges);
  const nodes = diagram.nodes.map((item) => {
    const box = drawn.boxes.find((entry) => entry.id === item.id);
    return box ? { ...item, x: box.x, y: box.y, w: box.w, h: box.h } : item;
  });
  return { ...node, props: { ...node.props, layout, nodes, edges: diagram.edges } };
}

export function findPlaced(doc: CompositionDocument, id: string): Block | null {
  for (const page of doc.pages ?? []) {
    const found = findIn(page.blocks, id);
    if (found) return found;
  }
  return null;
}

function findIn(blocks: Block[], id: string): Block | null {
  for (const node of blocks) {
    if (node.id === id) return node;
    const child = node.children ? findIn(node.children, id) : null;
    if (child) return child;
  }
  return null;
}
