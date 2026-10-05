export const SCHEMA_VERSION = 1 as const;

export type PageSize = "A4" | "LETTER";
export type PageOrientation = "portrait" | "landscape";

export type Sizing = "fixed" | "hug" | "fill";

export type FrameBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  width?: Sizing;
  height?: Sizing;
  pinX?: "left" | "center" | "right";
  pinY?: "top" | "center" | "bottom";
};

export type Fill =
  | { type: "solid"; color: string }
  | { type: "linear"; angle: number; stops: { color: string; offset: number }[] }
  | { type: "image"; src: string };

export type BlockStyle = {
  fill?: Fill;
  border?: string;
  borderWidth?: number;
  radius?: number;
  opacity?: number;
  padding?: number;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
};

export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  frame?: FrameBox;
  style?: BlockStyle;
  children?: Block[];
};

export type CompositionPage = {
  id: string;
  background?: Fill;
  blocks: Block[];
};

export type CompositionSection = {
  id: string;
  blocks: Block[];
};

export type CompositionDocument = {
  schemaVersion: typeof SCHEMA_VERSION;
  type: "document";
  kind: string;
  template: { id: string; version: number };
  theme: { id: string; version: number };
  metadata: {
    title: string;
    subtitle?: string;
    client?: string;
    author?: string;
    date?: string;
  };
  page: {
    size: PageSize;
    orientation: PageOrientation;
    margin: { top: number; right: number; bottom: number; left: number };
  };
  header: { show: boolean; text?: string };
  footer: { show: boolean; text?: string };
  sections: CompositionSection[];
  pages?: CompositionPage[];
};

export type BindingBag = Record<string, string>;

const CONTAINER_TYPES = new Set(["section", "columns", "stack", "grid", "card", "callout", "frame"]);

export function isComposition(value: unknown): value is CompositionDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<CompositionDocument>;
  return doc.schemaVersion === 1 && doc.type === "document" && Array.isArray(doc.sections);
}

export function allowsChildren(type: string) {
  return CONTAINER_TYPES.has(type);
}

export function collectTypes(doc: CompositionDocument) {
  const types = new Set<string>();
  const walk = (node: Block) => {
    types.add(node.type);
    for (const child of node.children ?? []) walk(child);
  };
  for (const section of doc.sections) for (const node of section.blocks) walk(node);
  for (const page of doc.pages ?? []) for (const node of page.blocks) walk(node);
  return types;
}

let seq = 0;
export function nextBlockId(prefix = "b") {
  seq += 1;
  return `${prefix}-${seq.toString(36)}`;
}

export function block(type: string, props: Record<string, unknown> = {}, children?: Block[]): Block {
  return { id: nextBlockId(type), type, props, ...(children ? { children } : {}) };
}

export function emptyDocument(input: {
  kind: string;
  title: string;
  templateId: string;
  templateVersion?: number;
  themeId?: string;
}): CompositionDocument {
  return {
    schemaVersion: 1,
    type: "document",
    kind: input.kind,
    template: { id: input.templateId, version: input.templateVersion ?? 1 },
    theme: { id: input.themeId ?? "professional-blue", version: 1 },
    metadata: { title: input.title },
    page: {
      size: "A4",
      orientation: "portrait",
      margin: { top: 40, right: 40, bottom: 48, left: 40 },
    },
    header: { show: true, text: input.title },
    footer: { show: true, text: input.title },
    sections: [{ id: nextBlockId("s"), blocks: [block("paragraph", { text: "" })] }],
  };
}

export function parseComposition(raw: unknown): { document: CompositionDocument } | { error: string } {
  const value = typeof raw === "string" ? parseJson(raw) : raw;
  if (value && typeof value === "object" && "error" in value && !("type" in value)) {
    return value as { error: string };
  }
  if (!isComposition(value)) {
    return { error: "document must be a composition tree (schemaVersion 1, type document, sections)." };
  }
  const missing = findInvalid(value);
  if (missing) return { error: missing };
  return { document: value };
}

