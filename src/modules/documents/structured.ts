import type { JSONContent } from "@tiptap/core";
import { getAppUrl } from "@/shared/email";
import { documentTables } from "@/modules/documents/template-fill";
import { DOCUMENT_TEMPLATES, type DocumentTemplate } from "@/modules/documents/templates";

export type TemplateFieldValue = string | string[];

function placeholderPattern() {
  return /\[([^\]\n]{1,120})\]/g;
}

/** Labels the template still expects, in document order, with how often each one appears. */
export function collectPlaceholders(doc: JSONContent): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) {
      for (const match of node.text.matchAll(placeholderPattern())) {
        counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
      }
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

/**
 * Fills template placeholders.
 * A string replaces a label that appears once, such as the client name.
 * It does not copy one string into every row of a table.
 * An array fills copies of that label in order and leaves any extra copy untouched.
 */
export function applyStructuredFills(
  doc: JSONContent,
  data: Record<string, TemplateFieldValue>,
  options?: { rowLabels?: Set<string> },
): JSONContent {
  const rowLabels = options?.rowLabels;
  const repeated = new Map<string, string[]>();
  const shared = new Map<string, string>();
  for (const [label, value] of Object.entries(data)) {
    if (Array.isArray(value)) repeated.set(label, value.map((item) => item.trim()).filter(Boolean));
    else if (value.trim()) shared.set(label, value.trim());
  }
  const seen = new Map<string, number>();

  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "text" && typeof node.text === "string") {
      let changed = false;
      const text = node.text.replace(placeholderPattern(), (full, label: string) => {
        if (repeated.has(label)) {
          const queue = repeated.get(label) ?? [];
          const index = seen.get(label) ?? 0;
          seen.set(label, index + 1);
          const next = queue[index];
          if (!next) return full;
          changed = true;
          return next;
        }
        const value = shared.get(label);
        if (!value || rowLabels?.has(label)) return full;
        changed = true;
        return value;
      });
      if (!changed) return node;
      const stillOpen = /\[[^\]\n]{1,120}\]/.test(text);
      const marks = stillOpen ? (node.marks ?? []) : (node.marks ?? []).filter((mark) => mark.type !== "highlight");
      return marks.length ? { ...node, text, marks } : { type: "text", text };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  };

  return walk(doc);
}

export function documentWarnings(
  doc: JSONContent,
  meta: { title?: string | null; clientId?: string | null; projectId?: string | null; leadId?: string | null },
) {
  const warnings = collectPlaceholders(doc).map((field) => `${field.label} is not filled in`);
  if (!meta.title?.trim()) warnings.unshift("Document title is missing");
  if (!meta.clientId && meta.leadId) {
    warnings.push("No client is linked. This lead has not been converted to a client.");
  } else if (!meta.clientId) warnings.push("No client is linked");
  if (!meta.projectId) warnings.push("No project is linked");
  return {
    readyForSignature: warnings.length === 0,
    warnings,
  };
}

export function listDocumentTemplates() {
  return DOCUMENT_TEMPLATES.map((template) => describeTemplate(template));
}

const DESIGN: Record<string, string> = {
  sow: [
    "Keep this statement of work. Do not replace it with Markdown, a new outline, or write_document.",
    "Cover, then an info grid (Client, Service provider, SOW number, Effective date, Project, Governing agreement).",
    "1 Purpose. 2 Background & objectives: one paragraph, then three objective bullets.",
    "3 Scope of services: three numbered workstreams, then the fixed out-of-scope bullets.",
    "4 Deliverables table, columns #, Deliverable, Acceptance criteria, Due, rows D1 D2 D3.",
    "5 Milestones table, columns ID, Milestone, Start, End, rows M1 Discovery & planning, M2 Design / build, M3 Testing & launch.",
    "6 Roles table, columns Role, Name, Responsibilities, rows Provider project lead, Client sponsor, Client approver.",
    "7 Fees: one pricing-model sentence, then a payment table with rows Signature, M2 complete, M3 complete, and a total row.",
    "8 Assumptions & dependencies: two bullets. 9 Change management. 10 Acceptance. 11 Term & termination. Then the signature block.",
    "Fill with data. sowNumber, effectiveDate, governingAgreement, masterServicesAgreement, businessContext, objectives (up to 3), workstreams (up to 3), assumption, dependency, pricingModel.",
    "deliverables is one object per row: id, title, description, acceptanceCriteria, dueDate. description is a second line in the Deliverable cell.",
    "milestones is one object per row: id, title, start, end. roles is one object per row: role, name, responsibilities. name is the person, responsibilities is the duties.",
    "paymentSchedule is one object per row: milestone, percent, amount, invoicedOn.",
    "Leave unknown fees, dates, and the MSA as the existing placeholders. Do not invent them. A lead id is not a client.",
    "preview_document must include the document id. Without an id it returns this blank template, not the saved document.",
  ].join(" "),
};

function designFor(template: DocumentTemplate, content: JSONContent) {
  const specific = DESIGN[template.id];
  if (specific) return specific;
  const tables = documentTables(content);
  const tableLine = tables.length
    ? `Tables: ${tables.map((table) => `${table.columns.join(", ")} (${table.rows.join(", ") || "rows"})`).join("; ")}.`
    : "";
  const sections = template.outline.length ? `Sections: ${template.outline.join(", ")}.` : "";
  return [
    `Keep the ${template.name} layout. Fill its highlighted placeholders and table rows.`,
    sections,
    tableLine,
    "Do not replace the layout with Markdown or write_document. Leave unknown fees and dates as placeholders.",
    "preview_document must include the document id. Without an id it returns this blank template, not the saved document.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function describeTemplate(template: DocumentTemplate) {
  const content = template.build({ title: template.name, orgName: "Studio" });
  return {
    id: template.id,
    name: template.name,
    kind: template.kind,
    description: template.description,
    outline: template.outline,
    design: designFor(template, content),
    fields: collectPlaceholders(content),
    tables: documentTables(content),
  };
}

export function documentPreviewUrl(orgSlug: string, documentId: string, version?: number | null) {
  const path = `/${orgSlug}/documents/${documentId}/preview`;
  const withVersion = version != null ? `${path}?version=${version}` : path;
  return `${getAppUrl()}${withVersion}`;
}
