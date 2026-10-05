import type { JSONContent } from "@tiptap/core";
import { applyStructuredFills, type TemplateFieldValue } from "@/modules/documents/structured";

export type DeliverableRow = {
  id?: string;
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  dueDate?: string;
};

export type MilestoneRow = {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
};

export type RoleRow = {
  role?: string;
  name?: string;
  responsibilities?: string;
};

export type PaymentRow = {
  milestone?: string;
  percent?: string;
  amount?: string;
  invoicedOn?: string;
};

const STRUCTURED_KEYS = new Set([
  "deliverables",
  "milestones",
  "roles",
  "paymentSchedule",
  "payments",
  "workstreams",
  "scope",
  "objectives",
  "sowNumber",
  "effectiveDate",
  "governingAgreement",
  "masterServicesAgreement",
  "pricingModel",
  "businessContext",
  "assumption",
  "dependency",
  "clientName",
  "projectName",
]);

function textOf(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "text" && node.text) return node.text;
  if (node.type === "mention" && typeof node.attrs?.label === "string") return String(node.attrs.label);
  return (node.content ?? []).map((child) => textOf(child)).join("");
}

function headersOf(table: JSONContent): string[] {
  const row = table.content?.[0];
  if (!row?.content?.length) return [];
  if (row.content.some((cell) => cell.type !== "tableHeader")) return [];
  return row.content.map((cell) => textOf(cell).replace(/\s+/g, " ").trim());
}

function columnIndex(headers: string[], ...needles: string[]) {
  return headers.findIndex((header) => {
    const label = header.toLowerCase();
    return needles.some((needle) => label === needle || label.includes(needle));
  });
}

type TableKind = "deliverables" | "milestones" | "roles" | "payments";

function tableKind(headers: string[]): TableKind | null {
  const labels = headers.map((header) => header.toLowerCase());
  const has = (needle: string) => labels.some((label) => label.includes(needle));
  if (has("deliverable") && has("acceptance")) return "deliverables";
  if (has("role") && has("responsibil")) return "roles";
  if (has("amount") && (has("invoiced") || has("%") || labels.some((label) => label === "%"))) return "payments";
  if (has("milestone") && has("start") && has("end")) return "milestones";
  return null;
}

function writeCell(cell: JSONContent, paragraphs: string[]): JSONContent {
  const content = paragraphs.filter((paragraph) => paragraph.trim()).map((paragraph) => ({
    type: "paragraph",
    content: [{ type: "text", text: paragraph.trim() }],
  }));
  if (content.length === 0) return cell;
  return { ...cell, content };
}

function setColumn(row: JSONContent, index: number, paragraphs: string[]) {
  if (index < 0 || !row.content?.[index]) return row;
  const content = row.content.map((cell, cellIndex) => (cellIndex === index ? writeCell(cell, paragraphs) : cell));
  return { ...row, content };
}

function bodyRows(table: JSONContent) {
  return (table.content ?? []).slice(1);
}

function replaceBody(table: JSONContent, rows: JSONContent[]): JSONContent {
  return { ...table, content: [table.content![0], ...rows] };
}

function asRows<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as T[];
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function roleMatch(rowLabel: string, role: string) {
  const left = rowLabel.toLowerCase();
  const right = role.toLowerCase();
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  if (right.includes("provider") && left.includes("provider")) return true;
  if (right.includes("sponsor") && left.includes("sponsor")) return true;
  if (right.includes("approver") && left.includes("approver")) return true;
  return false;
}

function fillDeliverables(table: JSONContent, headers: string[], rows: DeliverableRow[]) {
  const titleCol = columnIndex(headers, "deliverable");
  const criteriaCol = columnIndex(headers, "acceptance");
  const dueCol = columnIndex(headers, "due");
  const body = bodyRows(table);
  const used = new Set<number>();
  rows.forEach((row, index) => {
    const id = row.id?.trim().toLowerCase();
    let target = id ? body.findIndex((candidate) => textOf(candidate.content?.[0]).trim().toLowerCase() === id) : -1;
    if (target < 0) target = body.findIndex((_, rowIndex) => !used.has(rowIndex) && rowIndex === index);
    if (target < 0 || used.has(target)) return;
    used.add(target);
    let next = body[target];
    if (row.title || row.description) {
      next = setColumn(next, titleCol, [row.title ?? "", row.description ?? ""]);
    }
    if (row.acceptanceCriteria) next = setColumn(next, criteriaCol, [row.acceptanceCriteria]);
    if (row.dueDate) next = setColumn(next, dueCol, [row.dueDate]);
    body[target] = next;
  });
  return replaceBody(table, body);
}

