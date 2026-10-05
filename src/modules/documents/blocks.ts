import type { JSONContent } from "@tiptap/core";

const HEX = /^#[0-9a-fA-F]{6}$/;
const HTTPS = /^https:\/\/[^\s]+$/;
const MAX_BLOCKS = 80;

const COVER = "#0f172a";
const COVER_ACCENT = "#93c5fd";
const COVER_TEXT = "#cbd5e1";
const INK = "#0f172a";
const MUTED = "#64748b";
const BAND = "#f8fafc";
const HEAD = "#f1f5f9";
const ACCENT = "#1e40af";

export type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  size?: string;
  highlight?: string;
  link?: string;
};

export type CellInput = {
  text?: string | TextRun | Array<string | TextRun>;
  header?: boolean;
  fill?: string;
  border?: "grid" | "none" | "line" | "band";
  align?: "left" | "center" | "right" | "justify";
};

export type BlockInput = {
  type: string;
  text?: unknown;
  level?: unknown;
  align?: unknown;
  items?: unknown;
  src?: unknown;
  alt?: unknown;
  width?: unknown;
  fileId?: unknown;
  caption?: unknown;
  layout?: unknown;
  nodes?: unknown;
  edges?: unknown;
  columns?: unknown;
  rows?: unknown;
  header?: unknown;
  kicker?: unknown;
  title?: unknown;
  subtitle?: unknown;
  fill?: unknown;
  left?: unknown;
  right?: unknown;
};

const BLOCK_GUIDE = [
  "Blocks are the same layout the document editor inserts. Pass a JSON array.",
  "paragraph and heading: text is a string or an array of runs {text, bold, italic, underline, strike, color, size, highlight, link}. align is left, center, right, or justify. heading level is 1, 2, or 3.",
  "bullets and numbered: items are strings or runs. checklist: items are {text, checked}.",
  "quote: text. divider: no fields. spacer: an empty line.",
  "Upload the asset first using upload_asset. Use the returned fileId in compose_document image blocks. Do not invent fileIds.",
  "image: fileId from upload_asset, or src as an https URL. Optional alt, width in pixels, align (left, center, or right), and caption. A fileId is stored on the document. Do not pass a local path or a temporary link.",
  "diagram: layout is row, stack, hub, or timeline. nodes are {id, label, caption}. edges are {from, to}. The editor and the PDF draw this as boxes and lines, not as a table or an image.",
  "table: columns are header labels. rows are cells. A cell is a string or {text, header, fill, border, align}. border is grid, none, line, or band. fill is a #hex color.",
  "cover: kicker, title, subtitle. A full-width dark band.",
  "facts: items are {label, value}, laid out in rows of three.",
  "callout: text in a quote band.",
  "signatures: left and right party names, with ruled signature lines.",
  "placement is append, start, or replace. append adds the blocks to the saved document. replace writes these blocks as the whole draft.",
].join(" ");

export function documentBlockGuide() {
  return {
    guide: BLOCK_GUIDE,
    blocks: ["paragraph", "heading", "bullets", "numbered", "checklist", "quote", "divider", "spacer", "image", "diagram", "table", "cover", "facts", "callout", "signatures"],
    example: [
      { type: "cover", kicker: "Statement of work", title: "Rentique", subtitle: "Prepared for Rentique" },
      { type: "facts", items: [{ label: "Client", value: "Rentique" }, { label: "SOW number", value: "RNTQ-SOW-001" }] },
      { type: "heading", level: 2, text: "Scope" },
      { type: "bullets", items: ["Discovery", "MVP", "Handover"] },
      {
        type: "table",
        columns: ["#", "Deliverable", "Due"],
        rows: [["D1", "Discovery & UX", "To be agreed"]],
      },
      { type: "image", fileId: "file-id-from-upload_asset", alt: "Mark", width: 160 },
      {
        type: "diagram",
        layout: "row",
        nodes: [
          { id: "discover", label: "Discover" },
          { id: "earn", label: "Earn" },
        ],
        edges: [{ from: "discover", to: "earn" }],
      },
      { type: "signatures", left: "Provider", right: "Client" },
    ],
  };
}

