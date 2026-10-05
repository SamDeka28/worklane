import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { blocksToDoc } from "@/modules/documents/blocks";
import {
  applySignedAssetUrls,
  bytesForPdf,
  embedDocumentImagesForPdf,
  imageAssetIds,
  missingDocumentAssets,
  persistDocumentAssets,
  prepareAssetBytes,
  rasterizeSvg,
} from "@/modules/documents/assets";
import { renderDocumentPdfBuffer } from "@/modules/documents/pdf";
import { inflateSync } from "node:zlib";
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
      {
        type: "image",
        fileId: "11111111-1111-1111-1111-111111111111",
        alt: "Lynqo Home / Discovery screen",
        width: 720,
        align: "center",
        caption: "Home screen",
      },
    ]);
    expect("error" in built).toBe(false);
    if ("error" in built) return;
    const saved = persistDocumentAssets(built.doc);
    const image = saved.content?.[0];
    expect(image).toMatchObject({
      type: "image",
      attrs: {
        fileId: "11111111-1111-1111-1111-111111111111",
        alt: "Lynqo Home / Discovery screen",
        width: 720,
        align: "center",
        caption: "Home screen",
        src: null,
      },
    });
    expect(JSON.stringify(saved)).not.toMatch(/file:\/\/|\/tmp\/|localhost|data:image/);
    const shown = applySignedAssetUrls(saved, new Map([["11111111-1111-1111-1111-111111111111", "https://files.example/mark.png"]]));
    expect(shown.content?.[0]?.attrs?.src).toBe("https://files.example/mark.png");
    expect(shown.content?.[0]?.attrs?.fileId).toBe("11111111-1111-1111-1111-111111111111");
    expect(imageAssetIds(shown)).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });

  it("rasterizes svg to png and leaves png and jpeg bytes unchanged", () => {
    const png = Uint8Array.from(Buffer.from(PNG, "base64"));
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#111"/></svg>';
    expect(bytesForPdf(png, "image/png")).toEqual({ mime: "image/png", bytes: png });
    expect(bytesForPdf(jpeg, "image/jpeg")).toEqual({ mime: "image/jpeg", bytes: jpeg });
    const raster = rasterizeSvg(svg, 40);
    expect(Array.from(raster.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytesForPdf(new TextEncoder().encode(svg), "image/svg+xml")?.mime).toBe("image/png");
    expect(bytesForPdf(Uint8Array.from([0, 1, 2]), "image/gif")).toBeNull();
  });

  it("embeds a stored svg and marks a missing asset instead of dropping it", async () => {
    const fileId = "22222222-2222-2222-2222-222222222222";
    const missingId = "33333333-3333-3333-3333-333333333333";
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="#222"/></svg>');
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "image", attrs: { fileId, alt: "Header", src: null, width: 80 } },
        { type: "image", attrs: { fileId: missingId, alt: "Architecture diagram", src: null } },
      ],
    };
    const embedded = await embedDocumentImagesForPdf(storageClient([{ id: fileId, mime: "image/svg+xml", bytes: svg }]), doc);
    expect(doc.content?.[0]?.attrs?.src).toBeNull();
    const ready = embedded.content?.[0]?.attrs;
    expect(String(ready?.src)).toMatch(/^data:image\/png;base64,/);
    expect(ready?.unresolved).toBe(false);
    expect(embedded.content?.[1]?.attrs).toMatchObject({ src: null, unresolved: true, alt: "Architecture diagram" });
  });

  it("draws an embedded png and the alt text of a missing image", async () => {
    const buffer = await renderDocumentPdfBuffer({
      title: "Lynqo",
      orgName: "MPAARS",
      clientName: null,
      versionNumber: 1,
      signatures: [],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Product vision" }] },
          {
            type: "image",
            attrs: { src: `data:image/png;base64,${PNG}`, alt: "Mark", width: 1, align: "center", caption: "The mark" },
          },
          { type: "image", attrs: { src: null, unresolved: true, alt: "Lynqo header missing" } },
        ],
      },
    });
    const raw = pdfStreams(buffer);
    const text = pdfText(raw);
    expect(raw.split("/Subtype /Image").length - 1).toBeGreaterThan(0);
    expect(text).toContain("Lynqo header missing");
    expect(text).toContain("The mark");
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

function storageClient(files: Array<{ id: string; mime: string; bytes: Uint8Array }>): SupabaseClient {
  const result = { data: files.map(({ id, mime }) => ({ id, mime, storage_path: id })) };
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = self;
  builder.in = self;
  builder.is = self;
  builder.eq = self;
  builder.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return {
    from: () => builder,
    storage: {
      from: () => ({
        download: async (path: string) => {
          const file = files.find((item) => item.id === path);
          return { data: file ? new Blob([Buffer.from(file.bytes)]) : null };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

function pdfText(raw: string) {
  return [...raw.matchAll(/\[([\s\S]*?)\]\s*TJ/g)]
    .map((match) =>
      [...match[1].matchAll(/<([0-9A-Fa-f]+)>/g)]
        .map((hex) => Buffer.from(hex[1], "hex").toString("latin1"))
        .join(""),
    )
    .join("\n");
}

function pdfStreams(buffer: Buffer) {
  const chunks = [buffer.toString("latin1")];
  let offset = 0;
  while (offset < buffer.length) {
    const start = buffer.indexOf("stream", offset);
    if (start < 0) break;
    let dataStart = start + "stream".length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf("endstream", dataStart);
    if (end < 0) break;
    const slice = buffer.subarray(dataStart, buffer[end - 1] === 0x0a ? end - 1 : end);
    try {
      chunks.push(inflateSync(slice).toString("latin1"));
    } catch {
      chunks.push(slice.toString("latin1"));
    }
    offset = end + "endstream".length;
  }
  return chunks.join("\n");
}