function fillMilestones(table: JSONContent, headers: string[], rows: MilestoneRow[]) {
  const titleCol = columnIndex(headers, "milestone");
  const startCol = columnIndex(headers, "start");
  const endCol = columnIndex(headers, "end");
  const body = bodyRows(table);
  const used = new Set<number>();
  rows.forEach((row, index) => {
    const id = row.id?.trim().toLowerCase();
    let target = id ? body.findIndex((candidate) => textOf(candidate.content?.[0]).trim().toLowerCase() === id) : -1;
    if (target < 0) target = body.findIndex((_, rowIndex) => !used.has(rowIndex) && rowIndex === index);
    if (target < 0 || used.has(target)) return;
    used.add(target);
    let next = body[target];
    if (row.title) next = setColumn(next, titleCol, [row.title]);
    if (row.start) next = setColumn(next, startCol, [row.start]);
    if (row.end) next = setColumn(next, endCol, [row.end]);
    body[target] = next;
  });
  return replaceBody(table, body);
}

function fillRoles(table: JSONContent, headers: string[], rows: RoleRow[]) {
  const nameCol = columnIndex(headers, "name");
  const dutyCol = columnIndex(headers, "responsibil");
  const body = bodyRows(table);
  const used = new Set<number>();
  for (const row of rows) {
    const target = body.findIndex((candidate, index) => !used.has(index) && roleMatch(textOf(candidate.content?.[0]), row.role ?? ""));
    const index = target >= 0 ? target : body.findIndex((_, rowIndex) => !used.has(rowIndex));
    if (index < 0) continue;
    used.add(index);
    let next = body[index];
    if (row.name) next = setColumn(next, nameCol, [row.name]);
    if (row.responsibilities) next = setColumn(next, dutyCol, [row.responsibilities]);
    body[index] = next;
  }
  return replaceBody(table, body);
}

function fillPayments(table: JSONContent, headers: string[], rows: PaymentRow[]) {
  const labelCol = columnIndex(headers, "milestone");
  const percentCol = columnIndex(headers, "%");
  const amountCol = columnIndex(headers, "amount");
  const whenCol = columnIndex(headers, "invoiced");
  const body = bodyRows(table);
  const used = new Set<number>();
  rows.forEach((row, index) => {
    const label = row.milestone?.trim().toLowerCase();
    let target = label
      ? body.findIndex((candidate) => textOf(candidate.content?.[labelCol]).trim().toLowerCase() === label)
      : -1;
    if (target < 0) target = body.findIndex((_, rowIndex) => !used.has(rowIndex) && rowIndex === index);
    if (target < 0 || used.has(target)) return;
    used.add(target);
    let next = body[target];
    if (row.percent) next = setColumn(next, percentCol, [row.percent]);
    if (row.amount) next = setColumn(next, amountCol, [row.amount]);
    if (row.invoicedOn) next = setColumn(next, whenCol, [row.invoicedOn]);
    body[target] = next;
  });
  return replaceBody(table, body);
}

function mapTables(doc: JSONContent, data: Record<string, unknown>): JSONContent {
  const deliverables = asRows<DeliverableRow>(data.deliverables);
  const milestones = asRows<MilestoneRow>(data.milestones);
  const roles = asRows<RoleRow>(data.roles);
  const payments = asRows<PaymentRow>(data.paymentSchedule ?? data.payments);
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "table") {
      const headers = headersOf(node);
      const kind = tableKind(headers);
      if (kind === "deliverables" && deliverables.length) return fillDeliverables(node, headers, deliverables);
      if (kind === "milestones" && milestones.length) return fillMilestones(node, headers, milestones);
      if (kind === "roles" && roles.length) return fillRoles(node, headers, roles);
      if (kind === "payments" && payments.length) return fillPayments(node, headers, payments);
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  };
  return walk(doc);
}

