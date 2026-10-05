import { describe, expect, it } from "vitest";
import { layoutDiagramData } from "@/modules/documents/composition/diagram";
import { exampleProposalDocument, exampleRequirementsDocument } from "@/modules/documents/composition/fixtures";
import { splitTableRows } from "@/modules/documents/composition/read";
import { blockRenderProps, registeredBlockTypes, smokeRender } from "@/modules/documents/composition/registry";
import { clipShapes, materializeDocument } from "@/modules/documents/composition/frames";
import { block, isComposition, parseComposition } from "@/modules/documents/composition/schema";
import { resolveCompositionChoice } from "@/modules/documents/composition/templates";
import { appendBlocks, moveBefore } from "@/modules/documents/composition/tree";
import { supportsSignature, validateCompositionDocument } from "@/modules/documents/composition/validate";

describe("composition schema", () => {
  it("parses a nested tree that is not the example", () => {
    const parsed = parseComposition({
      schemaVersion: 1,
      type: "document",
      kind: "report",
      template: { id: "general", version: 1 },
      theme: { id: "ink", version: 1 },
      metadata: { title: "Weekly note" },
      page: { size: "A4", orientation: "portrait", margin: { top: 40, right: 40, bottom: 40, left: 40 } },
      header: { show: false },
      footer: { show: false },
      sections: [
        {
          id: "s1",
          blocks: [
            block("columns", {}, [
              block("stack", {}, [block("card", { title: "Note", body: "Nested" })]),
              block("paragraph", { text: "Beside the card." }),
            ]),
          ],
        },
      ],
    });
    expect("document" in parsed).toBe(true);
  });

  it("rejects a missing title, a data image, and an empty diagram", () => {
    const base = exampleProposalDocument();
    expect(parseComposition({ ...base, metadata: { ...base.metadata, title: " " } })).toEqual({ error: "Document title is missing." });
    const image = parseComposition({
      ...base,
      sections: [{ id: "s", blocks: [block("image", { src: "data:image/png;base64,aaaa" })] }],
    });
    expect("error" in image && image.error).toMatch(/base64/);
    const diagram = parseComposition({
      ...base,
      sections: [{ id: "s", blocks: [block("diagram", { layout: "row", nodes: [] })] }],
    });
    expect("error" in diagram && diagram.error).toMatch(/node/);
  });

  it("lays a flow document onto frames", () => {
    const placed = materializeDocument(exampleRequirementsDocument());
    expect(placed.pages?.length).toBeGreaterThan(0);
    expect(placed.pages?.[0].blocks[0]?.frame?.w).toBeGreaterThan(0);
    const again = materializeDocument(placed);
    expect(again.pages?.[0].blocks[0]?.id).toBe(placed.pages?.[0].blocks[0]?.id);
  });

  it("clips two shapes into one path", () => {
    const clipped = clipShapes(
      { kind: "rect", x: 0, y: 0, w: 80, h: 40 },
      { kind: "ellipse", x: 40, y: 10, w: 50, h: 30 },
      "subtract",
    );
    expect(clipped.path.length).toBeGreaterThan(10);
    expect(clipped.frame.w).toBeGreaterThan(80);
  });

  it("leaves a TipTap document on the legacy path", () => {
    expect(isComposition({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false);
  });
});

describe("template resolution", () => {
  it("uses an explicit composition template", () => {
    const choice = resolveCompositionChoice({ templateId: "professional-prs", kind: "proposal" });
    expect(choice).toMatchObject({ use: "composition", template: { id: "professional-prs", kind: "prs" } });
  });

  it("uses the kind default for prs and srs", () => {
    expect(resolveCompositionChoice({ kind: "prs" })).toMatchObject({ use: "composition", template: { id: "professional-prs" } });
    expect(resolveCompositionChoice({ kind: "srs" })).toMatchObject({ use: "composition", template: { id: "professional-srs" } });
  });

  it("does not substitute the proposal template", () => {
    expect(resolveCompositionChoice({ templateId: "missing-template" })).toEqual({ error: "That document template does not exist." });
    const byKind = resolveCompositionChoice({ kind: "prs" });
    expect(byKind).not.toMatchObject({ template: { id: "proposal" } });
    expect(resolveCompositionChoice({ kind: "proposal" })).toEqual({ use: "legacy" });
  });
});

describe("registry", () => {
  it("renders every primitive for the editor and the PDF from the same props", () => {
    for (const type of registeredBlockTypes()) {
      const rendered = smokeRender(type);
      expect(rendered.editor.type).toBe(type);
      expect(rendered.preview.props).toEqual(rendered.pdf.props);
      expect(rendered.editor.props).toEqual(rendered.pdf.props);
    }
  });

  it("splits a table with caller-defined columns and repeats the header on each page", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ id: `R${index}`, title: "Need", detail: "Detail" }));
    const node = block("table", {
      columns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Requirement" },
        { key: "detail", label: "Description" },
      ],
      rows,
    });
    const pdf = blockRenderProps(node, "pdf");
    const editor = blockRenderProps(node, "editor");
    if (!("pages" in pdf) || !("pages" in editor)) throw new Error("table pages missing");
    expect(pdf.columns.map((column) => column.key)).toEqual(["id", "title", "detail"]);
    expect(pdf.pages.length).toBeGreaterThan(1);
    expect(splitTableRows(rows).every((page) => page.length > 0)).toBe(true);
    expect(pdf.columns).toEqual(editor.columns);
  });

  it("lays out one diagram as stack, row, hub, and timeline", () => {
    const nodes = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ];
    const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }];
    for (const layout of ["stack", "row", "hub", "timeline"] as const) {
      const drawn = layoutDiagramData(layout, nodes, edges);
      expect(drawn.boxes).toHaveLength(3);
      expect(drawn.edges.length).toBeGreaterThan(0);
      const node = block("diagram", { layout, nodes, edges });
      const editor = blockRenderProps(node, "editor");
      const pdf = blockRenderProps(node, "pdf");
      if (!("layout" in editor) || !("layout" in pdf)) throw new Error("diagram layout missing");
      expect(editor.layout).toBe(layout);
      expect(pdf.layout).toBe(layout);
    }
  });
});