function parseJson(raw: string): unknown | { error: string } {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { error: "document must be JSON." };
  }
}

function findInvalid(doc: CompositionDocument): string | null {
  if (!doc.metadata?.title?.trim()) return "Document title is missing.";
  if (!doc.sections.length) return "Document needs at least one section.";
  for (const section of doc.sections) {
    const problem = invalidBlocks(section.blocks, section.id);
    if (problem) return problem;
  }
  return null;
}

function invalidBlocks(blocks: Block[], sectionId: string): string | null {
  for (const node of blocks) {
    if (!node || typeof node.type !== "string" || !node.type) {
      return `Section ${sectionId} has a block without a type.`;
    }
    if (!node.props || typeof node.props !== "object") {
      return `Block ${node.id || node.type} is missing props.`;
    }
    if (node.type === "diagram") {
      const nodes = node.props.nodes;
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return `Diagram ${node.id || "diagram"} requires at least one node.`;
      }
    }
    if (node.type === "table") {
      const columns = node.props.columns;
      if (!Array.isArray(columns) || columns.length === 0) {
        return `Table ${node.id || "table"} requires at least one column.`;
      }
    }
    if (node.type === "image") {
      const src = node.props.src;
      if (typeof src === "string" && src.startsWith("data:")) {
        return `Image ${node.id || "image"} must reference a file URL, not embedded base64.`;
      }
    }
    if (node.children) {
      const childProblem = invalidBlocks(node.children, sectionId);
      if (childProblem) return childProblem;
    }
  }
  return null;
}

export function bindText(value: string, bag: BindingBag) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (full, key: string) => bag[key] ?? full);
}

export function bindDocument(doc: CompositionDocument, bag: BindingBag): CompositionDocument {
  return {
    ...doc,
    metadata: {
      ...doc.metadata,
      title: bindText(doc.metadata.title, bag),
      subtitle: doc.metadata.subtitle ? bindText(doc.metadata.subtitle, bag) : undefined,
      client: doc.metadata.client ? bindText(doc.metadata.client, bag) : undefined,
      author: doc.metadata.author ? bindText(doc.metadata.author, bag) : undefined,
    },
    header: { ...doc.header, text: doc.header.text ? bindText(doc.header.text, bag) : undefined },
    footer: { ...doc.footer, text: doc.footer.text ? bindText(doc.footer.text, bag) : undefined },
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((node) => bindBlock(node, bag)),
    })),
    pages: doc.pages?.map((page) => ({
      ...page,
      blocks: page.blocks.map((node) => bindBlock(node, bag)),
    })),
  };
}

function bindBlock(node: Block, bag: BindingBag): Block {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    props[key] = bindValue(value, bag);
  }
  return {
    ...node,
    props,
    children: node.children?.map((child) => bindBlock(child, bag)),
  };
}

function bindValue(value: unknown, bag: BindingBag): unknown {
  if (typeof value === "string") return bindText(value, bag);
  if (Array.isArray(value)) return value.map((item) => bindValue(item, bag));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) next[key] = bindValue(item, bag);
    return next;
  }
  return value;
}

export function compositionPlainText(doc: CompositionDocument): string {
  const lines: string[] = [];
  const walk = (node: Block) => {
    const text = stringProp(node, "text") || stringProp(node, "title") || stringProp(node, "body");
    if (text) lines.push(text);
    for (const child of node.children ?? []) walk(child);
  };
  const roots = doc.pages?.length ? doc.pages.flatMap((page) => page.blocks) : doc.sections.flatMap((section) => section.blocks);
  for (const node of roots) walk(node);
  return lines.join("\n");
}

function stringProp(node: Block, key: string) {
  const value = node.props[key];
  return typeof value === "string" ? value : "";
}