function fillRepeatedList(doc: JSONContent, label: string, values: string[]): JSONContent {
  if (values.length === 0) return doc;
  let index = 0;
  const token = `[${label}]`;
  const walk = (node: JSONContent): JSONContent => {
    if ((node.type === "listItem" || node.type === "taskItem") && textOf(node).trim() === token) {
      const value = values[index];
      index += 1;
      if (!value) return node;
      return { ...node, content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  };
  return walk(doc);
}

function fillInfoValue(doc: JSONContent, label: string, value: string): JSONContent {
  if (!value.trim()) return doc;
  const wanted = label.toLowerCase();
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "tableCell" || node.type === "tableHeader") {
      const paragraphs = node.content ?? [];
      const first = textOf(paragraphs[0]).trim().toLowerCase();
      if (first === wanted && paragraphs[1]) {
        const content = paragraphs.map((paragraph, index) =>
          index === 1 ? { type: "paragraph", content: [{ type: "text", text: value.trim(), marks: paragraph.content?.[0]?.marks }] } : paragraph,
        );
        return { ...node, content };
      }
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  };
  return walk(doc);
}

/** Placeholder labels that sit in repeating table cells or repeating list items. */
export function repeatedRowLabels(doc: JSONContent): Set<string> {
  const counts = new Map<string, number>();
  const take = (text: string) => {
    for (const match of text.matchAll(/\[([^\]\n]{1,120})\]/g)) {
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
  };
  const walk = (node: JSONContent, inRow: boolean) => {
    if (node.type === "table") {
      const headers = headersOf(node);
      const repeating = tableKind(headers) != null;
      for (const row of (node.content ?? []).slice(repeating ? 1 : 0)) walk(row, repeating);
      return;
    }
    if ((node.type === "orderedList" || node.type === "bulletList") && node.content && node.content.length > 1) {
      for (const item of node.content) walk(item, true);
      return;
    }
    if (inRow && node.type === "text" && node.text) take(node.text);
    for (const child of node.content ?? []) walk(child, inRow);
  };
  walk(doc, false);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label));
}

function scalarAliases(data: Record<string, unknown>): Record<string, TemplateFieldValue> {
  const flat: Record<string, TemplateFieldValue> = {};
  const assign = (label: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) flat[label] = value.trim();
  };
  assign("SOW-001", data.sowNumber);
  assign("MSA dated …", data.governingAgreement);
  assign("Master Services Agreement", data.masterServicesAgreement);
  assign("Fixed fee / Time & materials at $X per hour", data.pricingModel);
  assign("Business context and why the work is needed.", data.businessContext);
  assign("Assumption", data.assumption);
  assign("Dependency on the client or a third party", data.dependency);
  assign("Client name", data.clientName);
  assign("Project name", data.projectName);
  const objectives = asStrings(data.objectives);
  objectives.forEach((objective, index) => {
    flat[`Objective ${index + 1}`] = objective;
  });
  for (const [key, value] of Object.entries(data)) {
    if (STRUCTURED_KEYS.has(key) || flat[key] != null) continue;
    if (typeof value === "string" && value.trim()) flat[key] = value.trim();
    else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      flat[key] = value.map((item) => item.trim()).filter(Boolean);
    }
  }
  return flat;
}

/**
 * Writes MCP field data into the existing template document.
 * Tables keep their columns. Each deliverable, milestone, role, and payment
 * is written into its own row. One string is never copied into every repeated row.
 */
export function applyDocumentData(doc: JSONContent, data: Record<string, unknown>): JSONContent {
  const rowLabels = repeatedRowLabels(doc);
  let next = mapTables(doc, data);
  next = fillRepeatedList(next, "Service or workstream", asStrings(data.workstreams ?? data.scope));
  if (typeof data.effectiveDate === "string") next = fillInfoValue(next, "effective date", data.effectiveDate);
  return applyStructuredFills(next, scalarAliases(data), { rowLabels });
}

export function documentTables(doc: JSONContent) {
  const tables: { columns: string[]; rows: string[] }[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "table") {
      const columns = headersOf(node);
      const kind = tableKind(columns);
      if (kind) {
        tables.push({
          columns,
          rows: bodyRows(node).map((row) => textOf(row.content?.[0]).trim()).filter(Boolean),
        });
      }
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return tables;
}

/** Reads one data table back as rows of plain cell text, for checks against the template. */
export function readTable(doc: JSONContent, kind: TableKind): string[][] {
  let found: string[][] = [];
  const walk = (node: JSONContent) => {
    if (found.length || node.type !== "table") {
      for (const child of node.content ?? []) walk(child);
      return;
    }
    const headers = headersOf(node);
    if (tableKind(headers) !== kind) {
      for (const child of node.content ?? []) walk(child);
      return;
    }
    found = (node.content ?? []).map((row) =>
      (row.content ?? []).map((cell) =>
        (cell.content ?? [])
          .map((block) => textOf(block).replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join("\n"),
      ),
    );
  };
  walk(doc);
  return found;
}
