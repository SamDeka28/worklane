import { collectTypes, type CompositionDocument } from "@/modules/documents/composition/schema";
import { parseComposition } from "@/modules/documents/composition/schema";

const SIGNABLE = new Set(["proposal", "sow", "contract", "nda", "change_order"]);

export function supportsSignature(kind: string) {
  return SIGNABLE.has(kind);
}

export function validateCompositionDocument(
  doc: CompositionDocument,
  meta: { clientId?: string | null; projectId?: string | null } = {},
) {
  const parsed = parseComposition(doc);
  const warnings: string[] = "error" in parsed ? [parsed.error] : [];
  const types = collectTypes(doc);
  const kind = doc.kind;

  if (!doc.metadata.title?.trim()) warnings.push("Document title is missing");
  if (kind === "sow" || kind === "proposal" || kind === "contract") {
    if (!meta.clientId && !doc.metadata.client) warnings.push("No client is linked");
  }
  if (kind === "sow") {
    if (!types.has("table") && !hasText(doc, /scope|deliverable/i)) warnings.push("Scope or deliverables are missing");
    if (!types.has("signature")) warnings.push("A signature block is required");
  }
  if (kind === "contract") {
    if (!types.has("signature")) warnings.push("A signature block is required");
    if (!doc.metadata.client && !meta.clientId) warnings.push("Parties are incomplete");
  }
  if (kind === "invoice") {
    if (!meta.clientId && !doc.metadata.client) warnings.push("No client is linked");
    if (!types.has("table")) warnings.push("Line items are missing");
  }
  if (!meta.projectId && (kind === "sow" || kind === "proposal")) warnings.push("No project is linked");

  const signatureRequired = kind === "sow" || kind === "contract";
  const blocking = warnings.filter((warning) => {
    if (!signatureRequired && warning.startsWith("A signature")) return false;
    if ((kind === "prs" || kind === "srs" || kind === "report" || kind === "other") && warning.startsWith("No project")) {
      return false;
    }
    return true;
  });

  return {
    supportsSignature: supportsSignature(kind),
    readyForSignature: signatureRequired ? blocking.length === 0 && types.has("signature") : false,
    warnings: [...new Set(warnings)],
  };
}

function hasText(doc: CompositionDocument, pattern: RegExp) {
  const blob = JSON.stringify(doc.sections);
  return pattern.test(blob);
}