describe("fixtures", () => {
  it("round-trips the requirements example and a different proposal", () => {
    const requirements = exampleRequirementsDocument();
    const proposal = exampleProposalDocument();
    expect(parseComposition(requirements)).toMatchObject({ document: { kind: "prs", theme: { id: "professional-blue" } } });
    expect(parseComposition(proposal)).toMatchObject({ document: { kind: "proposal", theme: { id: "ink" } } });
    const types = new Set<string>();
    const walk = (nodes: { type: string; children?: { type: string }[] }[]) => {
      for (const node of nodes) {
        types.add(node.type);
        const rendered = blockRenderProps(node as never, "editor");
        expect(blockRenderProps(node as never, "pdf").props).toEqual(rendered.props);
        if (node.children) walk(node.children);
      }
    };
    for (const doc of [requirements, proposal]) {
      for (const section of doc.sections) walk(section.blocks);
    }
    for (const type of ["columns", "card", "table", "diagram", "image", "callout"]) {
      expect(types.has(type)).toBe(true);
    }
    expect(proposal.sections[0]?.blocks.some((node) => node.type === "signature")).toBe(true);
    expect(supportsSignature("prs")).toBe(false);
    expect(supportsSignature("sow")).toBe(true);
    expect(validateCompositionDocument(requirements).readyForSignature).toBe(false);
  });

  it("appends and reorders blocks without leaving the tree", () => {
    const doc = exampleProposalDocument();
    const extra = block("paragraph", { text: "Added" });
    const appended = appendBlocks(doc, [extra], "start");
    expect(appended.sections[0]?.blocks[0]?.type).toBe("paragraph");
    const first = appended.sections[0]?.blocks[0]?.id ?? "";
    const second = appended.sections[0]?.blocks[1]?.id ?? "";
    const moved = moveBefore(appended, second, first);
    expect(moved.sections[0]?.blocks[0]?.id).toBe(second);
  });
});
