import { COMPOSITION_TEMPLATES } from "@/modules/documents/composition/templates";
import { DOCUMENT_TEMPLATES } from "@/modules/documents/templates";

export type PickerTemplate = {
  id: string;
  kind: string;
  name: string;
  description: string;
};

function choice(template: { id: string; kind: string; name: string; description: string }): PickerTemplate {
  return {
    id: template.id,
    kind: template.kind,
    name: template.name,
    description: template.description,
  };
}

/**
 * One starting point per kind. Written templates are what creating a document
 * actually builds. A composed layout is listed only when that kind has no
 * written template, so the menu does not offer the same type twice.
 */
export function documentPickerOptions(kind: string): PickerTemplate[] {
  const written = DOCUMENT_TEMPLATES.filter((template) => template.kind === kind);
  if (written.length > 0) return written.map(choice);
  return COMPOSITION_TEMPLATES.filter((template) => template.kind === kind).map(choice);
}