export function parseDocumentBlocks(raw: unknown): { blocks: BlockInput[] } | { error: string } {
  const value = typeof raw === "string" ? parseJson(raw) : raw;
  if (value && typeof value === "object" && "error" in value) return value as { error: string };
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { blocks?: unknown }).blocks)
      ? (value as { blocks: unknown[] }).blocks
      : null;
  if (!list) return { error: "content must be a JSON array of blocks. Call list_document_blocks for the layout." };
  if (list.length === 0) return { error: "content needs at least one block." };
  if (list.length > MAX_BLOCKS) return { error: `content accepts up to ${MAX_BLOCKS} blocks.` };
  if (list.some((block) => !block || typeof block !== "object" || Array.isArray(block))) {
    return { error: "Each block must be an object with a type." };
  }
  return { blocks: list as BlockInput[] };
}

function parseJson(raw: string): unknown | { error: string } {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { error: "content must be JSON." };
  }
}

export function blocksToDoc(blocks: BlockInput[]): { doc: JSONContent } | { error: string } {
  const nodes: JSONContent[] = [];
  for (const block of blocks) {
    const built = blockToNodes(block);
    if ("error" in built) return built;
    nodes.push(...built);
  }
  if (nodes.length === 0) return { error: "content did not produce a document." };
  return { doc: { type: "doc", content: nodes } };
}

export function blocksToNodes(block: BlockInput): JSONContent[] | { error: string } {
  return blockToNodes(block);
}

function blockToNodes(block: BlockInput): JSONContent[] | { error: string } {
  switch (block.type) {
    case "paragraph":
      return [paragraph(block.text, alignOf(block.align))];
    case "heading":
      return [heading(levelOf(block.level), block.text, alignOf(block.align))];
    case "bullets":
      return [list("bulletList", block.items)];
    case "numbered":
      return [list("orderedList", block.items)];
    case "checklist":
      return [checklist(block.items)];
    case "quote":
    case "callout":
      return [{ type: "blockquote", content: [paragraph(block.text)] }];
    case "divider":
      return [{ type: "horizontalRule" }];
    case "spacer":
      return [{ type: "paragraph" }];
    case "image":
      return image(block);
    case "diagram":
      return diagram(block);
    case "table":
      return [tableBlock(block)];
    case "cover":
      return [cover(block)];
    case "facts":
      return [facts(block.items)];
    case "signatures":
      return [signatures(textOf(block.left) || "Provider", textOf(block.right) || "Client")];
    default:
      return { error: `Unknown block type "${block.type}". Call list_document_blocks.` };
  }
}

function alignOf(value: unknown) {
  return value === "center" || value === "right" || value === "justify" || value === "left" ? value : undefined;
}

function levelOf(value: unknown): 1 | 2 | 3 {
  const level = Number(value);
  return level === 1 || level === 3 ? level : 2;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  return "";
}

function runsOf(value: unknown): TextRun[] {
  if (typeof value === "string") return value ? [{ text: value }] : [];
  if (Array.isArray(value)) return value.flatMap((item) => runsOf(item));
  if (value && typeof value === "object" && "text" in value && typeof (value as TextRun).text === "string") {
    return [value as TextRun];
  }
  return [];
}

function runNode(run: TextRun): JSONContent {
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (run.bold) marks.push({ type: "bold" });
  if (run.italic) marks.push({ type: "italic" });
  if (run.underline) marks.push({ type: "underline" });
  if (run.strike) marks.push({ type: "strike" });
  if (run.highlight && HEX.test(run.highlight)) marks.push({ type: "highlight", attrs: { color: run.highlight } });
  const style: Record<string, string> = {};
  if (run.color && HEX.test(run.color)) style.color = run.color;
  if (typeof run.size === "string" && /^\d{1,2}px$/.test(run.size)) style.fontSize = run.size;
  if (Object.keys(style).length) marks.push({ type: "textStyle", attrs: style });
  if (run.link && HTTPS.test(run.link)) marks.push({ type: "link", attrs: { href: run.link } });
  return marks.length ? { type: "text", text: run.text, marks } : { type: "text", text: run.text };
}

function paragraph(value: unknown, align?: string): JSONContent {
  const content = runsOf(value).map(runNode);
  return {
    type: "paragraph",
    attrs: align ? { textAlign: align } : undefined,
    content: content.length ? content : undefined,
  };
}

function heading(level: 1 | 2 | 3, value: unknown, align?: string): JSONContent {
  const content = runsOf(value).map(runNode);
  return {
    type: "heading",
    attrs: { level, ...(align ? { textAlign: align } : {}) },
    content: content.length ? content : [{ type: "text", text: "" }],
  };
}

