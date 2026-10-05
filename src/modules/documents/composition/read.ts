import type { Block } from "@/modules/documents/composition/schema";

export function textOf(node: Block, key = "text") {
  const value = node.props[key];
  return typeof value === "string" ? value : "";
}

export function itemsOf(node: Block) {
  const value = node.props.items;
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : "")).filter(Boolean);
}

export type TableColumn = { key: string; label: string; align?: string };
export type TableRow = Record<string, string>;

export function tableOf(node: Block): { columns: TableColumn[]; rows: TableRow[] } {
  const columns = Array.isArray(node.props.columns)
    ? node.props.columns.flatMap((column) => {
        if (!column || typeof column !== "object") return [];
        const record = column as { key?: unknown; label?: unknown; align?: unknown };
        const key = typeof record.key === "string" ? record.key : "";
        if (!key) return [];
        return [{ key, label: typeof record.label === "string" ? record.label : key, align: typeof record.align === "string" ? record.align : undefined }];
      })
    : [];
  const rows = Array.isArray(node.props.rows)
    ? node.props.rows.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const record: TableRow = {};
        for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
          record[key] = value == null ? "" : String(value);
        }
        return [record];
      })
    : [];
  return { columns, rows };
}

export type DiagramNode = {
  id: string;
  label: string;
  caption?: string;
  icon?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fields?: { name: string; key?: "pk" | "fk" }[];
};

export type DiagramEdge = { from: string; to: string; label?: string };

export function diagramOf(node: Block): { layout: "stack" | "row" | "hub" | "timeline"; nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const layout = node.props.layout;
  const safe = layout === "stack" || layout === "hub" || layout === "timeline" || layout === "row" ? layout : "row";
  const nodes = Array.isArray(node.props.nodes)
    ? node.props.nodes.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { id?: unknown; label?: unknown; caption?: unknown; icon?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown; fields?: unknown };
        const id = typeof record.id === "string" ? record.id : "";
        if (!id) return [];
        const fields: { name: string; key?: "pk" | "fk" }[] | undefined = Array.isArray(record.fields)
          ? record.fields.flatMap((field) => {
              if (!field || typeof field !== "object") return [];
              const row = field as { name?: unknown; key?: unknown };
              if (typeof row.name !== "string") return [];
              const mark = row.key === "pk" || row.key === "fk" ? row.key : undefined;
              const entry: { name: string; key?: "pk" | "fk" } = mark ? { name: row.name, key: mark } : { name: row.name };
              return [entry];
            })
          : undefined;
        return [{
          id,
          label: typeof record.label === "string" ? record.label : id,
          caption: typeof record.caption === "string" ? record.caption : undefined,
          icon: typeof record.icon === "string" ? record.icon : undefined,
          x: typeof record.x === "number" ? record.x : undefined,
          y: typeof record.y === "number" ? record.y : undefined,
          w: typeof record.w === "number" ? record.w : undefined,
          h: typeof record.h === "number" ? record.h : undefined,
          fields,
        }];
      })
    : [];
  const edges = Array.isArray(node.props.edges)
    ? node.props.edges.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { from?: unknown; to?: unknown; label?: unknown };
        if (typeof record.from !== "string" || typeof record.to !== "string") return [];
        return [{ from: record.from, to: record.to, label: typeof record.label === "string" ? record.label : undefined }];
      })
    : [];
  return { layout: safe, nodes, edges };
}

/** Split a table so each page repeats the header. */
export function splitTableRows<T>(rows: T[], size = 12): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += size) pages.push(rows.slice(index, index + size));
  return pages;
}
