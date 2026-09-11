import type { JSONContent } from "@tiptap/core";

export type DocumentRefEntityType = "client" | "project" | "milestone" | "task";

export type DocumentRef = {
  entityType: DocumentRefEntityType;
  entityId: string;
  label?: string;
};

const REF_TYPES = new Set<DocumentRefEntityType>([
  "client",
  "project",
  "milestone",
  "task",
]);

export function asDocumentRefType(value: string | null | undefined): DocumentRefEntityType | null {
  if (!value) return null;
  return REF_TYPES.has(value as DocumentRefEntityType)
    ? (value as DocumentRefEntityType)
    : null;
}

/** Walk TipTap JSON and collect unique mention chips. */
export function extractDocumentRefs(doc: JSONContent | null | undefined): DocumentRef[] {
  if (!doc) return [];
  const seen = new Set<string>();
  const out: DocumentRef[] = [];

  function walk(node: JSONContent) {
    if (node.type === "mention") {
      const id = String(node.attrs?.id ?? "").trim();
      const type = asDocumentRefType(String(node.attrs?.type ?? "").trim());
      const label = String(node.attrs?.label ?? "").trim() || undefined;
      if (id && type && !id.startsWith("__create__:")) {
        const key = `${type}:${id}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ entityType: type, entityId: id, label });
        }
      }
    }
    for (const child of node.content ?? []) walk(child);
  }

  walk(doc);
  return out;
}

export function buildMilestoneTableDoc(
  rows: { name: string; amount: string; due: string; status: string }[],
): JSONContent {
  const header = tableRow([
    headerCell("Milestone"),
    headerCell("Amount"),
    headerCell("Due"),
    headerCell("Status"),
  ]);
  const body = rows.map((row) =>
    tableRow([
      cell(row.name),
      cell(row.amount),
      cell(row.due),
      cell(row.status),
    ]),
  );
  return {
    type: "table",
    content: [header, ...body],
  };
}

export function buildTaskTableDoc(
  rows: { title: string; status: string; due: string }[],
): JSONContent {
  const header = tableRow([headerCell("Task"), headerCell("Status"), headerCell("Due")]);
  const body = rows.map((row) =>
    tableRow([cell(row.title), cell(row.status), cell(row.due)]),
  );
  return {
    type: "table",
    content: [header, ...body],
  };
}

function tableRow(cells: JSONContent[]): JSONContent {
  return { type: "tableRow", content: cells };
}

function headerCell(text: string): JSONContent {
  return {
    type: "tableHeader",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}

function cell(text: string): JSONContent {
  return {
    type: "tableCell",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}