function list(type: "bulletList" | "orderedList", items: unknown): JSONContent {
  const rows = Array.isArray(items) ? items : [];
  return {
    type,
    attrs: type === "orderedList" ? { start: 1 } : undefined,
    content: (rows.length ? rows : [""]).map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function checklist(items: unknown): JSONContent {
  const rows = Array.isArray(items) ? items : [];
  return {
    type: "taskList",
    content: (rows.length ? rows : [{ text: "" }]).map((item) => {
      const record = item && typeof item === "object" && !Array.isArray(item)
        ? (item as { text?: unknown; checked?: unknown })
        : { text: item, checked: false };
      return {
        type: "taskItem",
        attrs: { checked: record.checked === true },
        content: [paragraph(record.text)],
      };
    }),
  };
}

function image(block: BlockInput): JSONContent[] | { error: string } {
  const src = typeof block.src === "string" ? block.src.trim() : "";
  const fileId = typeof block.fileId === "string" ? block.fileId.trim() : "";
  if (src && !HTTPS.test(src)) return { error: "An image src must be an https URL." };
  if (!fileId && !HTTPS.test(src)) return { error: "An image src must be an https URL, or pass fileId from upload_asset." };
  const width = typeof block.width === "number" && block.width > 0 ? Math.min(Math.round(block.width), 1200) : null;
  const align = block.align === "center" || block.align === "right" || block.align === "left" ? block.align : null;
  const caption = typeof block.caption === "string" ? block.caption.trim().slice(0, 240) : "";
  return [
    {
      type: "image",
      attrs: {
        src: fileId ? null : src,
        alt: typeof block.alt === "string" ? block.alt.slice(0, 180) : null,
        width,
        fileId: fileId || null,
        align,
        caption: caption || null,
      },
    },
  ];
}

function diagram(block: BlockInput): JSONContent[] | { error: string } {
  const layout = block.layout === "stack" || block.layout === "hub" || block.layout === "timeline" ? block.layout : "row";
  const nodes = Array.isArray(block.nodes)
    ? block.nodes.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { id?: unknown; label?: unknown; caption?: unknown };
        const id = typeof record.id === "string" ? record.id.trim().slice(0, 40) : "";
        const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "";
        if (!id || !label) return [];
        const caption = typeof record.caption === "string" ? record.caption.trim().slice(0, 120) : "";
        return [{ id, label, ...(caption ? { caption } : {}) }];
      })
    : [];
  if (nodes.length === 0) return { error: "A diagram needs nodes, each with an id and a label." };
  if (nodes.length > 24) return { error: "A diagram accepts up to 24 nodes." };
  const known = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(block.edges)
    ? block.edges.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { from?: unknown; to?: unknown };
        const from = typeof record.from === "string" ? record.from : "";
        const to = typeof record.to === "string" ? record.to : "";
        if (!known.has(from) || !known.has(to) || from === to) return [];
        return [{ from, to }];
      }).slice(0, 40)
    : [];
  return [{ type: "diagram", attrs: { layout, nodes, edges } }];
}

function borderOf(value: unknown): "none" | "bottom" | "band" | null {
  if (value === "none") return "none";
  if (value === "line") return "bottom";
  if (value === "band") return "band";
  return null;
}

function cellNode(input: string | TextRun | CellInput | Array<string | TextRun>, header = false): JSONContent {
  const cell = typeof input === "string" || Array.isArray(input) || (input && "text" in input && !("fill" in input) && !("border" in input))
    ? ({ text: input as string | TextRun | Array<string | TextRun> } satisfies CellInput)
    : (input as CellInput);
  const fill = cell.fill && HEX.test(cell.fill) ? cell.fill : null;
  return {
    type: cell.header || header ? "tableHeader" : "tableCell",
    attrs: {
      backgroundColor: fill,
      borderStyle: borderOf(cell.border),
    },
    content: [paragraph(cell.text, alignOf(cell.align))],
  };
}

function tableBlock(block: BlockInput): JSONContent {
  const columns = Array.isArray(block.columns) ? block.columns.map((column) => textOf(column) || String(column)) : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const header = block.header !== false && columns.length > 0;
  const head = header
    ? [
        {
          type: "tableRow",
          content: columns.map((label) =>
            cellNode({ text: { text: label.toUpperCase(), bold: true, color: "#334155", size: "11px" }, fill: HEAD, header: true }),
          ),
        },
      ]
    : [];
  const body = rows.map((row) => ({
    type: "tableRow",
    content: (Array.isArray(row) ? row : [row]).map((cell) => cellNode(cell as string | CellInput)),
  }));
  return { type: "table", content: [...head, ...body] };
}

