import { describe, expect, it } from "vitest";
import { resolveDocumentTemplate } from "@/modules/documents/templates";

const lynqo = "Lynqo — Product Requirements & Software Requirements Specification";

describe("document kinds", () => {
  it("creates a prs from the product requirements template", () => {
    const resolved = resolveDocumentTemplate({ kind: "prs" });
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.kind).toBe("prs");
    expect(resolved.template.id).toBe("prs");
    expect(resolved.template.kind).toBe("prs");
    const doc = resolved.template.build({ title: lynqo, orgName: "MPAARS" });
    const json = JSON.stringify(doc);
    expect(json).toContain(lynqo);
    expect(json).toContain("Product vision");
    expect(json).toContain("Problem and opportunity");
    expect(json).toContain("Definition of done");
    expect(json).toContain("Document control");
    expect(json).toContain('"type":"diagram"');
    expect(json).not.toContain('"type":"image"');
    expect(json).not.toContain("Valid until");
  });

  it("does not render a prs with the proposal or blank template", () => {
    const proposal = resolveDocumentTemplate({ templateId: "proposal", kind: "prs" });
    expect(proposal).toEqual({ error: "A PRS uses the product requirements template, not another document type." });
    const missing = resolveDocumentTemplate({ templateId: "does-not-exist", kind: "prs" });
    expect(missing).toEqual({ error: "That document template does not exist." });
    const blank = resolveDocumentTemplate({ kind: "prs" });
    expect("error" in blank).toBe(false);
    if ("error" in blank) return;
    expect(blank.template.id).not.toBe("blank");
    expect(blank.template.id).not.toBe("proposal");
  });

  it("resolves the other document kinds to their own templates", () => {
    expect(resolveDocumentTemplate({ kind: "proposal" })).toMatchObject({ kind: "proposal", template: { id: "proposal" } });
    expect(resolveDocumentTemplate({ kind: "sow" })).toMatchObject({ kind: "sow", template: { id: "sow" } });
    expect(resolveDocumentTemplate({ kind: "contract" })).toMatchObject({ kind: "contract", template: { id: "msa" } });
    expect(resolveDocumentTemplate({ kind: "nda" })).toMatchObject({ kind: "nda", template: { id: "nda" } });
    expect(resolveDocumentTemplate({ kind: "brief" })).toMatchObject({ kind: "brief", template: { id: "brief" } });
    expect(resolveDocumentTemplate({ kind: "change_order" })).toMatchObject({ kind: "change_order", template: { id: "change_order" } });
    expect(resolveDocumentTemplate({ kind: "report" })).toMatchObject({ kind: "report", template: { id: "status_report" } });
    expect(resolveDocumentTemplate({ kind: "general" })).toMatchObject({ kind: "other", template: { id: "blank" } });
    expect(resolveDocumentTemplate({ kind: "other" })).toMatchObject({ kind: "other", template: { id: "blank" } });
    expect(resolveDocumentTemplate({ templateId: "sow" })).toMatchObject({ kind: "sow", template: { id: "sow" } });
  });
});
