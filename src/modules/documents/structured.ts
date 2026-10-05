import type { JSONContent } from "@tiptap/core";
import { getAppUrl } from "@/shared/email";
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
 * Fills template placeholders from structured field values.
 * A string replaces every copy of that label. An array replaces copies in order
 * and leaves any extra copy untouched.
 */
export function applyStructuredFills(doc: JSONContent, data: Record<string, TemplateFieldValue>): JSONContent {
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
        if (!value) return full;
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
  meta: { title?: string | null; clientId?: string | null; projectId?: string | null },
) {
  const warnings = collectPlaceholders(doc).map((field) => `${field.label} is not filled in`);
  if (!meta.title?.trim()) warnings.unshift("Document title is missing");
  if (!meta.clientId) warnings.push("No client is linked");
  if (!meta.projectId) warnings.push("No project is linked");
  return {
    readyForSignature: warnings.length === 0,
    warnings,
  };
}

export function listDocumentTemplates() {
  return DOCUMENT_TEMPLATES.map((template) => describeTemplate(template));
}

export function describeTemplate(template: DocumentTemplate) {
  const content = template.build({ title: template.name, orgName: "Studio" });
  return {
    id: template.id,
    name: template.name,
    kind: template.kind,
    description: template.description,
    outline: template.outline,
    fields: collectPlaceholders(content),
  };
}

export function documentPreviewUrl(orgSlug: string, documentId: string, version?: number | null) {
  const path = `/${orgSlug}/documents/${documentId}/preview`;
  const withVersion = version != null ? `${path}?version=${version}` : path;
  return `${getAppUrl()}${withVersion}`;
}