function cover(block: BlockInput): JSONContent {
  const title = textOf(block.title) || "Title";
  const kicker = textOf(block.kicker) || "Document";
  const subtitle = textOf(block.subtitle);
  const fill = typeof block.fill === "string" && HEX.test(block.fill) ? block.fill : COVER;
  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            attrs: { backgroundColor: fill, borderStyle: "band" },
            content: [
              paragraph([{ text: kicker.toUpperCase(), bold: true, color: COVER_ACCENT, size: "11px" }]),
              heading(1, [{ text: title, color: "#ffffff", size: "32px" }]),
              ...(subtitle ? [paragraph([{ text: subtitle, color: COVER_TEXT }])] : []),
            ],
          },
        ],
      },
    ],
  };
}

function facts(items: unknown): JSONContent {
  const pairs = Array.isArray(items)
    ? items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { label?: unknown; value?: unknown };
        return [[textOf(record.label) || "Label", textOf(record.value) || "Value"] as const];
      })
    : [];
  const source = pairs.length ? pairs : [["Label", "Value"]];
  const rows: JSONContent[] = [];
  for (let index = 0; index < source.length; index += 3) {
    const chunk = source.slice(index, index + 3);
    const cells = chunk.map(([label, value]) => ({
      type: "tableCell",
      attrs: { backgroundColor: BAND, borderStyle: "none" },
      content: [
        paragraph([{ text: label.toUpperCase(), bold: true, color: MUTED, size: "10px" }]),
        paragraph([{ text: value, bold: true, color: INK }]),
      ],
    }));
    while (cells.length < 3) {
      cells.push({
        type: "tableCell",
        attrs: { backgroundColor: BAND, borderStyle: "none" },
        content: [paragraph("")],
      });
    }
    rows.push({ type: "tableRow", content: cells });
  }
  return { type: "table", content: rows };
}

function signatures(left: string, right: string): JSONContent {
  const none = (text: TextRun | string) =>
    cellNode({ text, border: "none" });
  const line = (label: string) => ({
    type: "tableRow",
    content: [
      cellNode({ text: { text: `${label}: `, color: MUTED, size: "12px" }, border: "line" }),
      cellNode({ text: "", border: "none" }),
      cellNode({ text: { text: `${label}: `, color: MUTED, size: "12px" }, border: "line" }),
    ],
  });
  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          none({ text: left.toUpperCase(), bold: true, color: ACCENT, size: "11px" }),
          none(""),
          none({ text: right.toUpperCase(), bold: true, color: ACCENT, size: "11px" }),
        ],
      },
      {
        type: "tableRow",
        content: [
          cellNode({ text: "", border: "line" }),
          cellNode({ text: "", border: "none" }),
          cellNode({ text: "", border: "line" }),
        ],
      },
      line("Name"),
      line("Title"),
      line("Date"),
    ],
  };
}

export function appendBlocks(doc: JSONContent, blocks: JSONContent[], placement: "append" | "start" | "replace"): JSONContent {
  if (placement === "replace") return { type: "doc", content: blocks };
  const current = doc.content ?? [];
  return {
    type: "doc",
    content: placement === "start" ? [...blocks, ...current] : [...current, ...blocks],
  };
}

export function shapeNode(type: "cover" | "facts" | "callout" | "signatures" | "diagram"): JSONContent {
  const built = blockToNodes(
    type === "cover"
      ? { type: "cover", kicker: "Document", title: "Title", subtitle: "One line under the title" }
      : type === "facts"
        ? {
            type: "facts",
            items: [
              { label: "Client", value: "Name" },
              { label: "Date", value: "Date" },
              { label: "Reference", value: "REF-001" },
            ],
          }
        : type === "callout"
          ? { type: "callout", text: "A short note set apart from the body." }
          : type === "diagram"
            ? {
                type: "diagram",
                layout: "row",
                nodes: [
                  { id: "a", label: "Start" },
                  { id: "b", label: "Next" },
                ],
                edges: [{ from: "a", to: "b" }],
              }
            : { type: "signatures", left: "Provider", right: "Client" },
  );
  if ("error" in built) return { type: "paragraph" };
  return built[0] ?? { type: "paragraph" };
}
