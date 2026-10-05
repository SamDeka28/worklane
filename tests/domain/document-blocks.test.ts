import { describe, expect, it } from "vitest";
import { blocksToDoc, parseDocumentBlocks } from "@/modules/documents/blocks";

const sample = [
  { type: "cover", kicker: "Statement of work", title: "Rentique", subtitle: "Prepared for Rentique" },
  {
    type: "facts",
    items: [
      { label: "Client", value: "Rentique" },
      { label: "SOW number", value: "RNTQ-SOW-001" },
    ],
  },
  { type: "heading", level: 2, text: [{ text: "Scope", bold: true }] },
  { type: "bullets", items: ["Discovery", "MVP"] },
  {
    type: "table",
    columns: ["#", "Deliverable"],
    rows: [[{ text: "D1", fill: "#dbeafe", border: "none" }, "Discovery & UX"]],
  },
  { type: "image", src: "https://example.com/mark.png", alt: "Mark", width: 160 },
  { type: "signatures", left: "Provider", right: "Client" },
];

describe("document blocks", () => {
  it("turns editor layout blocks into the same document nodes", () => {
    const parsed = parseDocumentBlocks(JSON.stringify(sample));
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    const built = blocksToDoc(parsed.blocks);
    expect("error" in built).toBe(false);
    if ("error" in built) return;
    const json = JSON.stringify(built.doc);
    expect(json).toContain("Rentique");
    expect(json).toContain("borderStyle\":\"band\"");
    expect(json).toContain("#dbeafe");
    expect(json).toContain("https://example.com/mark.png");
    expect(json).toContain("\"width\":160");
    expect(json).toContain("Discovery & UX");
    expect(built.doc.content?.some((node) => node.type === "heading")).toBe(true);
    expect(built.doc.content?.some((node) => node.type === "bulletList")).toBe(true);
    expect(built.doc.content?.some((node) => node.type === "image")).toBe(true);
  });

  it("rejects an image that is not https", () => {
    const built = blocksToDoc([{ type: "image", src: "http://example.com/a.png" }]);
    expect(built).toEqual({ error: "An image src must be an https URL." });
  });
});
