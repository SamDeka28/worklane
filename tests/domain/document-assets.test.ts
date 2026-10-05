import { describe, expect, it } from "vitest";
import { blocksToDoc } from "@/modules/documents/blocks";
import {
  applySignedAssetUrls,
  imageAssetIds,
  missingDocumentAssets,
  persistDocumentAssets,
  prepareAssetBytes,
} from "@/modules/documents/assets";
import type { JSONContent } from "@tiptap/core";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("document assets", () => {
  it("returns a stable image description for a png", () => {
    const prepared = prepareAssetBytes({
      filename: "mark.png",
      mimeType: "image/png",
      contentBase64: PNG,
    });
    expect("error" in prepared).toBe(false);
    if ("error" in prepared) return;
    expect(prepared.mimeType).toBe("image/png");
    expect(prepared.size).toBeGreaterThan(0);
    expect(prepared.width).toBe(1);
    expect(prepared.height).toBe(1);
    expect(prepared.filename).toBe("mark.png");
  });

  it("reads svg dimensions and rejects a script", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"></svg>').toString("base64");
    const prepared = prepareAssetBytes({ filename: "mark.svg", mimeType: "image/svg+xml", contentBase64: svg });
    expect(prepared).toMatchObject({ mimeType: "image/svg+xml", width: 32, height: 16 });
    const script = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64");
    expect(prepareAssetBytes({ filename: "bad.svg", mimeType: "image/svg+xml", contentBase64: script })).toEqual({
      error: "SVG images cannot contain scripts.",
    });
  });

  it("rejects a file that is not an image, a mismatched type, and a file over 4 MB", () => {
    expect(prepareAssetBytes({ filename: "notes.txt", mimeType: "text/plain", contentBase64: Buffer.from("hello").toString("base64") })).toEqual({
      error: "Upload png, jpeg, webp, gif, or svg.",
    });
    expect(prepareAssetBytes({ filename: "fake.png", mimeType: "image/png", contentBase64: Buffer.from("not a png").toString("base64") })).toEqual({
      error: "The file contents do not match mimeType.",
    });
    const executable = prepareAssetBytes({ filename: "app.png", mimeType: "image/png", contentBase64: Buffer.from("MZ executable").toString("base64") });
    expect("error" in executable).toBe(true);
    const huge = "A".repeat(Math.ceil((4 * 1024 * 1024 * 4) / 3) + 20);
    expect(prepareAssetBytes({ filename: "big.png", mimeType: "image/png", contentBase64: huge })).toEqual({
      error: "The file must be base64 and under 4 MB.",
    });
  });

  it("stores fileId on the document and signs the same url for preview and pdf", () => {
    const built = blocksToDoc([
      { type: "image", fileId: "11111111-1111-1111-1111-111111111111", alt: "Lynqo Home / Discovery screen", width: 720 },
    ]);
    expect("error" in built).toBe(false);
    if ("error" in built) return;
    const saved = persistDocumentAssets(built.doc);
    const image = saved.content?.[0];
    expect(image).toMatchObject({
      type: "image",
      attrs: { fileId: "11111111-1111-1111-1111-111111111111", alt: "Lynqo Home / Discovery screen", width: 720, src: null },
    });
    expect(JSON.stringify(saved)).not.toMatch(/file:\/\/|\/tmp\/|localhost/);
    const shown = applySignedAssetUrls(saved, new Map([["11111111-1111-1111-1111-111111111111", "https://files.example/mark.png"]]));
    expect(shown.content?.[0]?.attrs?.src).toBe("https://files.example/mark.png");
    expect(shown.content?.[0]?.attrs?.fileId).toBe("11111111-1111-1111-1111-111111111111");
    expect(imageAssetIds(shown)).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });

  it("rejects a missing fileId and an asset from outside the studio", () => {
    const missing = missingDocumentAssets(["asset-from-studio-b"], new Map());
    expect(missing?.error).toContain("does not exist in this studio");
    expect(missing?.error).toContain("Do not invent fileIds.");
    const foreign = missingDocumentAssets(["asset-a"], new Map());
    expect(foreign?.error).toContain("asset-a");
    expect(missingDocumentAssets(["asset-a"], new Map([["asset-a", "application/pdf"]]))?.error).toContain("not an image");
    expect(missingDocumentAssets(["asset-a"], new Map([["asset-a", "image/png"]]))).toBeNull();
  });

  it("keeps an https image without a fileId", () => {
    const built = blocksToDoc([{ type: "image", src: "https://example.com/mark.png", alt: "Mark" }]);
    expect("error" in built).toBe(false);
    if ("error" in built) return;
    expect(built.doc.content?.[0]?.attrs?.src).toBe("https://example.com/mark.png");
    expect(imageAssetIds(built.doc as JSONContent)).toEqual([]);
  });
});