export const BLOCK_LIBRARY: { type: string; name: string; category: "text" | "layout" | "data" | "visual" | "document" }[] = [
  { type: "heading", name: "Heading", category: "text" },
  { type: "paragraph", name: "Paragraph", category: "text" },
  { type: "bullets", name: "Bullet list", category: "text" },
  { type: "numbered", name: "Numbered list", category: "text" },
  { type: "checklist", name: "Checklist", category: "text" },
  { type: "quote", name: "Quote", category: "text" },
  { type: "callout", name: "Callout", category: "text" },
  { type: "columns", name: "Columns", category: "layout" },
  { type: "stack", name: "Stack", category: "layout" },
  { type: "grid", name: "Grid", category: "layout" },
  { type: "spacer", name: "Spacer", category: "layout" },
  { type: "divider", name: "Divider", category: "layout" },
  { type: "page-break", name: "Page break", category: "layout" },
  { type: "frame", name: "Frame", category: "layout" },
  { type: "shape", name: "Rectangle", category: "visual" },
  { type: "button", name: "Button", category: "document" },
  { type: "card", name: "Card", category: "data" },
  { type: "table", name: "Table", category: "data" },
  { type: "image", name: "Image", category: "visual" },
  { type: "diagram", name: "Diagram", category: "visual" },
  { type: "signature", name: "Signature", category: "document" },
];

export function defaultBlock(type: string): Block {
  switch (type) {
    case "heading":
      return block("heading", { text: "Heading", level: 2 });
    case "paragraph":
      return block("paragraph", { text: "Write here." });
    case "bullets":
    case "numbered":
    case "checklist":
      return block(type, { items: ["First", "Second"] });
    case "quote":
      return block("quote", { text: "A short quotation." });
    case "callout":
      return block("callout", { text: "A note set apart from the body." });
    case "columns":
      return block("columns", {}, [block("paragraph", { text: "Left" }), block("paragraph", { text: "Right" })]);
    case "stack":
      return block("stack", {}, [block("paragraph", { text: "Stacked content" })]);
    case "grid":
      return block("grid", { columns: 2 }, [block("card", { title: "One" }), block("card", { title: "Two" })]);
    case "spacer":
      return block("spacer", { size: 16 });
    case "divider":
      return block("divider", {});
    case "page-break":
      return block("page-break", {});
    case "frame":
      return block("frame", {}, []);
    case "shape":
      return block("shape", { kind: "rect" });
    case "button":
      return block("button", { label: "Button" });
    case "card":
      return block("card", { icon: "square", title: "Title", body: "Detail" });
    case "table":
      return block("table", {
        columns: [
          { key: "a", label: "Column" },
          { key: "b", label: "Detail" },
        ],
        rows: [{ a: "Value", b: "Description" }],
      });
    case "image":
      return block("image", { src: "", alt: "Image", frame: "none" });
    case "diagram":
      return block("diagram", {
        layout: "row",
        nodes: [
          { id: "a", label: "Start" },
          { id: "b", label: "Next" },
        ],
        edges: [{ from: "a", to: "b" }],
      });
    case "signature":
      return block("signature", { left: "Provider", right: "Client" });
    default:
      return block("paragraph", { text: "" });
  }
}

export function compositionBlockGuide() {
  return {
    guide:
      "A composition document is a tree of nestable blocks, not Markdown. page, theme, header, and footer are document settings. Blocks may include frame {x,y,w,h} in page pixels and style {fill, border, radius}. pages is an array of artboards with a background and blocks. Blocks are frame, heading, paragraph, bullets, numbered, checklist, quote, callout, columns, stack, grid, spacer, divider, page-break, shape, button, card, table, image, diagram, and signature. Drop any block inside a frame. A table has caller-defined columns and rows. A diagram has nodes with x, y, w, h and edges. A shape kind is rect, ellipse, or clip. Omit any block. Do not name blocks after a single product.",
    blocks: BLOCK_LIBRARY,
    bindings: ["{{client.name}}", "{{project.name}}", "{{studio.name}}"],
  };
}
