import type { EmailAttachmentPayload } from "@/modules/emails/types";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const SAFE_NAME = /[\\/:*?"<>|\u0000-\u001f]/g;
type ParsedAttachments =
  | { attachments: { filename: string; content: Buffer; contentType: string }[] }
  | { error: string };

export function parseEmailAttachments(input: unknown): ParsedAttachments {
  if (input == null) return { attachments: [] as { filename: string; content: Buffer; contentType: string }[] };
  if (!Array.isArray(input) || input.length > MAX_FILES) return { error: `Attach up to ${MAX_FILES} files.` };
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  let total = 0;
  for (const item of input as EmailAttachmentPayload[]) {
    if (!item || typeof item.filename !== "string" || typeof item.contentBase64 !== "string" || typeof item.contentType !== "string") return { error: "An attachment is invalid." };
    const filename = item.filename.replace(SAFE_NAME, "_").trim().slice(0, 180);
    if (!filename || item.contentBase64.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8) return { error: "An attachment is invalid or too large." };
    const content = Buffer.from(item.contentBase64, "base64");
    if (content.length === 0 || content.length > MAX_FILE_BYTES || content.toString("base64") !== item.contentBase64.replace(/=+$/, "")) return { error: `${filename} is invalid or larger than 5 MB.` };
    total += content.length;
    if (total > MAX_TOTAL_BYTES) return { error: "Attachments exceed the 10 MB total limit." };
    attachments.push({ filename, content, contentType: item.contentType.slice(0, 120) || "application/octet-stream" });
  }
  return { attachments };
}
